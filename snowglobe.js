import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import * as dat from "https://cdn.skypack.dev/dat.gui@0.7.9";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

let mouseX = window.innerWidth;
let mouseY = window.innerHeight / 2;

let object;

const loader = new GLTFLoader();

const renderer = new THREE.WebGLRenderer({alpha: true}); // transparent back
renderer.setSize(window.innerWidth, window.innerHeight);

let mixer;
let actions = [];
loader.load("./snowglobe.gltf", function (gltf) {
    object = gltf.scene;
    const material = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.5
    });

    object.getObjectByName("Sphere").material = material;

    scene.add(object);
    mixer = new THREE.AnimationMixer(object);
    const clips = gltf.animations;

    clips.forEach(function(clip) {
      const action = mixer.clipAction(clip);
      action.clampWhenFinished = true;
      action.loop = THREE.LoopOnce; // play once
      actions.push(action);
    });
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

const gui = new dat.GUI();
let params = {
  rotYOffset: -3,
  rotXOffset: -1.5,
  rotXMultiplier: 3,
  rotYMultiplier: 6.8
};

gui.add(params, 'rotYOffset', -10, 100).name('Y Offset');
gui.add(params, 'rotXOffset', -10, 10).name('X Offset');
gui.add(params, 'rotXMultiplier', 0, 10).name('X Multiplier');
gui.add(params, 'rotYMultiplier', 0, 10).name('Y Multiplier');

const clock = new THREE.Clock(); // clock for the animation
function animate() {
  requestAnimationFrame(animate);

  // move the model according to the cursor
  if (object) {
    object.rotation.y = params["rotYOffset"] + mouseX * params["rotYMultiplier"] / window.innerWidth;
    object.rotation.x = params["rotXOffset"] + mouseY * params["rotXMultiplier"] / window.innerHeight;
  }

  if (mixer){
    mixer.update(clock.getDelta());
  }

  renderer.render(scene, camera);
}

document.addEventListener("keydown", (event) => {
  if (event.key == " ") { // play animation when space is pressed
    actions.forEach((action) => {
      action.reset();
      action.play();
    });
  }
});

// get mouse position as its moving
document.onmousemove = (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
}

function onResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

// register our resize event function
window.addEventListener("resize", onResize, true);

animate();

