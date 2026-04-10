import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";

export let snow;
export let snowGeometry;
export let snowMaterial;

const snowCount = 4000;
const SNOW_RADIUS = 3.1

const textureLoader = new THREE.TextureLoader();
const snowTexture = textureLoader.load("https://threejs.org/examples/textures/sprites/disc.png");

let velocities = [];

export function createSnow(object) {
  snowGeometry = new THREE.BufferGeometry();
  const positions = [];
  velocities = [];

  // give each snowflake a small random movement in all directions
  for (let i = 0; i < snowCount; i++) {
    velocities.push((Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01);
  }

  // compute a position for each particle
  for (let i = 0; i < snowCount; i++) {
    let x, y, z;
    do { // generate a random position inside a 2x2 cube
      x = (Math.random() - 0.5) * 2;
      y = (Math.random() - 0.5) * 2;
      z = (Math.random() - 0.5) * 2;
    } while (x*x + y*y + z*z > 1); // regenerate the position if its not inside a sphere of radius 1

    positions.push(x*SNOW_RADIUS, y*SNOW_RADIUS, z*SNOW_RADIUS);
  }

  // give threejs the positions of the snow particles
  snowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  // create particle material
  snowMaterial = new THREE.PointsMaterial({
    map: snowTexture,
    size: 0.1,
    transparent: true,
    blending: THREE.AdditiveBlending // make particles white
  });
  
  // create particle system
  snow = new THREE.Points(snowGeometry, snowMaterial);
  object.add(snow);  // add snow to the model so that they move together
  snow.position.y = 0.9;
  snow.renderOrder = 999; // draw snow last (its position is still behind the globe)
}

export function updateSnow(shakeForce) {
  // get current snowflake positions
  const positions = snow.geometry.attributes.position.array;
  const radius = SNOW_RADIUS;

  // apply forces to each particle
  for (let i = 0; i < positions.length; i += 3) {
    let vx = velocities[i];
    let vy = velocities[i + 1];
    let vz = velocities[i + 2];

    vy -= 0.0002; // pull snowflakes downward

    vx += (Math.random() - 0.5) * shakeForce;
    vy += (Math.random() - 0.5) * shakeForce;
    vz += (Math.random() - 0.5) * shakeForce;

    // slow down particles over time
    vx *= 0.98;
    vy *= 0.98;
    vz *= 0.98;

    // apply movement
    positions[i] += vx;
    positions[i + 1] += vy;
    positions[i + 2] += vz;

    // update velocities
    velocities[i] = vx;
    velocities[i + 1] = vy;
    velocities[i + 2] = vz;

    // get updated particle position
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    // if a particle is moving outside of the surface of the sphere,
    // place it on the surface of the sphere instead, and reduce and reverse the direction of its velocity
    const dist = Math.sqrt(x*x + y*y + z*z);

    if (dist > radius) {
      positions[i] = (x / dist) * radius;
      positions[i + 1] = (y / dist) * radius;
      positions[i + 2] = (z / dist) * radius;

      velocities[i] *= -0.3;
      velocities[i + 1] *= -0.3;
      velocities[i + 2] *= -0.3;
    }
  }

  // tell threejs to update the positions of the snow particles
  snow.geometry.attributes.position.needsUpdate = true;
}