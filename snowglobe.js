import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import * as dat from "https://cdn.skypack.dev/dat.gui@0.7.9";

import { EffectComposer } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/UnrealBloomPass.js";

import { createSnow, updateSnow, snow, rebuildSnow } from "./snow.js";
import { noise3D } from './noise3D.js';

// v_normal to pass orientation to the fragment shader
const vertexShader = `
varying vec3 v_pos;
varying vec3 v_normal;
void main() {
  v_pos = position;
  v_normal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `
varying vec3 v_pos;
varying vec3 v_normal;
uniform float time;

struct DirectionalLight {
  vec3 direction;
  vec3 color;
};
uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];
uniform vec3 ambientLightColor;

${noise3D}

void main() {
  float r = length(v_pos.xz); // get distance from center of xz plane
  float n = snoise(vec3(v_pos.x * 2.1, v_pos.y * 2.0, time * 0.1)); // get noise based on position, offset slightly for uneven lines
  float rings = sin((r * 8.0) + n * 2.0);

  vec3 lightWood = vec3(0.18, 0.12, 0.08);
  vec3 darkWood  = vec3(0.14, 0.09, 0.06);
  
  // create soft transitions between wood colors
  float t = smoothstep(-0.2, 0.2, rings);
  vec3 baseColor = mix(darkWood, lightWood, t);

  // apply scene lighting
  vec3 lighting = ambientLightColor;

  // apply lambert lighting from each of the directional lights
  for(int i = 0; i < NUM_DIR_LIGHTS; i++) {
    vec3 lightDir = normalize(directionalLights[i].direction);
    float dotProduct = max(dot(v_normal, lightDir), 0.0);
    lighting += directionalLights[i].color * dotProduct;
  }

  gl_FragColor = vec4(baseColor * lighting, 1.0);
}`;

const woodMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  lights: true,
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib['lights'],
    {
      time: { value: 0 }
    }
  ])
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

let mouseX = window.innerWidth;
let mouseY = window.innerHeight / 2;

let object;

let mouseControlEnabled = true;

const loader = new GLTFLoader();

const renderer = new THREE.WebGLRenderer({alpha: true}); // transparent back
renderer.setSize(window.innerWidth, window.innerHeight);

// bloom pipeline
const renderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    type: THREE.HalfFloatType, // allows brightness values higher than 1.0
    format: THREE.RGBAFormat
  }
);
const composer = new EffectComposer(renderer, renderTarget);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 
  1.0,  // strength
  0.1,  // radius
  5  // threshhold
);

composer.addPass(bloomPass);

let mixer;
let actions = [];
loader.load("./snowglobe.gltf", function (gltf) {
    object = gltf.scene;
    const material = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.5,
      depthWrite: false // do not write info to depth buffer
    });

    object.getObjectByName("Sphere").material = material;
    object.getObjectByName("Sphere").renderOrder = 0; // otherwise red and green lights wont render
    object.getObjectByName("Base").material = woodMaterial;

    // give the bulbs thier respective glowing material
    for (let i = 1; i <= 29; i++) {
      const meshName = `Light${i}`;
      const bulb = object.getObjectByName(meshName);

      const isRed = i % 2 == 0;

      // had to add seperate material for each light so we can edit thier intensities seperately
      bulb.material = new THREE.MeshStandardMaterial({
          color: isRed ? 0xff0000 : 0x00ff00,
          emissive: isRed ? 0xff0000 : 0x00ff00,
          emissiveIntensity: isRed ? 100 : 50
      });

      // store state to allow toggling
      bulb.userData.originalIntensity = bulb.material.emissiveIntensity;
      bulb.userData.isOn = true;

      bulb.renderOrder = 1;
    }

    scene.add(object);

    // retrieve animation clips
    mixer = new THREE.AnimationMixer(object);
    const clips = gltf.animations;

    clips.forEach(function(clip) {
      const action = mixer.clipAction(clip);
      action.clampWhenFinished = true;
      action.loop = THREE.LoopOnce; // play once
      actions.push(action);
    });

    // add snow
    createSnow(object);
  },
  function (xhr) {
    //While it is loading, log the progress
    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
  },
  function (error) {
    //If there is an error, log it
    console.error(error);
  }
);

document.getElementById("canvas").appendChild(renderer.domElement);
camera.position.z = 8;

// add directional light
const topLight = new THREE.DirectionalLight(0xffffff, 0.8); // (color, intensity)
topLight.position.set(500, 500, 500) // top left
topLight.castShadow = true;
scene.add(topLight);

// add ambient light
const ambientLight = new THREE.AmbientLight(0x333333, 2);
scene.add(ambientLight);

// add outer light
const outerLight = new THREE.DirectionalLight(0xffffff, 1.3);
outerLight.position.set(0, 0.5, 0.5);
scene.add(outerLight);

scene.background = new THREE.Color(0xb33a3a);

// const gui = new dat.GUI();
let params = {
  rotYOffset: -3,
  rotXOffset: -1.5,
  rotXMultiplier: 3,
  rotYMultiplier: 6.8
};

// gui.add(params, 'rotYOffset', -10, 100).name('Y Offset');
// gui.add(params, 'rotXOffset', -10, 10).name('X Offset');
// gui.add(params, 'rotXMultiplier', 0, 10).name('X Multiplier');
// gui.add(params, 'rotYMultiplier', 0, 10).name('Y Multiplier');

let lastMouseX = mouseX;
let lastMouseY = mouseY;
let shakeForce = 0;

const clock = new THREE.Clock(); // clock for the animation
function animate() {
  requestAnimationFrame(animate);

  if (snow)  {
    updateSnow(shakeForce);
  }

  // move the model according to the cursor
  if (object && mouseControlEnabled) {
    object.rotation.y = params["rotYOffset"] + mouseX * params["rotYMultiplier"] / window.innerWidth;
    object.rotation.x = params["rotXOffset"] + mouseY * params["rotXMultiplier"] / window.innerHeight;
  }

  if (mixer){
    mixer.update(clock.getDelta());
  }

  //renderer.render(scene, camera);
  composer.render();
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
  // get mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // check children of scene objects as well for intersection
    const intersects = raycaster.intersectObjects(scene.children, true);

    let hit = null;

    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;

      if (obj.name.startsWith("Base")) { // dont toggle the light if it is behind the basem
        break;
      }

      if (obj.name.startsWith("Light")) {
        hit = intersects[i];
        break; // stop as soon as we find the closest lightbult to the camera that was hit by the ray
      }
    }

    if (hit) { // toggle light on/off
      const bulb = hit.object;

      if (bulb.userData.isOn) {
          bulb.material.emissiveIntensity = 0;
      } else {
          bulb.material.emissiveIntensity = bulb.userData.originalIntensity;
      }

      bulb.userData.isOn = !bulb.userData.isOn;
    }
});

document.addEventListener("keydown", (event) => {
  if (event.key == " ") { // play animation when space is pressed
    actions.forEach((action) => {
      action.reset();
      action.play();
    });
  }

  if (event.key.toLowerCase() === "m") {
    mouseControlEnabled = !mouseControlEnabled;
  }
});

// get mouse position as its moving
// get mouse movement speed
document.onmousemove = (e) => {
  if (mouseControlEnabled) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;

    shakeForce = Math.sqrt(dx*dx + dy*dy) * 0.003; // distance the mouse moved
  }

  // update mouse position
  mouseX = e.clientX;
  mouseY = e.clientY;

  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (object) {
    rebuildSnow(object);
  }
}

// register our resize event function
window.addEventListener("resize", onResize, true);

animate();