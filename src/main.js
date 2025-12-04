// Three.js layout: 4 roads (N,S,E,W), central roundabout, 4 traffic lights.
// Child-like, bright colors.
// Using global THREE from UMD build loaded in index.html.
if (typeof THREE === 'undefined') {
  throw new Error('THREE library not loaded.');
}
console.log('[Layout] Starting scene init...');

// ----- Renderer -----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
console.log('[Layout] Renderer attached');

// ----- Scene -----
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c8f7ff'); // light sky cyan

// ----- Camera (slight tilt for playful look) -----
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(20, 30, 20); // Elevated angle
camera.lookAt(0, 0, 0);

// ----- Lights -----
const ambient = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.6);
sun.position.set(25, 50, 10);
sun.castShadow = true;
scene.add(sun);
console.log('[Layout] Lights added');

// ----- Helpers (optional) -----
// const axes = new THREE.AxesHelper(10); scene.add(axes);

// ----- Materials palette -----
const palette = {
  road: new THREE.MeshLambertMaterial({ color: '#555b6e' }), // muted dark bluish gray
  line: new THREE.MeshBasicMaterial({ color: '#fff' }),
  grass: new THREE.MeshLambertMaterial({ color: '#90e39a' }),
  roundabout: new THREE.MeshLambertMaterial({ color: '#ffda79' }), // pastel yellow
  pole: new THREE.MeshLambertMaterial({ color: '#4f4f4f' }),
  housing: new THREE.MeshLambertMaterial({ color: '#ff9ecd' }), // playful pink
};

// ----- Ground (grass) -----
const groundGeo = new THREE.PlaneGeometry(120, 120);
const ground = new THREE.Mesh(groundGeo, palette.grass);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
console.log('[Layout] Ground added');

// ----- Roads -----
// We'll create a cross: horizontal (E-W) and vertical (N-S)
function createRoad(width, length) {
  const geo = new THREE.PlaneGeometry(length, width);
  const mesh = new THREE.Mesh(geo, palette.road);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

const roadWidth = 10;
const roadLength = 120;
const horizontalRoad = createRoad(roadWidth, roadLength);
scene.add(horizontalRoad);
const verticalRoad = createRoad(roadWidth, roadLength);
verticalRoad.rotation.y = Math.PI / 2; // rotate about Y before laying flat? Actually rotate geometry orientation
// Simpler: adjust scale with orientation by rotating after creation? We'll just rotate around Z after placed.
verticalRoad.rotation.x = -Math.PI / 2; // keep same orientation
verticalRoad.rotation.z = Math.PI / 2; // rotate to vertical
scene.add(verticalRoad);
console.log('[Layout] Roads added');

// Road lane markings (simple dashed lines) - center lines
function createDashedLine(length, dashCount, offsetZ = 0) {
  const group = new THREE.Group();
  const dashGeo = new THREE.PlaneGeometry(2, 0.5);
  for (let i = 0; i < dashCount; i++) {
    const dash = new THREE.Mesh(dashGeo, palette.line);
    dash.rotation.x = -Math.PI / 2;
    const x = -length / 2 + (i + 0.5) * (length / dashCount);
    dash.position.set(x, 0.01, offsetZ); // slight height to avoid z-fighting
    group.add(dash);
  }
  return group;
}

const horizontalLine = createDashedLine(roadLength, 40, 0);
scene.add(horizontalLine);
const verticalLine = createDashedLine(roadLength, 40, 0);
verticalLine.rotation.y = Math.PI / 2;
scene.add(verticalLine);

// ----- Roundabout -----
// Use a cylinder with a decorative donut (torus) rim.
const roundaboutRadius = 8;
const roundaboutGeo = new THREE.CylinderGeometry(roundaboutRadius, roundaboutRadius, 1, 48);
const roundaboutMesh = new THREE.Mesh(roundaboutGeo, palette.roundabout);
roundaboutMesh.position.y = 0.5; // slight elevation above roads
roundaboutMesh.castShadow = true;
roundaboutMesh.receiveShadow = true;
scene.add(roundaboutMesh);

// Decorative rim
const rimGeo = new THREE.TorusGeometry(roundaboutRadius + 0.6, 0.4, 16, 64);
const rimMat = new THREE.MeshLambertMaterial({ color: '#ff6f91' }); // bright pink
const rim = new THREE.Mesh(rimGeo, rimMat);
rim.rotation.x = Math.PI / 2;
rim.position.y = 1.1;
scene.add(rim);
console.log('[Layout] Roundabout added');

// Center decoration (tree-like simple) for playful style
const trunkGeo = new THREE.CylinderGeometry(0.6, 0.6, 3, 12);
const trunkMat = new THREE.MeshLambertMaterial({ color: '#b57f50' });
const trunk = new THREE.Mesh(trunkGeo, trunkMat);
trunk.position.y = 2.5;
trunk.castShadow = true;
scene.add(trunk);
const foliageGeo = new THREE.SphereGeometry(2.2, 24, 16);
const foliageMat = new THREE.MeshLambertMaterial({ color: '#6ee7b7' });
const foliage = new THREE.Mesh(foliageGeo, foliageMat);
foliage.position.y = 4.5;
foliage.castShadow = true;
scene.add(foliage);

// ----- Traffic Lights -----
// Four lights at cardinal road entries just outside roundabout radius.
// Each light: pole + housing + 3 circular lights (red, yellow, green). We'll animate emissive color.
const trafficLights = [];

function createTrafficLight(angleRadians) {
  const group = new THREE.Group();
  const distance = roundaboutRadius + 6; // place a bit away from rim
  const x = Math.cos(angleRadians) * distance;
  const z = Math.sin(angleRadians) * distance;
  group.position.set(x, 0, z);

  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.3, 0.3, 5, 12);
  const pole = new THREE.Mesh(poleGeo, palette.pole);
  pole.position.y = 2.5;
  pole.castShadow = true;
  group.add(pole);

  // Housing block
  const housingGeo = new THREE.BoxGeometry(1.2, 2.8, 1.2);
  const housing = new THREE.Mesh(housingGeo, palette.housing);
  housing.position.y = 4.6;
  housing.castShadow = true;
  group.add(housing);

  // Light circles
  const lightGeo = new THREE.SphereGeometry(0.35, 16, 12);
  const colors = ['#ff4545', '#ffd54a', '#3edc81'];
  const bulbs = colors.map((c, idx) => {
    const mat = new THREE.MeshLambertMaterial({ color: c, emissive: 0x000000 });
    const bulb = new THREE.Mesh(lightGeo, mat);
    bulb.position.set(0, 5.4 - idx * 0.9, 0.6); // front of housing
    bulb.castShadow = true;
    group.add(bulb);
    return bulb;
  });

  // Face the center
  group.lookAt(0, 4.6, 0);

  scene.add(group);
  return { group, bulbs };
}

// Angles for N(90°), E(0°), S(270°), W(180°) in radians
const cardinalAngles = [Math.PI / 2, 0, 3 * Math.PI / 2, Math.PI];
cardinalAngles.forEach(a => trafficLights.push(createTrafficLight(a)));
console.log('[Layout] Traffic lights created');

// ----- Traffic Light Animation Logic -----
let currentGreenIndex = 0;
const cycleTime = 3000; // ms green per direction
const yellowTime = 800; // ms yellow before switching
let cycleState = 'green'; // 'green' | 'yellow'
let lastChange = performance.now();

function updateTrafficLights(now) {
  const elapsed = now - lastChange;
  const totalLights = trafficLights.length;
  trafficLights.forEach((tl, idx) => {
    const [red, yellow, green] = tl.bulbs;
    // Reset emissive
    red.material.emissive.setHex(0x000000);
    yellow.material.emissive.setHex(0x000000);
    green.material.emissive.setHex(0x000000);
    if (idx === currentGreenIndex) {
      if (cycleState === 'green') {
        green.material.emissive.setHex(0x22ff66);
      } else if (cycleState === 'yellow') {
        yellow.material.emissive.setHex(0xffff55);
      }
    } else {
      red.material.emissive.setHex(0xff2222);
    }
  });
  if (cycleState === 'green' && elapsed > cycleTime) {
    cycleState = 'yellow';
    lastChange = now;
  } else if (cycleState === 'yellow' && elapsed > yellowTime) {
    cycleState = 'green';
    currentGreenIndex = (currentGreenIndex + 1) % totalLights;
    lastChange = now;
  }
}

// ----- Animation Loop -----
function animate(now) {
  requestAnimationFrame(animate);
  updateTrafficLights(now);
  // playful slow spin of rim
  rim.rotation.z += 0.002;
  renderer.render(scene, camera);
}
animate(performance.now());
console.log('[Layout] Animation loop started');

// ----- Resize Handling -----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----- Interaction (optional simple orbit) -----
// Lightweight custom drag rotate for playful effect (no OrbitControls to keep dependency minimal)
let dragging = false; let prevX = 0; let prevY = 0;
window.addEventListener('pointerdown', e => { dragging = true; prevX = e.clientX; prevY = e.clientY; });
window.addEventListener('pointerup', () => dragging = false);
window.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - prevX;
  const dy = e.clientY - prevY;
  prevX = e.clientX; prevY = e.clientY;
  // rotate camera around center
  const angle = dx * 0.005;
  camera.position.applyAxisAngle(new THREE.Vector3(0,1,0), angle);
  camera.lookAt(0,0,0);
  camera.position.y = Math.max(10, camera.position.y - dy * 0.02);
});

// ----- Notes -----
// This file implements the requested layout. Further game logic (vehicles, collisions) can be added later.
