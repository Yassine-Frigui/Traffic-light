// import React, { useEffect, useRef, useState, useCallback } from 'react';
// import * as THREE from 'three';

// // =============================================================================
// //  CONFIGURATION
// // =============================================================================

// const CONFIG = {
//   // Road dimensions
//   ROAD_WIDTH: 10,
//   ROAD_LENGTH: 120,
//   ROAD_HEIGHT: 0.2,
  
//   // Traffic lights
//   LIGHT_DISTANCE: 14,  // Distance from center
//   LANE_OFFSET: 2.5,    // Lane offset from center line
  
//   // Vehicle settings
//   VEHICLE_Y: 0.5,
  
//   // Turn settings (all position-based for uniform arcs)
//   TURN_TRIGGER_POSITION: 38,    // Position to start turn (after stop line at 35)
//   ENTERING_TURN_DISTANCE: 2,    // Distance to travel while entering turn
//   ROTATION_DISTANCE: 9.54,        // Distance to travel during 90° turn
//   EXITING_TURN_DISTANCE: 2,     // Distance to travel while exiting turn
//   TURN_SPEED_FACTOR: 0.8,       // Speed multiplier during turn
// };

// // =============================================================================
// //  MAP CONFIGURATIONS
// // =============================================================================

// const MAP_CONFIGS = {
//   intersection: {
//     id: 'intersection',
//     name: 'Simple Intersection',
//     description: '4-way intersection with traffic lights',
//     icon: '✚',
//     preview: '#3498db'
//   },
//   rainyIntersection: {
//     id: 'rainyIntersection',
//     name: 'Rainy Intersection',
//     description: 'Wet roads with rain weather conditions',
//     icon: '🌧️',
//     preview: '#5d6d7e'
//   },
//   desertIntersection: {
//     id: 'desertIntersection',
//     name: 'Desert Intersection',
//     description: 'Sandy terrain with hot desert landscape',
//     icon: '🏜️',
//     preview: '#d4ac6e'
//   },
//   snowyIntersection: {
//     id: 'snowyIntersection',
//     name: 'Snowy Intersection',
//     description: 'Snow-covered roads in winter conditions',
//     icon: '❄️',
//     preview: '#aed6f1'
//   },
//   cityGrid: {
//     id: 'cityGrid',
//     name: 'City Grid',
//     description: 'Multiple intersections in a grid layout',
//     icon: '▦',
//     preview: '#e74c3c'
//   }
// };

// // Direction mappings for clarity
// const DIRECTIONS = {
//   N: { index: 0, name: 'North', angle: Math.PI },      // Cars coming FROM south, going north
//   E: { index: 1, name: 'East',  angle: Math.PI / 2 },  // Cars coming FROM west, going east
//   S: { index: 2, name: 'South', angle: 0 },            // Cars coming FROM north, going south  
//   W: { index: 3, name: 'West',  angle: -Math.PI / 2 }  // Cars coming FROM east, going west
// };

// // =============================================================================
// //  TURN HELPER FUNCTIONS
// // =============================================================================

// function calculateCurrentRotation(direction) {
//   return DIRECTIONS[direction]?.angle || 0;
// }

// function calculateTargetRotation(currentDir, turnType) {
//   const current = calculateCurrentRotation(currentDir);
//   if (turnType === 'right') {
//     return current - Math.PI / 2; // 90° clockwise
//   } else if (turnType === 'left') {
//     return current + Math.PI / 2; // 90° counter-clockwise
//   }
//   return current;
// }

// function getNewDirection(currentDir, turnType) {
//   const turnMap = {
//     'N': { left: 'W', right: 'E' },
//     'E': { left: 'N', right: 'S' },
//     'S': { left: 'E', right: 'W' },
//     'W': { left: 'S', right: 'N' }
//   };
//   return turnMap[currentDir]?.[turnType] || currentDir;
// }

// function shouldInitiateTurn(vehicle) {
//   if (vehicle.turnDirection === 'straight') return false;
//   if (vehicle.turnState !== 'STRAIGHT') return false;
  
//   // Turn should start when vehicle reaches the intersection center area
//   // Stop line is at 35, turn starts shortly after
//   return vehicle.currentPosition >= CONFIG.TURN_TRIGGER_POSITION;
// }

// function getDirectionMultipliers(direction) {
//   // These define which way a car MOVES based on its direction
//   // N = going north = moving in -Z direction (from south to north in world coords)
//   // S = going south = moving in +Z direction (from north to south in world coords)
//   // E = going east = moving in +X direction
//   // W = going west = moving in -X direction
//   const multipliers = {
//     'N': { x: 0, z: -1 },  // North-bound cars move toward -Z
//     'S': { x: 0, z: 1 },   // South-bound cars move toward +Z
//     'E': { x: 1, z: 0 },   // East-bound cars move toward +X
//     'W': { x: -1, z: 0 }   // West-bound cars move toward -X
//   };
//   return multipliers[direction] || { x: 0, z: 0 };
// }

// // =============================================================================
// //  MAIN COMPONENT
// // =============================================================================

// export default function ThreeScene() {
//   const mountRef = useRef(null);
//   const sceneDataRef = useRef({
//     scene: null,
//     camera: null,
//     renderer: null,
//     trafficLights: {},   // direction -> {group, bulbs, timerMesh, lastDisplayedTimer}
//     vehicles: {},        // id -> mesh
//     simulationData: null,
//     lastPacketTime: 0,
//     localVehicles: {},   // id -> { position, speed, lane, direction, waiting, turnDirection }
//     localLights: {},   // direction -> { color, timer, transitioning }
//     collisionCount: 0,   // Collision counter
//     collidedPairs: new Set(), // Track pairs that have already collided to avoid duplicate counting
//     dayTime: 0,          // Day time in seconds (0-86400 for 24 hours)
//     vehicleMeshesShared: null  // Shared geometry/materials for vehicles
//   });
  
//   const [connected, setConnected] = useState(false);
//   const [events, setEvents] = useState([]);
//   const [trafficState, setTrafficState] = useState('Moderate');
//   const [activeEvent, setActiveEvent] = useState(null);
//   const [collisionCount, setCollisionCount] = useState(0);
//   const [dayTime, setDayTime] = useState(0);
//   const [paused, setPaused] = useState(false);
//   const pausedRef = useRef(false);
  
//   // Map selection state
//   const [currentMap, setCurrentMap] = useState('intersection');
//   const [isLoading, setIsLoading] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false);
//   const [loadingProgress, setLoadingProgress] = useState(0);
//   const currentMapRef = useRef('intersection');
  
//   // Keep pausedRef in sync with paused state for use in animation loop
//   useEffect(() => {
//     pausedRef.current = paused;
//   }, [paused]);

//   // Keep currentMapRef in sync
//   useEffect(() => {
//     currentMapRef.current = currentMap;
//   }, [currentMap]);

//   // ==========================================================================
//   //  Map Switching Logic
//   // ==========================================================================
  
//   const switchMap = useCallback(async (mapId) => {
//     if (mapId === currentMap || isLoading) return;
    
//     setIsLoading(true);
//     setLoadingProgress(0);
//     setSidebarOpen(false);
    
//     // Simulate loading phases
//     const loadingSteps = [
//       { progress: 10, delay: 100, message: 'Cleaning up current map...' },
//       { progress: 30, delay: 200, message: 'Disposing resources...' },
//       { progress: 50, delay: 300, message: 'Building new map...' },
//       { progress: 70, delay: 200, message: 'Loading assets...' },
//       { progress: 90, delay: 150, message: 'Finalizing...' },
//       { progress: 100, delay: 100, message: 'Complete!' },
//     ];
    
//     for (const step of loadingSteps) {
//       await new Promise(resolve => setTimeout(resolve, step.delay));
//       setLoadingProgress(step.progress);
//     }
    
//     // Clear existing vehicles and traffic lights
//     const { scene, vehicles, trafficLights } = sceneDataRef.current;
    
//     // Remove all vehicles
//     Object.keys(vehicles).forEach(id => {
//       const mesh = vehicles[id];
//       if (mesh) {
//         scene.remove(mesh);
//         mesh.geometry?.dispose();
//         mesh.material?.dispose();
//       }
//       delete vehicles[id];
//     });
    
//     // Remove traffic light groups
//     Object.keys(trafficLights).forEach(dir => {
//       const light = trafficLights[dir];
//       if (light?.group) {
//         scene.remove(light.group);
//       }
//       delete trafficLights[dir];
//     });
    
//     // Clear local vehicle state
//     sceneDataRef.current.localVehicles = {};
//     sceneDataRef.current.collisionCount = 0;
//     sceneDataRef.current.collidedPairs = new Set();
//     setCollisionCount(0);
    
//     // Remove map-specific objects (roads, ground, decorations)
//     const objectsToRemove = [];
//     scene.traverse((child) => {
//       if (child.userData.mapObject) {
//         objectsToRemove.push(child);
//       }
//     });
//     objectsToRemove.forEach(obj => {
//       scene.remove(obj);
//       obj.geometry?.dispose();
//       if (obj.material) {
//         if (Array.isArray(obj.material)) {
//           obj.material.forEach(m => m.dispose());
//         } else {
//           obj.material.dispose();
//         }
//       }
//     });
    
//     // Build new map
//     buildMapByType(scene, sceneDataRef.current.trafficLights, mapId);
    
//     setCurrentMap(mapId);
    
//     // Small delay before hiding loading screen
//     await new Promise(resolve => setTimeout(resolve, 300));
//     setIsLoading(false);
//   }, [currentMap, isLoading]);

//   // ==========================================================================
//   //  Map Builder Dispatcher
//   // ==========================================================================
  
//   function buildMapByType(scene, trafficLightsRef, mapType) {
//     switch (mapType) {
//       case 'rainyIntersection':
//         buildRainyIntersection(scene, trafficLightsRef);
//         break;
//       case 'desertIntersection':
//         buildDesertIntersection(scene, trafficLightsRef);
//         break;
//       case 'snowyIntersection':
//         buildSnowyIntersection(scene, trafficLightsRef);
//         break;
//       case 'cityGrid':
//         buildCityGridMap(scene, trafficLightsRef);
//         break;
//       case 'intersection':
//       default:
//         buildGround(scene);
//         buildRoads(scene);
//         buildTrafficLights(scene, trafficLightsRef);
//         break;
//     }
//   }

//   // ==========================================================================
//   //  WebSocket Connection
//   // ==========================================================================
  
//   useEffect(() => {
//     const isProd = import.meta.env.PROD;
//     const wsUrl = isProd ? import.meta.env.VITE_WS_URL : 'ws://localhost:8000';
    
//     let ws = null;
//     let reconnectTimeout = null;
    
//     const connect = () => {
//       ws = new WebSocket(wsUrl);
      
//       ws.onopen = () => {
//         console.log('✓ Connected to simulation server');
//         setConnected(true);
//         console.log(`${isProd ? 'Production' : 'Development'} mode`)
//       };
      
//       ws.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
//           sceneDataRef.current.simulationData = data;
//           sceneDataRef.current.lastPacketTime = performance.now();
          
//           // Update local vehicle state from server data
//           if (data.Vehicles) {
//             // If Reset flag is true, mark existing vehicles as fading instead of clearing
//             if (data.Reset === true) {
//               Object.values(sceneDataRef.current.localVehicles).forEach(v => {
//                 v.fading = true;
//                 v.fadeStart = performance.now();
//               });
//             }
            
//             data.Vehicles.forEach(v => {
//               if (!v.Id || !v.Sens || !['N','S','E','W'].includes(v.Sens)) return; // Skip invalid vehicles
              
//               // Only update if this is a new vehicle or if we don't have it yet
//               if (!sceneDataRef.current.localVehicles[v.Id]) {
//                 // Assign random turn direction: 50% straight, 25% left, 25% right
//                 const turnRandom = Math.random();
//                 const turnDirection = turnRandom < 0.5 ? 'straight' : (turnRandom < 0.75 ? 'left' : 'right');
                
//                 // Calculate initial position based on direction
//                 // Vehicles spawn far from intersection and move toward it
//                 const { LANE_OFFSET } = CONFIG;
//                 const lane = v.Voie?.includes('1') ? 1 : 2;
//                 const laneOff = (lane === 1 ? -LANE_OFFSET : LANE_OFFSET) * 0.8;
//                 const currentPos = v.Position || 0;
                
//                 // Spawn positions: vehicles start at edge and move toward center
//                 // N-bound: spawn at +Z (south edge), move toward -Z
//                 // S-bound: spawn at -Z (north edge), move toward +Z  
//                 // E-bound: spawn at -X (west edge), move toward +X
//                 // W-bound: spawn at +X (east edge), move toward -X
//                 let initX = 0, initZ = 0;
//                 if (v.Sens === 'N') {
//                   // North-bound: starts at south (+Z), lane offset on X
//                   initX = -laneOff;
//                   initZ = 50 - currentPos;  // Starts at +50, moves toward 0
//                 } else if (v.Sens === 'S') {
//                   // South-bound: starts at north (-Z), lane offset on X
//                   initX = laneOff;
//                   initZ = -50 + currentPos;  // Starts at -50, moves toward 0
//                 } else if (v.Sens === 'E') {
//                   // East-bound: starts at west (-X), lane offset on Z
//                   initX = -50 + currentPos;  // Starts at -50, moves toward 0
//                   initZ = -laneOff;
//                 } else if (v.Sens === 'W') {
//                   // West-bound: starts at east (+X), lane offset on Z
//                   initX = 50 - currentPos;  // Starts at +50, moves toward 0
//                   initZ = laneOff;
//                 }
                
//                 sceneDataRef.current.localVehicles[v.Id] = {
//                   ...v,
//                   currentPosition: currentPos,
//                   currentSpeed: v.Speed || 0,
//                   waiting: false,
//                   fading: false,
//                   turnDirection: turnDirection,
                  
//                   // NEW: Turn state machine properties (position-based)
//                   turnState: 'STRAIGHT',
//                   turnStartPosition: 0,  // Position when turn phase started
//                   turnProgress: 0,
//                   rotation: calculateCurrentRotation(v.Sens),
//                   initialRotation: calculateCurrentRotation(v.Sens),
//                   targetRotation: calculateCurrentRotation(v.Sens),
//                   position: { x: initX, z: initZ },
                  
//                   // Legacy properties for backwards compatibility
//                   hasTurned: false
//                 };
//               }
//               // Don't update position/speed for existing vehicles - let local physics handle that
//             });
            
//             sceneDataRef.current.localVehicles = { ...sceneDataRef.current.localVehicles };
//           }

//           // Initialize local light state from server data
//           if (data.Lights) {
//             const newLocalLights = {};
//             const serverTime = data.ServerTime || Date.now();
//             // Capture mapping points for interpolation
//             sceneDataRef.current.serverTimeAtLastPacket = serverTime;
//             sceneDataRef.current.clientPerfAtLastPacket = performance.now();
//             data.Lights.forEach(light => {
//               // Prefer ExpiresAt (epoch ms); fall back to Timer (seconds)
//               const expiresAt = light.ExpiresAt || (serverTime + (light.Timer || 0) * 1000);
//               newLocalLights[light.Sens] = {
//                 color: light.Couleur,
//                 expiresAt,
//                 lastUpdateTime: performance.now()
//               };
//             });
//             sceneDataRef.current.localLights = newLocalLights;
//           }

//           // Update HUD state
//           if (data.Event) {
//             setActiveEvent(data.Event.name);
//             // Map event to traffic state
//             const name = data.Event.name;
//             if (['Rush Hour', 'Accident', 'Construction', 'Bad Weather'].includes(name)) {
//               setTrafficState('Slow');
//             } else if (name === 'Event Nearby') {
//               setTrafficState('Moderate'); // High volume but moving
//             } else {
//               setTrafficState('Moderate');
//             }
//           } else {
//             setActiveEvent(null);
//             setTrafficState('Fast'); // No event = normal/fast
//           }

//           if (data.Events) {
//             setEvents(data.Events);
//           }
//         } catch (error) {
//           console.error('Failed to parse data:', error);
//         }
//       };
      
//       ws.onclose = () => {
//         console.log('✗ Disconnected from server');
//         setConnected(false);
//         reconnectTimeout = setTimeout(connect, 3000);
//       };
      
//       ws.onerror = (error) => {
//         console.error('WebSocket error:', error);
//       };
//     };
    
//     connect();
    
//     return () => {
//       if (reconnectTimeout) clearTimeout(reconnectTimeout);
//       if (ws) ws.close();
//     };
//   }, []);

//   // ==========================================================================
//   //  Three.js Scene Setup
//   // ==========================================================================
  
//   useEffect(() => {
//     const width = window.innerWidth;
//     const height = window.innerHeight;
    
//     // Renderer
//     const renderer = new THREE.WebGLRenderer({ antialias: true });
//     renderer.setPixelRatio(window.devicePixelRatio);
//     renderer.setSize(width, height);
//     renderer.shadowMap.enabled = true;
//     renderer.shadowMap.type = THREE.PCFSoftShadowMap;
//     mountRef.current.appendChild(renderer.domElement);
    
//     // Scene
//     const scene = new THREE.Scene();
//     scene.background = new THREE.Color('#87CEEB');  // Sky blue
    
//     // Camera
//     const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
//     camera.position.set(40, 50, 40);
//     camera.lookAt(0, 0, 0);
    
//     // Lighting
//     const ambient = new THREE.AmbientLight(0xffffff, 0.6);
//     scene.add(ambient);
    
//     const sun = new THREE.DirectionalLight(0xffffff, 0.8);
//     sun.position.set(30, 60, 20);
//     sun.castShadow = true;
//     sun.shadow.mapSize.width = 2048;
//     sun.shadow.mapSize.height = 2048;
//     sun.shadow.camera.near = 0.5;
//     sun.shadow.camera.far = 200;
//     sun.shadow.camera.left = -60;
//     sun.shadow.camera.right = 60;
//     sun.shadow.camera.top = 60;
//     sun.shadow.camera.bottom = -60;
//     scene.add(sun);
    
//     // Store refs
//     sceneDataRef.current.scene = scene;
//     sceneDataRef.current.camera = camera;
//     sceneDataRef.current.renderer = renderer;
    
//     // Build the initial map based on current selection
//     buildMapByType(scene, sceneDataRef.current.trafficLights, currentMapRef.current);
    
//     // Camera controls (drag to rotate)
//     let dragging = false, prevX = 0, prevY = 0;
    
//     const onPointerDown = (e) => { 
//       dragging = true; 
//       prevX = e.clientX; 
//       prevY = e.clientY; 
//     };
    
//     const onPointerUp = () => { 
//       dragging = false; 
//     };
    
//     const onPointerMove = (e) => {
//       if (!dragging) return;
//       const dx = e.clientX - prevX;
//       const dy = e.clientY - prevY;
//       prevX = e.clientX;
//       prevY = e.clientY;
      
//       camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.005);
//       camera.position.y = Math.max(15, Math.min(100, camera.position.y - dy * 0.1));
//       camera.lookAt(0, 0, 0);
//     };
    
//     window.addEventListener('pointerdown', onPointerDown);
//     window.addEventListener('pointerup', onPointerUp);
//     window.addEventListener('pointerleave', onPointerUp);
//     window.addEventListener('pointermove', onPointerMove);
    
//     // Resize handler
//     const onResize = () => {
//       const w = window.innerWidth;
//       const h = window.innerHeight;
//       camera.aspect = w / h;
//       camera.updateProjectionMatrix();
//       renderer.setSize(w, h);
//     };
//     window.addEventListener('resize', onResize);
    
//     // Animation loop
//     let lastTime = performance.now();
//     let lastLightingUpdate = 0;
//     const LIGHTING_UPDATE_MS = 1000; // Update lighting every second instead of every frame
    
//     const animate = (now) => {
//       requestAnimationFrame(animate);
//       const dt = (now - lastTime) / 1000;
//       lastTime = now;
      
//       // Skip physics updates if paused (but still render)
//       if (pausedRef.current) {
//         renderer.render(scene, camera);
//         return;
//       }
      
//       // Update day/night cycle (throttled)
//       sceneDataRef.current.dayTime += dt * 100; // Speed up time (100x real time)
//       if (sceneDataRef.current.dayTime >= 86400) sceneDataRef.current.dayTime = 0;
      
//       // Update lighting less frequently
//       if (now - lastLightingUpdate > LIGHTING_UPDATE_MS) {
//         lastLightingUpdate = now;
//         setDayTime(sceneDataRef.current.dayTime);
        
//         // Adjust lighting based on time
//         const hour = (sceneDataRef.current.dayTime / 3600) % 24;
//         const isDay = hour >= 6 && hour <= 18;
//         const intensity = isDay ? 0.8 : 0.2;
//         sun.intensity = intensity;
//         ambient.intensity = isDay ? 0.6 : 0.3;
//         scene.background = new THREE.Color(isDay ? '#87CEEB' : '#191970'); // Sky blue to midnight blue
//       }
      
//       // Update from simulation data
//       const data = sceneDataRef.current.simulationData;
//       if (data) {
//         // Calculate delta time for this frame
//         const elapsedTotal = (now - sceneDataRef.current.lastPacketTime) / 1000;
        
//         // Estimate server-side 'now' for timer calculations
//         const serverTimeBase = sceneDataRef.current.serverTimeAtLastPacket || Date.now();
//         const clientPerfBase = sceneDataRef.current.clientPerfAtLastPacket || performance.now();
//         const estimatedServerNow = serverTimeBase + (now - clientPerfBase);
        
//         updateTrafficLights(sceneDataRef.current.trafficLights, sceneDataRef.current.localLights, elapsedTotal, estimatedServerNow);
        
//         // Run physics simulation step
//         updateVehiclesPhysics(dt, data.Lights, sceneDataRef.current.localVehicles, sceneDataRef.current.localLights, estimatedServerNow);
        
//         // Update meshes based on local physics state
//         updateVehicleMeshes(sceneDataRef.current.localVehicles, scene, sceneDataRef.current.vehicles);
//       }
      
//       renderer.render(scene, camera);
//     };
    
//     animate(lastTime);
    
//     // Cleanup
//     return () => {
//       window.removeEventListener('pointerdown', onPointerDown);
//       window.removeEventListener('pointerup', onPointerUp);
//       window.removeEventListener('pointerleave', onPointerUp);
//       window.removeEventListener('pointermove', onPointerMove);
//       window.removeEventListener('resize', onResize);
//       if (mountRef.current) {
//         mountRef.current.removeChild(renderer.domElement);
//       }
//       renderer.dispose();
//     };
//   }, []);

//   // ==========================================================================
//   //  Scene Building Functions
//   // ==========================================================================
  
//   function buildGround(scene) {
//     // Extended ground to cover entire scene (larger than roads)
//     const groundGeo = new THREE.PlaneGeometry(300, 300);
//     const groundMat = new THREE.MeshLambertMaterial({ color: '#7ec850' }); // Grass green
//     const ground = new THREE.Mesh(groundGeo, groundMat);
//     ground.rotation.x = -Math.PI / 2;
//     ground.position.y = -0.1;
//     ground.receiveShadow = true;
//     ground.userData.mapObject = true;
//     scene.add(ground);
    
//     // Add decorative trees around the green areas
//     const treeMat = new THREE.MeshLambertMaterial({ color: '#228b22' });
//     const trunkMat = new THREE.MeshLambertMaterial({ color: '#8B4513' });
    
//     // Tree positions - avoid roads (roads are along x=0 and z=0)
//     const treePositions = [
//       // Northeast quadrant
//       { x: 30, z: -30 }, { x: 50, z: -45 }, { x: 40, z: -60 }, { x: 65, z: -35 },
//       { x: 25, z: -55 }, { x: 55, z: -25 }, { x: 70, z: -55 },
//       // Northwest quadrant
//       { x: -30, z: -30 }, { x: -50, z: -45 }, { x: -40, z: -60 }, { x: -65, z: -35 },
//       { x: -25, z: -55 }, { x: -55, z: -25 }, { x: -70, z: -55 },
//       // Southeast quadrant
//       { x: 30, z: 30 }, { x: 50, z: 45 }, { x: 40, z: 60 }, { x: 65, z: 35 },
//       { x: 25, z: 55 }, { x: 55, z: 25 }, { x: 70, z: 55 },
//       // Southwest quadrant
//       { x: -30, z: 30 }, { x: -50, z: 45 }, { x: -40, z: 60 }, { x: -65, z: 35 },
//       { x: -25, z: 55 }, { x: -55, z: 25 }, { x: -70, z: 55 },
//     ];
    
//     treePositions.forEach((pos, i) => {
//       // Vary tree sizes
//       const scale = 0.7 + Math.random() * 0.6;
//       const trunkHeight = 2 * scale;
//       const foliageHeight = 4 * scale;
//       const foliageRadius = 2 * scale;
      
//       // Trunk
//       const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, trunkHeight, 8);
//       const trunk = new THREE.Mesh(trunkGeo, trunkMat);
//       trunk.position.set(pos.x, trunkHeight / 2 + 0.1, pos.z);
//       trunk.castShadow = true;
//       trunk.userData.mapObject = true;
//       scene.add(trunk);
      
//       // Foliage (cone shape for simple trees)
//       const foliageGeo = new THREE.ConeGeometry(foliageRadius, foliageHeight, 8);
//       const foliage = new THREE.Mesh(foliageGeo, treeMat);
//       foliage.position.set(pos.x, trunkHeight + foliageHeight / 2, pos.z);
//       foliage.castShadow = true;
//       foliage.userData.mapObject = true;
//       scene.add(foliage);
//     });
//   }
  
//   function buildRoads(scene) {
//     const roadMat = new THREE.MeshLambertMaterial({ color: '#404040' });
//     const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    
//     const { ROAD_WIDTH, ROAD_HEIGHT } = CONFIG;
//     // Extend roads to reach the edge of the ground
//     const EXTENDED_ROAD_LENGTH = 300;
    
//     // Horizontal road (East-West) - extends to ground edges
//     const hRoadGeo = new THREE.BoxGeometry(EXTENDED_ROAD_LENGTH, ROAD_HEIGHT, ROAD_WIDTH);
//     const hRoad = new THREE.Mesh(hRoadGeo, roadMat);
//     hRoad.position.y = ROAD_HEIGHT / 2;
//     hRoad.receiveShadow = true;
//     hRoad.userData.mapObject = true;
//     scene.add(hRoad);
    
//     // Vertical road (North-South) - extends to ground edges
//     const vRoadGeo = new THREE.BoxGeometry(ROAD_WIDTH, ROAD_HEIGHT, EXTENDED_ROAD_LENGTH);
//     const vRoad = new THREE.Mesh(vRoadGeo, roadMat);
//     vRoad.position.y = ROAD_HEIGHT / 2;
//     vRoad.receiveShadow = true;
//     vRoad.userData.mapObject = true;
//     scene.add(vRoad);
    
//     // Center line markings (dashed) - extended to match road length
//     const dashGeo = new THREE.BoxGeometry(3, 0.05, 0.3);
//     for (let i = -60; i <= 60; i += 4) {
//       // Skip dashes in the intersection area
//       if (Math.abs(i * 2) < 8) continue;
//       // Horizontal dashes
//       const hDash = new THREE.Mesh(dashGeo, lineMat);
//       hDash.position.set(i * 2, ROAD_HEIGHT + 0.05, 0);
//       hDash.userData.mapObject = true;
//       scene.add(hDash);
//     }
    
//     const vDashGeo = new THREE.BoxGeometry(0.3, 0.05, 3);
//     for (let i = -60; i <= 60; i += 4) {
//       // Skip dashes in the intersection area
//       if (Math.abs(i * 2) < 8) continue;
//       // Vertical dashes
//       const vDash = new THREE.Mesh(vDashGeo, lineMat);
//       vDash.position.set(0, ROAD_HEIGHT + 0.05, i * 2);
//       vDash.userData.mapObject = true;
//       scene.add(vDash);
//     }
    
//     // Add stop lines at intersection
//     const stopLineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
//     const stopLineGeo = new THREE.BoxGeometry(ROAD_WIDTH / 2 - 0.5, 0.06, 0.5);
    
//     // North approach stop line
//     const stopN = new THREE.Mesh(stopLineGeo, stopLineMat);
//     stopN.position.set(-ROAD_WIDTH / 4 - 0.25, ROAD_HEIGHT + 0.06, -ROAD_WIDTH / 2 - 1);
//     stopN.userData.mapObject = true;
//     scene.add(stopN);
    
//     // South approach stop line
//     const stopS = new THREE.Mesh(stopLineGeo, stopLineMat);
//     stopS.position.set(ROAD_WIDTH / 4 + 0.25, ROAD_HEIGHT + 0.06, ROAD_WIDTH / 2 + 1);
//     stopS.userData.mapObject = true;
//     scene.add(stopS);
    
//     // East approach stop line
//     const stopLineGeoV = new THREE.BoxGeometry(0.5, 0.06, ROAD_WIDTH / 2 - 0.5);
//     const stopE = new THREE.Mesh(stopLineGeoV, stopLineMat);
//     stopE.position.set(ROAD_WIDTH / 2 + 1, ROAD_HEIGHT + 0.06, -ROAD_WIDTH / 4 - 0.25);
//     stopE.userData.mapObject = true;
//     scene.add(stopE);
    
//     // West approach stop line
//     const stopW = new THREE.Mesh(stopLineGeoV, stopLineMat);
//     stopW.position.set(-ROAD_WIDTH / 2 - 1, ROAD_HEIGHT + 0.06, ROAD_WIDTH / 4 + 0.25);
//     stopW.userData.mapObject = true;
//     scene.add(stopW);
//   }
//   function buildTrafficLights(scene, trafficLightsRef) {
//     const { LIGHT_DISTANCE, LANE_OFFSET, ROAD_HEIGHT } = CONFIG;
    
//     // Traffic light positions and rotations
//     // Each light faces TOWARD the incoming traffic (i.e., toward where cars are coming from)
//     const lightConfigs = {
//       // North light: positioned at north side, faces SOUTH (toward cars coming from south)
//       'N': { 
//         position: new THREE.Vector3(-LANE_OFFSET - 1.5, 0, -LIGHT_DISTANCE),
//         rotation: Math.PI,  // Faces south
//         label: 'N'
//       },
//       // South light: positioned at south side, faces NORTH (toward cars coming from north)
//       'S': { 
//         position: new THREE.Vector3(LANE_OFFSET + 1.5, 0, LIGHT_DISTANCE),
//         rotation: 0,  // Faces north
//         label: 'S'
//       },
//       // East light: positioned at east side, faces EAST (toward cars coming from east)
//       'E': { 
//         position: new THREE.Vector3(LIGHT_DISTANCE, 0, -LANE_OFFSET - 1.5),
//         rotation: Math.PI / 2,  // Faces East
//         label: 'E'
//       },
//       // West light: positioned at west side, faces WEST (toward cars coming from west)
//       'W': { 
//         position: new THREE.Vector3(-LIGHT_DISTANCE, 0, LANE_OFFSET + 1.5),
//         rotation: -Math.PI / 2,  // Faces West
//         label: 'W'
//       }
//     };
    
//     const poleMat = new THREE.MeshLambertMaterial({ color: '#333333' });
//     const housingMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
    
//     Object.entries(lightConfigs).forEach(([direction, config]) => {
//       const group = new THREE.Group();
//       group.position.copy(config.position);
//       group.rotation.y = config.rotation;
//       group.userData.mapObject = true;
      
//       // Pole
//       const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 6, 12);
//       const pole = new THREE.Mesh(poleGeo, poleMat);
//       pole.position.y = 3;
//       pole.castShadow = true;
//       group.add(pole);
      
//       // Light housing
//       const housingGeo = new THREE.BoxGeometry(1.0, 3.0, 0.8);
//       const housing = new THREE.Mesh(housingGeo, housingMat);
//       housing.position.set(0, 5.5, 0);
//       housing.castShadow = true;
//       group.add(housing);
      
//       // Light bulbs (Red, Yellow, Green from top to bottom)
//       const bulbGeo = new THREE.CircleGeometry(0.3, 16);
//       const bulbColors = {
//         red: new THREE.MeshBasicMaterial({ color: '#330000' }),
//         yellow: new THREE.MeshBasicMaterial({ color: '#333300' }),
//         green: new THREE.MeshBasicMaterial({ color: '#003300' })
//       };
      
//       const redBulb = new THREE.Mesh(bulbGeo, bulbColors.red.clone());
//       redBulb.position.set(0, 6.3, 0.41);
//       group.add(redBulb);
      
//       const yellowBulb = new THREE.Mesh(bulbGeo, bulbColors.yellow.clone());
//       yellowBulb.position.set(0, 5.5, 0.41);
//       group.add(yellowBulb);
      
//       const greenBulb = new THREE.Mesh(bulbGeo, bulbColors.green.clone());
//       greenBulb.position.set(0, 4.7, 0.41);
//       group.add(greenBulb);
      
//       // Timer and Direction label display (text sprite)
//       const timerCanvas = document.createElement('canvas');
//       timerCanvas.width = 256;
//       timerCanvas.height = 128;
//       const timerTexture = new THREE.CanvasTexture(timerCanvas);
//       const timerMat = new THREE.SpriteMaterial({ map: timerTexture });
//       const timerSprite = new THREE.Sprite(timerMat);
//       timerSprite.position.set(0, 8, 0);
//       timerSprite.scale.set(4, 2, 1);
//       group.add(timerSprite);
      
//       // Direction names
//       const directionNames = { 'N': 'NORTH', 'S': 'SOUTH', 'E': 'EAST', 'W': 'WEST' };
//       const dirName = directionNames[direction];

//       // Initial draw
//       const ctx = timerCanvas.getContext('2d');
//       ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
//       ctx.fillRect(0, 0, 256, 128);
//       ctx.fillStyle = '#ffffff';
//       ctx.font = 'bold 28px Arial';
//       ctx.textAlign = 'center';
//       ctx.textBaseline = 'middle';
//       ctx.fillText(dirName, 128, 35);
//       ctx.font = 'bold 48px Arial';
//       ctx.fillText("--", 128, 88); // Placeholder for timer
//       timerTexture.needsUpdate = true;
      
//       scene.add(group);
      
//       // Store reference (track last canvas update and last displayed values to avoid per-frame updates)
//       trafficLightsRef[direction] = {
//         group,
//         bulbs: { red: redBulb, yellow: yellowBulb, green: greenBulb },
//         timerCanvas,
//         timerTexture,
//         timerSprite,
//         directionName: dirName,
//         lastCanvasUpdate: 0,        // perf.now() when canvas was last updated
//         lastDisplayedTimer: null,   // string previously drawn
//         lastColor: null             // last applied color (RED/YELLOW/GREEN)
//       };
//     });
//   }

//   // ==========================================================================
//   //  Alternative Map Builders (Themed Intersections)
//   // ==========================================================================
  
//   // Helper function to build standard intersection roads
//   function buildIntersectionRoads(scene, roadColor, lineColor) {
//     const roadMat = new THREE.MeshLambertMaterial({ color: roadColor });
//     const lineMat = new THREE.MeshBasicMaterial({ color: lineColor });
    
//     const { ROAD_WIDTH, ROAD_HEIGHT } = CONFIG;
//     const EXTENDED_ROAD_LENGTH = 300;
    
//     // Horizontal road
//     const hRoadGeo = new THREE.BoxGeometry(EXTENDED_ROAD_LENGTH, ROAD_HEIGHT, ROAD_WIDTH);
//     const hRoad = new THREE.Mesh(hRoadGeo, roadMat);
//     hRoad.position.y = ROAD_HEIGHT / 2;
//     hRoad.receiveShadow = true;
//     hRoad.userData.mapObject = true;
//     scene.add(hRoad);
    
//     // Vertical road
//     const vRoadGeo = new THREE.BoxGeometry(ROAD_WIDTH, ROAD_HEIGHT, EXTENDED_ROAD_LENGTH);
//     const vRoad = new THREE.Mesh(vRoadGeo, roadMat);
//     vRoad.position.y = ROAD_HEIGHT / 2;
//     vRoad.receiveShadow = true;
//     vRoad.userData.mapObject = true;
//     scene.add(vRoad);
    
//     // Dashed center lines
//     const dashGeo = new THREE.BoxGeometry(3, 0.05, 0.3);
//     for (let i = -60; i <= 60; i += 4) {
//       if (Math.abs(i * 2) < 8) continue;
//       const hDash = new THREE.Mesh(dashGeo, lineMat);
//       hDash.position.set(i * 2, ROAD_HEIGHT + 0.05, 0);
//       hDash.userData.mapObject = true;
//       scene.add(hDash);
//     }
    
//     const vDashGeo = new THREE.BoxGeometry(0.3, 0.05, 3);
//     for (let i = -60; i <= 60; i += 4) {
//       if (Math.abs(i * 2) < 8) continue;
//       const vDash = new THREE.Mesh(vDashGeo, lineMat);
//       vDash.position.set(0, ROAD_HEIGHT + 0.05, i * 2);
//       vDash.userData.mapObject = true;
//       scene.add(vDash);
//     }
    
//     // Stop lines
//     const stopLineMat = new THREE.MeshBasicMaterial({ color: lineColor });
//     const stopLineGeo = new THREE.BoxGeometry(ROAD_WIDTH / 2 - 0.5, 0.06, 0.5);
    
//     const stopN = new THREE.Mesh(stopLineGeo, stopLineMat);
//     stopN.position.set(-ROAD_WIDTH / 4 - 0.25, ROAD_HEIGHT + 0.06, -ROAD_WIDTH / 2 - 1);
//     stopN.userData.mapObject = true;
//     scene.add(stopN);
    
//     const stopS = new THREE.Mesh(stopLineGeo, stopLineMat);
//     stopS.position.set(ROAD_WIDTH / 4 + 0.25, ROAD_HEIGHT + 0.06, ROAD_WIDTH / 2 + 1);
//     stopS.userData.mapObject = true;
//     scene.add(stopS);
    
//     const stopLineGeoV = new THREE.BoxGeometry(0.5, 0.06, ROAD_WIDTH / 2 - 0.5);
//     const stopE = new THREE.Mesh(stopLineGeoV, stopLineMat);
//     stopE.position.set(ROAD_WIDTH / 2 + 1, ROAD_HEIGHT + 0.06, -ROAD_WIDTH / 4 - 0.25);
//     stopE.userData.mapObject = true;
//     scene.add(stopE);
    
//     const stopW = new THREE.Mesh(stopLineGeoV, stopLineMat);
//     stopW.position.set(-ROAD_WIDTH / 2 - 1, ROAD_HEIGHT + 0.06, ROAD_WIDTH / 4 + 0.25);
//     stopW.userData.mapObject = true;
//     scene.add(stopW);
//   }
  
//   // ========== RAINY INTERSECTION ==========
//   function buildRainyIntersection(scene, trafficLightsRef) {
//     // Dark grey ground (wet grass/mud)
//     const groundGeo = new THREE.PlaneGeometry(300, 300);
//     const groundMat = new THREE.MeshLambertMaterial({ color: '#4a5a4a' });
//     const ground = new THREE.Mesh(groundGeo, groundMat);
//     ground.rotation.x = -Math.PI / 2;
//     ground.position.y = -0.1;
//     ground.receiveShadow = true;
//     ground.userData.mapObject = true;
//     scene.add(ground);
    
//     // Wet road (darker, slightly reflective look)
//     buildIntersectionRoads(scene, '#2a2a2a', '#cccccc');
    
//     // Rain puddles on ground (scattered circles)
//     const puddleMat = new THREE.MeshLambertMaterial({ color: '#3a4a5a', transparent: true, opacity: 0.7 });
//     const puddlePositions = [
//       { x: 25, z: -30, r: 4 }, { x: -40, z: 50, r: 5 }, { x: 55, z: 35, r: 3 },
//       { x: -35, z: -45, r: 6 }, { x: 60, z: -55, r: 4 }, { x: -60, z: 30, r: 5 },
//       { x: 45, z: 60, r: 3 }, { x: -25, z: -60, r: 4 }
//     ];
    
//     puddlePositions.forEach(p => {
//       const puddleGeo = new THREE.CircleGeometry(p.r, 16);
//       const puddle = new THREE.Mesh(puddleGeo, puddleMat);
//       puddle.rotation.x = -Math.PI / 2;
//       puddle.position.set(p.x, 0.01, p.z);
//       puddle.userData.mapObject = true;
//       scene.add(puddle);
//     });
    
//     // Dark trees (wet foliage)
//     const wetTreeMat = new THREE.MeshLambertMaterial({ color: '#1a4a1a' });
//     const wetTrunkMat = new THREE.MeshLambertMaterial({ color: '#3a2a1a' });
    
//     const treePositions = [
//       { x: 35, z: -40 }, { x: -45, z: -35 }, { x: 50, z: 45 }, { x: -40, z: 50 },
//       { x: 65, z: -25 }, { x: -55, z: -55 }, { x: 30, z: 65 }, { x: -65, z: 40 }
//     ];
    
//     treePositions.forEach(pos => {
//       const scale = 0.8 + Math.random() * 0.4;
//       const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 2 * scale, 8);
//       const trunk = new THREE.Mesh(trunkGeo, wetTrunkMat);
//       trunk.position.set(pos.x, scale + 0.1, pos.z);
//       trunk.castShadow = true;
//       trunk.userData.mapObject = true;
//       scene.add(trunk);
      
//       const foliageGeo = new THREE.ConeGeometry(2 * scale, 4 * scale, 8);
//       const foliage = new THREE.Mesh(foliageGeo, wetTreeMat);
//       foliage.position.set(pos.x, 2 * scale + 2 * scale, pos.z);
//       foliage.castShadow = true;
//       foliage.userData.mapObject = true;
//       scene.add(foliage);
//     });
    
//     // Build traffic lights
//     buildTrafficLights(scene, trafficLightsRef);
//   }
  
//   // ========== DESERT INTERSECTION ==========
//   function buildDesertIntersection(scene, trafficLightsRef) {
//     // Sandy ground
//     const groundGeo = new THREE.PlaneGeometry(300, 300);
//     const groundMat = new THREE.MeshLambertMaterial({ color: '#d4a574' });
//     const ground = new THREE.Mesh(groundGeo, groundMat);
//     ground.rotation.x = -Math.PI / 2;
//     ground.position.y = -0.1;
//     ground.receiveShadow = true;
//     ground.userData.mapObject = true;
//     scene.add(ground);
    
//     // Cracked/faded road
//     buildIntersectionRoads(scene, '#5a5045', '#e0d5c0');
    
//     // Cacti
//     const cactusMat = new THREE.MeshLambertMaterial({ color: '#2d5a2d' });
//     const cactusPositions = [
//       { x: 30, z: -35 }, { x: -40, z: 45 }, { x: 55, z: 50 }, { x: -50, z: -40 },
//       { x: 70, z: -30 }, { x: -30, z: -65 }, { x: 45, z: 70 }, { x: -65, z: 55 },
//       { x: 25, z: 40 }, { x: -55, z: -25 }
//     ];
    
//     cactusPositions.forEach(pos => {
//       const height = 2 + Math.random() * 3;
//       // Main stem
//       const stemGeo = new THREE.CylinderGeometry(0.4, 0.5, height, 8);
//       const stem = new THREE.Mesh(stemGeo, cactusMat);
//       stem.position.set(pos.x, height / 2, pos.z);
//       stem.castShadow = true;
//       stem.userData.mapObject = true;
//       scene.add(stem);
      
//       // Arms (some cacti have them)
//       if (Math.random() > 0.4) {
//         const armGeo = new THREE.CylinderGeometry(0.25, 0.3, 1.5, 6);
//         const arm1 = new THREE.Mesh(armGeo, cactusMat);
//         arm1.position.set(pos.x + 0.6, height * 0.6, pos.z);
//         arm1.rotation.z = -Math.PI / 4;
//         arm1.userData.mapObject = true;
//         scene.add(arm1);
        
//         if (Math.random() > 0.5) {
//           const arm2 = new THREE.Mesh(armGeo, cactusMat);
//           arm2.position.set(pos.x - 0.6, height * 0.5, pos.z);
//           arm2.rotation.z = Math.PI / 4;
//           arm2.userData.mapObject = true;
//           scene.add(arm2);
//         }
//       }
//     });
    
//     // Desert rocks
//     const rockMat = new THREE.MeshLambertMaterial({ color: '#8b7355' });
//     const rockPositions = [
//       { x: 60, z: -50 }, { x: -55, z: 60 }, { x: 40, z: -60 }, { x: -45, z: -55 },
//       { x: 70, z: 40 }, { x: -70, z: -30 }
//     ];
    
//     rockPositions.forEach(pos => {
//       const rockGeo = new THREE.DodecahedronGeometry(1.5 + Math.random() * 2, 0);
//       const rock = new THREE.Mesh(rockGeo, rockMat);
//       rock.position.set(pos.x, 0.8, pos.z);
//       rock.rotation.set(Math.random(), Math.random(), Math.random());
//       rock.scale.y = 0.6;
//       rock.castShadow = true;
//       rock.userData.mapObject = true;
//       scene.add(rock);
//     });
    
//     // Build traffic lights
//     buildTrafficLights(scene, trafficLightsRef);
//   }
  
//   // ========== SNOWY INTERSECTION ==========
//   function buildSnowyIntersection(scene, trafficLightsRef) {
//     // Snow-covered ground
//     const groundGeo = new THREE.PlaneGeometry(300, 300);
//     const groundMat = new THREE.MeshLambertMaterial({ color: '#f0f5f5' });
//     const ground = new THREE.Mesh(groundGeo, groundMat);
//     ground.rotation.x = -Math.PI / 2;
//     ground.position.y = -0.1;
//     ground.receiveShadow = true;
//     ground.userData.mapObject = true;
//     scene.add(ground);
    
//     // Icy road (darker with blue tint)
//     buildIntersectionRoads(scene, '#3a4550', '#d0e0e5');
    
//     // Snow banks along roads
//     const snowBankMat = new THREE.MeshLambertMaterial({ color: '#e8f0f0' });
//     const snowBankPositions = [
//       { x: 0, z: -8, w: 280, d: 3 }, { x: 0, z: 8, w: 280, d: 3 },
//       { x: -8, z: 0, w: 3, d: 280 }, { x: 8, z: 0, w: 3, d: 280 }
//     ];
    
//     snowBankPositions.forEach(pos => {
//       const bankGeo = new THREE.BoxGeometry(pos.w, 0.8, pos.d);
//       const bank = new THREE.Mesh(bankGeo, snowBankMat);
//       bank.position.set(pos.x, 0.4, pos.z);
//       bank.userData.mapObject = true;
//       scene.add(bank);
//     });
    
//     // Pine trees with snow
//     const pineMat = new THREE.MeshLambertMaterial({ color: '#1a3a2a' });
//     const snowMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
//     const pineTrunkMat = new THREE.MeshLambertMaterial({ color: '#4a3020' });
    
//     const pinePositions = [
//       { x: 35, z: -35 }, { x: -40, z: -45 }, { x: 50, z: 40 }, { x: -45, z: 50 },
//       { x: 60, z: -55 }, { x: -55, z: -35 }, { x: 35, z: 60 }, { x: -60, z: 35 },
//       { x: 70, z: -30 }, { x: -30, z: -70 }, { x: 70, z: 55 }, { x: -70, z: -55 },
//       { x: 25, z: -55 }, { x: -55, z: 25 }
//     ];
    
//     pinePositions.forEach(pos => {
//       const scale = 0.7 + Math.random() * 0.5;
      
//       // Trunk
//       const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2 * scale, 8);
//       const trunk = new THREE.Mesh(trunkGeo, pineTrunkMat);
//       trunk.position.set(pos.x, scale, pos.z);
//       trunk.castShadow = true;
//       trunk.userData.mapObject = true;
//       scene.add(trunk);
      
//       // Multiple cone layers for pine look
//       for (let layer = 0; layer < 3; layer++) {
//         const layerScale = 1 - layer * 0.25;
//         const coneGeo = new THREE.ConeGeometry(2.5 * scale * layerScale, 3 * scale * layerScale, 8);
//         const cone = new THREE.Mesh(coneGeo, pineMat);
//         cone.position.set(pos.x, 2 * scale + layer * 1.5 * scale, pos.z);
//         cone.castShadow = true;
//         cone.userData.mapObject = true;
//         scene.add(cone);
        
//         // Snow on top of each layer
//         const snowCapGeo = new THREE.ConeGeometry(2.2 * scale * layerScale, 0.5 * scale, 8);
//         const snowCap = new THREE.Mesh(snowCapGeo, snowMat);
//         snowCap.position.set(pos.x, 2 * scale + layer * 1.5 * scale + 1.2 * scale * layerScale, pos.z);
//         snowCap.userData.mapObject = true;
//         scene.add(snowCap);
//       }
//     });
    
//     // Snowmen (fun decoration)
//     const snowmanPositions = [{ x: 45, z: -25 }, { x: -50, z: 40 }];
//     snowmanPositions.forEach(pos => {
//       // Body
//       const bodyGeo = new THREE.SphereGeometry(1.2, 16, 16);
//       const body = new THREE.Mesh(bodyGeo, snowMat);
//       body.position.set(pos.x, 1.2, pos.z);
//       body.userData.mapObject = true;
//       scene.add(body);
      
//       // Middle
//       const midGeo = new THREE.SphereGeometry(0.9, 16, 16);
//       const mid = new THREE.Mesh(midGeo, snowMat);
//       mid.position.set(pos.x, 2.8, pos.z);
//       mid.userData.mapObject = true;
//       scene.add(mid);
      
//       // Head
//       const headGeo = new THREE.SphereGeometry(0.6, 16, 16);
//       const head = new THREE.Mesh(headGeo, snowMat);
//       head.position.set(pos.x, 4, pos.z);
//       head.userData.mapObject = true;
//       scene.add(head);
      
//       // Carrot nose
//       const noseMat = new THREE.MeshLambertMaterial({ color: '#ff6600' });
//       const noseGeo = new THREE.ConeGeometry(0.1, 0.5, 8);
//       const nose = new THREE.Mesh(noseGeo, noseMat);
//       nose.position.set(pos.x, 4, pos.z + 0.6);
//       nose.rotation.x = Math.PI / 2;
//       nose.userData.mapObject = true;
//       scene.add(nose);
//     });
    
//     // Build traffic lights
//     buildTrafficLights(scene, trafficLightsRef);
//   }
  
//   function buildCityGridMap(scene, trafficLightsRef) {
//     // Ground
//     const groundGeo = new THREE.PlaneGeometry(400, 400);
//     const groundMat = new THREE.MeshLambertMaterial({ color: '#7ec850' });
//     const ground = new THREE.Mesh(groundGeo, groundMat);
//     ground.rotation.x = -Math.PI / 2;
//     ground.position.y = -0.1;
//     ground.receiveShadow = true;
//     ground.userData.mapObject = true;
//     scene.add(ground);
    
//     const roadMat = new THREE.MeshLambertMaterial({ color: '#404040' });
//     const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
//     const buildingColors = ['#8b8b8b', '#a0a0a0', '#707070', '#b0b0b0', '#606060'];
//     const { ROAD_WIDTH, ROAD_HEIGHT, LIGHT_DISTANCE, LANE_OFFSET } = CONFIG;
    
//     // Create a 3x3 grid of intersections
//     const spacing = 60; // Distance between intersections
//     const offsets = [-spacing, 0, spacing];
    
//     // Horizontal roads
//     offsets.forEach(zOffset => {
//       const roadGeo = new THREE.BoxGeometry(300, ROAD_HEIGHT, ROAD_WIDTH);
//       const road = new THREE.Mesh(roadGeo, roadMat);
//       road.position.set(0, ROAD_HEIGHT / 2, zOffset);
//       road.receiveShadow = true;
//       road.userData.mapObject = true;
//       scene.add(road);
//     });
    
//     // Vertical roads
//     offsets.forEach(xOffset => {
//       const roadGeo = new THREE.BoxGeometry(ROAD_WIDTH, ROAD_HEIGHT, 300);
//       const road = new THREE.Mesh(roadGeo, roadMat);
//       road.position.set(xOffset, ROAD_HEIGHT / 2, 0);
//       road.receiveShadow = true;
//       road.userData.mapObject = true;
//       scene.add(road);
//     });
    
//     // Buildings in each block
//     const blockCenters = [];
//     for (let i = 0; i < 2; i++) {
//       for (let j = 0; j < 2; j++) {
//         blockCenters.push({
//           x: offsets[i] + spacing / 2,
//           z: offsets[j] + spacing / 2
//         });
//         blockCenters.push({
//           x: offsets[i] - spacing / 2,
//           z: offsets[j] - spacing / 2
//         });
//       }
//     }
    
//     blockCenters.forEach((center, idx) => {
//       // Random building in each block
//       const buildingCount = 2 + Math.floor(Math.random() * 3);
//       for (let b = 0; b < buildingCount; b++) {
//         const bWidth = 8 + Math.random() * 10;
//         const bDepth = 8 + Math.random() * 10;
//         const bHeight = 10 + Math.random() * 30;
        
//         const offsetX = (Math.random() - 0.5) * 20;
//         const offsetZ = (Math.random() - 0.5) * 20;
        
//         const colorIdx = Math.floor(Math.random() * buildingColors.length);
//         const buildingMat = new THREE.MeshLambertMaterial({ color: buildingColors[colorIdx] });
//         const buildingGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
//         const building = new THREE.Mesh(buildingGeo, buildingMat);
//         building.position.set(center.x + offsetX, bHeight / 2, center.z + offsetZ);
//         building.castShadow = true;
//         building.receiveShadow = true;
//         building.userData.mapObject = true;
//         scene.add(building);
//       }
//     });
    
//     // Traffic lights at center intersection only (for simplicity)
//     const poleMat = new THREE.MeshLambertMaterial({ color: '#333333' });
//     const housingMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
    
//     const lightConfigs = {
//       'N': { 
//         position: new THREE.Vector3(-LANE_OFFSET - 1.5, 0, -LIGHT_DISTANCE),
//         rotation: Math.PI,
//         label: 'N'
//       },
//       'S': { 
//         position: new THREE.Vector3(LANE_OFFSET + 1.5, 0, LIGHT_DISTANCE),
//         rotation: 0,
//         label: 'S'
//       },
//       'E': { 
//         position: new THREE.Vector3(LIGHT_DISTANCE, 0, -LANE_OFFSET - 1.5),
//         rotation: Math.PI / 2,
//         label: 'E'
//       },
//       'W': { 
//         position: new THREE.Vector3(-LIGHT_DISTANCE, 0, LANE_OFFSET + 1.5),
//         rotation: -Math.PI / 2,
//         label: 'W'
//       }
//     };
    
//     Object.entries(lightConfigs).forEach(([direction, config]) => {
//       const group = new THREE.Group();
//       group.position.copy(config.position);
//       group.rotation.y = config.rotation;
//       group.userData.mapObject = true;
      
//       const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 6, 12);
//       const pole = new THREE.Mesh(poleGeo, poleMat);
//       pole.position.y = 3;
//       pole.castShadow = true;
//       group.add(pole);
      
//       const housingGeo = new THREE.BoxGeometry(1.0, 3.0, 0.8);
//       const housing = new THREE.Mesh(housingGeo, housingMat);
//       housing.position.set(0, 5.5, 0);
//       housing.castShadow = true;
//       group.add(housing);
      
//       const bulbGeo = new THREE.CircleGeometry(0.3, 16);
//       const bulbColors = {
//         red: new THREE.MeshBasicMaterial({ color: '#330000' }),
//         yellow: new THREE.MeshBasicMaterial({ color: '#333300' }),
//         green: new THREE.MeshBasicMaterial({ color: '#003300' })
//       };
      
//       const redBulb = new THREE.Mesh(bulbGeo, bulbColors.red.clone());
//       redBulb.position.set(0, 6.3, 0.41);
//       group.add(redBulb);
      
//       const yellowBulb = new THREE.Mesh(bulbGeo, bulbColors.yellow.clone());
//       yellowBulb.position.set(0, 5.5, 0.41);
//       group.add(yellowBulb);
      
//       const greenBulb = new THREE.Mesh(bulbGeo, bulbColors.green.clone());
//       greenBulb.position.set(0, 4.7, 0.41);
//       group.add(greenBulb);
      
//       const timerCanvas = document.createElement('canvas');
//       timerCanvas.width = 256;
//       timerCanvas.height = 128;
//       const timerTexture = new THREE.CanvasTexture(timerCanvas);
//       const timerMat = new THREE.SpriteMaterial({ map: timerTexture });
//       const timerSprite = new THREE.Sprite(timerMat);
//       timerSprite.position.set(0, 8, 0);
//       timerSprite.scale.set(4, 2, 1);
//       group.add(timerSprite);
      
//       const directionNames = { 'N': 'NORTH', 'S': 'SOUTH', 'E': 'EAST', 'W': 'WEST' };
//       const dirName = directionNames[direction];
      
//       const ctx = timerCanvas.getContext('2d');
//       ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
//       ctx.fillRect(0, 0, 256, 128);
//       ctx.fillStyle = '#ffffff';
//       ctx.font = 'bold 28px Arial';
//       ctx.textAlign = 'center';
//       ctx.textBaseline = 'middle';
//       ctx.fillText(dirName, 128, 35);
//       ctx.font = 'bold 48px Arial';
//       ctx.fillText("--", 128, 88);
//       timerTexture.needsUpdate = true;
      
//       scene.add(group);
      
//       trafficLightsRef[direction] = {
//         group,
//         bulbs: { red: redBulb, yellow: yellowBulb, green: greenBulb },
//         timerCanvas,
//         timerTexture,
//         timerSprite,
//         directionName: dirName,
//         lastCanvasUpdate: 0,
//         lastDisplayedTimer: null,
//         lastColor: null
//       };
//     });
//   }

//   // ==========================================================================
//   //  Update Functions
//   // ==========================================================================
  
//   // ==========================================================================
//   //  Turn State Handlers
//   // ==========================================================================
  
//   function updateEnteringTurn(vehicle, dt) {
//     const multipliers = getDirectionMultipliers(vehicle.Sens);
    
//     // Continue straight movement briefly toward intersection center
//     vehicle.position.x += vehicle.currentSpeed * dt * multipliers.x;
//     vehicle.position.z += vehicle.currentSpeed * dt * multipliers.z;
//     vehicle.currentPosition += vehicle.currentSpeed * dt;
    
//     // Check if traveled enough distance to start rotating
//     const distanceTraveled = vehicle.currentPosition - vehicle.turnStartPosition;
//     if (distanceTraveled >= CONFIG.ENTERING_TURN_DISTANCE) {
//       // Transition to ROTATING state
//       vehicle.turnState = 'ROTATING';
//       vehicle.initialRotation = calculateCurrentRotation(vehicle.Sens);
//       vehicle.targetRotation = calculateTargetRotation(vehicle.Sens, vehicle.turnDirection);
//       vehicle.turnStartPosition = vehicle.currentPosition; // Reset for rotation phase
//     }
//   }
  
//   function updateRotatingTurn(vehicle, dt) {
//     // Calculate turn progress based on distance traveled, not time
//     const distanceTraveled = vehicle.currentPosition - vehicle.turnStartPosition;
    
//     // Adjust rotation distance based on turn direction
//     let rotationDistance = CONFIG.ROTATION_DISTANCE;
//     if (vehicle.turnDirection === 'right') {
//       rotationDistance *= 0.8; // Right turns travel 10% more distance
//     } else if (vehicle.turnDirection === 'left') {
//       rotationDistance *= 0.9; // Left turns travel 10% less distance
//     }
    
//     const turnProgress = Math.min(distanceTraveled / rotationDistance, 1.0);
    
//     // Smooth rotation interpolation
//     vehicle.rotation = THREE.MathUtils.lerp(
//       vehicle.initialRotation,
//       vehicle.targetRotation,
//       turnProgress
//     );
    
//     // Use eased progress for smoother arc movement
//     const easedProgress = Math.sin(turnProgress * Math.PI / 2); // Eased 0-1
    
//     // Get current direction and calculate where we need to go
//     const currentDir = vehicle.Sens;
//     const newDir = getNewDirection(currentDir, vehicle.turnDirection);
    
//     // Get multipliers for both directions
//     const currentMult = getDirectionMultipliers(currentDir);
//     const newMult = getDirectionMultipliers(newDir);
    
//     // Different arc sizes for left vs right turns
//     // Right turn: tight turn (stay close to inner corner)
//     // Left turn: wide turn (swing out to reach lane 2 on far side)
//     let blendedX, blendedZ;
    
//     if (vehicle.turnDirection === 'right') {
//       // Right turn: simple blend (tight turn)
//       blendedX = currentMult.x * (1.5 - easedProgress) + newMult.x * easedProgress;
//       blendedZ = currentMult.z * (1.5 - easedProgress) + newMult.z * easedProgress;
//     } else if (vehicle.turnDirection === 'left') {
//       // Left turn: wider arc - push outward more
//       // Continue in current direction longer, then swing into new direction
//       const earlyProgress = Math.pow(easedProgress, 0.7); // Stay straight longer
//       const lateProgress = Math.pow(easedProgress, 1.5);   // Turn sharper later
      
//       // Blend with asymmetric timing
//       blendedX = currentMult.x * (2 - earlyProgress) + newMult.x * lateProgress;
//       blendedZ = currentMult.z * (2- earlyProgress) + newMult.z * lateProgress;
      
//       // Add extra lateral push outward during the turn to widen the arc
//       const lateralPush = Math.sin(easedProgress * Math.PI) * 0.4; // Peak at 50% progress
//       blendedX += newMult.x * lateralPush;
//       blendedZ += newMult.z * lateralPush;
//     } else {
//       // Straight (shouldn't happen here, but fallback)
//       blendedX = currentMult.x;
//       blendedZ = currentMult.z;
//     }
    
//     // Move along blended path
//     const speedFactor = vehicle.currentSpeed * dt * CONFIG.TURN_SPEED_FACTOR;
//     vehicle.position.x += blendedX * speedFactor;
//     vehicle.position.z += blendedZ * speedFactor;
    
//     // Update currentPosition to match distance traveled
//     vehicle.currentPosition += vehicle.currentSpeed * dt * CONFIG.TURN_SPEED_FACTOR;
    
//     // Transition when rotation complete
//     if (turnProgress >= 1.0) {
//       vehicle.turnState = 'EXITING_TURN';
//       vehicle.Sens = newDir;
//       vehicle.rotation = vehicle.targetRotation;
//       vehicle.turnStartPosition = vehicle.currentPosition; // Reset for exit phase
//       // Switch to Lane 2 after turn (destination lane)
//       vehicle.Voie = 'Lane2';
//     }
//   }
  
//   function updateExitingTurn(vehicle, dt) {
//     const multipliers = getDirectionMultipliers(vehicle.Sens);
    
//     // Continue in new direction
//     vehicle.position.x += vehicle.currentSpeed * dt * multipliers.x;
//     vehicle.position.z += vehicle.currentSpeed * dt * multipliers.z;
//     vehicle.currentPosition += vehicle.currentSpeed * dt;
    
//     // Check if traveled enough distance to complete exit
//     const distanceTraveled = vehicle.currentPosition - vehicle.turnStartPosition;
//     if (distanceTraveled >= CONFIG.EXITING_TURN_DISTANCE) {
//       // Turn complete, return to normal state
//       vehicle.turnState = 'STRAIGHT';
//       vehicle.turnDirection = 'straight';  // Reset for future
//       vehicle.turnStartPosition = 0;
//     }
//   }
  
//   function updateTrafficLights(trafficLightsRef, localLights, elapsed, estimatedServerNow) {
//     if (!localLights) return;
    
//     // Use the passed estimatedServerNow
    
//     const CANVAS_UPDATE_MS = 250; // throttle canvas updates to ~4Hz (since server sends every 1s)
//     const perfNow = performance.now();
    
//     Object.keys(localLights).forEach(direction => {
//       const lightRef = trafficLightsRef[direction];
//       if (!lightRef) return;
      
//       const { bulbs, timerCanvas, timerTexture, directionName } = lightRef;
//       const localLight = localLights[direction];
//       if (!localLight) return;

//       // Only change bulb colors if the color actually changed (avoid per-frame writes)
//       if (lightRef.lastColor !== localLight.color) {
//         // Reset to dim first
//         bulbs.red.material.color.setHex(0x330000);
//         bulbs.yellow.material.color.setHex(0x333300);
//         bulbs.green.material.color.setHex(0x003300);

//         // Light up active bulb
//         if (localLight.color === 'RED') {
//           bulbs.red.material.color.setHex(0xff0000);
//         } else if (localLight.color === 'YELLOW') {
//           bulbs.yellow.material.color.setHex(0xffff00);
//         } else if (localLight.color === 'GREEN') {
//           bulbs.green.material.color.setHex(0x00ff00);
//         }
//         lightRef.lastColor = localLight.color;
//       }
      
//       // Compute remaining time (ms) from expiresAt and the estimated server now
//       const remainingMs = (localLight.expiresAt || 0) - estimatedServerNow;
//       const displayStr = remainingMs > 0 ? (remainingMs / 1000).toFixed(1) + 's' : '0.0s';
      
//       // Throttle canvas / texture updates to reduce GPU upload pressure
//       if (lightRef.lastDisplayedTimer !== displayStr) {
//         if (perfNow - (lightRef.lastCanvasUpdate || 0) > CANVAS_UPDATE_MS) {
//           lightRef.lastDisplayedTimer = displayStr;
//           lightRef.lastCanvasUpdate = perfNow;

//           const ctx = timerCanvas.getContext('2d');
//           ctx.clearRect(0, 0, 256, 128);
//           ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
//           ctx.fillRect(0, 0, 256, 128);

//           // Direction label at top
//           ctx.fillStyle = '#ffffff';
//           ctx.font = 'bold 28px Arial';
//           ctx.textAlign = 'center';
//           ctx.textBaseline = 'middle';
//           ctx.fillText(directionName, 128, 35);

//           // Timer text below (show fractional seconds)
//           ctx.fillStyle = localLight.color === 'RED' ? '#ff4444' : 
//                           localLight.color === 'YELLOW' ? '#ffff44' : '#44ff44';
//           ctx.font = 'bold 48px Arial';
//           ctx.fillText(displayStr, 128, 88);

//           timerTexture.needsUpdate = true;
//         }
//       }
//     });
//   }
  
//   function updateVehiclesPhysics(dt, lightsData, localVehicles, localLights, estimatedServerNow) {
//     if (!localVehicles) return;

//     // Helper to get light color for a direction
//     const getLightColor = (dir) => {
//       const light = localLights[dir];
//       return light ? light.color : 'GREEN';
//     };

//     // Constants
//     const STOP_LINE = 35; // Position where cars should stop
//     const SAFE_DISTANCE = 4; // Minimum distance between cars
//     const STOPPING_BUFFER = 2; // Extra buffer to start stopping
//     const COLLISION_THRESHOLD = 2.5; // Distance threshold for collision detection
//     const TURN_COLLISION_RADIUS = 3.0; // Larger radius for turning vehicles
//     const REMOVAL_DISTANCE = 120; // Remove vehicles that have traveled too far

//     const vehicles = Object.values(localVehicles);

//     // Group by lane (Direction + Lane ID) for collision checking
//     // Skip vehicles currently in turn states other than STRAIGHT
//     const lanes = {};
//     vehicles.forEach(v => {
//       if (v.turnState !== 'STRAIGHT') return;
//       const key = `${v.Sens}-${v.Voie}`;
//       if (!lanes[key]) lanes[key] = [];
//       lanes[key].push(v);
//     });

//     // Sort cars in each lane by position
//     Object.values(lanes).forEach(laneVehicles => {
//       laneVehicles.sort((a, b) => b.currentPosition - a.currentPosition);
//     });

//     // Update each vehicle based on turn state
//     vehicles.forEach(v => {
//       // Handle turn state machine
//       if (v.turnState === 'ENTERING_TURN') {
//         updateEnteringTurn(v, dt);
//         return; // Skip normal physics during turn transitions
//       } else if (v.turnState === 'ROTATING') {
//         updateRotatingTurn(v, dt);
//         return; // Skip normal physics during rotation
//       } else if (v.turnState === 'EXITING_TURN') {
//         updateExitingTurn(v, dt);
//         return; // Skip normal physics during exit
//       }

//       // STRAIGHT state: Normal physics with turn initiation check
//       const lightColor = getLightColor(v.Sens);
//       const light = localLights[v.Sens];
//       const remainingMs = light ? (light.expiresAt - estimatedServerNow) : 0;
//       const remainingSec = remainingMs / 1000;
//       let shouldStop = false;
//       let targetStopPosition = null;

//       // Check if should initiate turn
//       if (shouldInitiateTurn(v)) {
//         v.turnState = 'ENTERING_TURN';
//         v.turnStartPosition = v.currentPosition; // Record where turn started
//         // Will be handled next frame
//         return;
//       }

//       // 1. Check for car ahead
//       const key = `${v.Sens}-${v.Voie}`;
//       const laneVehicles = lanes[key] || [];
//       const myIndex = laneVehicles.indexOf(v);
      
//       if (myIndex > 0) {
//         const carAhead = laneVehicles[myIndex - 1];
//         const distanceToCarAhead = carAhead.currentPosition - v.currentPosition;
        
//         if (distanceToCarAhead < SAFE_DISTANCE + STOPPING_BUFFER) {
//           shouldStop = true;
//           targetStopPosition = carAhead.currentPosition - SAFE_DISTANCE;
//         }
//       }

//       // 2. Traffic Light Logic
//       if (!shouldStop && (lightColor === 'RED' || lightColor === 'YELLOW')) {
//         if (v.currentPosition >= STOP_LINE) {
//           // Already past stop line, continue
//         } else {
//           // Check if should commit to going through
//           const commitTimeThreshold = 1.0;
//           const closeDistanceThreshold = 10;
//           const shouldCommit = remainingSec <= commitTimeThreshold && 
//                                v.currentPosition >= STOP_LINE - closeDistanceThreshold;
          
//           if (!shouldCommit) {
//             const deceleration = 25;
//             const stopDistance = (v.currentSpeed ** 2) / (2 * deceleration);
            
//             if (v.currentPosition + stopDistance >= STOP_LINE - STOPPING_BUFFER) {
//               shouldStop = true;
//               targetStopPosition = STOP_LINE;
//             }
//           }
//         }
//       }

//       // Apply physics
//       if (shouldStop) {
//         const distanceToStop = targetStopPosition ? (targetStopPosition - v.currentPosition) : 0;
        
//         if (distanceToStop < 0.5) {
//           v.currentSpeed = 0;
//         } else {
//           const decelerationRate = distanceToStop < 5 ? 20 : 15;
//           v.currentSpeed = Math.max(0, v.currentSpeed - decelerationRate * dt);
//         }
//         v.waiting = true;
//       } else {
//         const targetSpeed = v.Speed;
//         v.currentSpeed = Math.min(targetSpeed, v.currentSpeed + 15 * dt);
//         v.waiting = false;
//       }

//       // Move vehicle (update position for straight movement)
//       const multipliers = getDirectionMultipliers(v.Sens);
//       v.position.x += v.currentSpeed * dt * multipliers.x;
//       v.position.z += v.currentSpeed * dt * multipliers.z;
//       v.currentPosition += v.currentSpeed * dt;
//     });

//     // Check for collisions - handle both lane-based and spatial collisions
//     const collidedPairs = sceneDataRef.current.collidedPairs;
//     const currentCollidingPairs = new Set();
    
//     // Lane-based collision (straight vehicles)
//     Object.values(lanes).forEach(laneVehicles => {
//       for (let i = 0; i < laneVehicles.length - 1; i++) {
//         const v1 = laneVehicles[i];
//         const v2 = laneVehicles[i + 1];
//         const distance = Math.abs(v1.currentPosition - v2.currentPosition);
        
//         if (distance < COLLISION_THRESHOLD) {
//           const pairId = v1.Id < v2.Id ? `${v1.Id}-${v2.Id}` : `${v2.Id}-${v1.Id}`;
//           currentCollidingPairs.add(pairId);
          
//           if (!collidedPairs.has(pairId)) {
//             collidedPairs.add(pairId);
//             sceneDataRef.current.collisionCount++;
//             setCollisionCount(sceneDataRef.current.collisionCount);
//           }
//         }
//       }
//     });
    
//     // Spatial collision (for turning vehicles)
//     const turningVehicles = vehicles.filter(v => v.turnState === 'ROTATING');
//     if (turningVehicles.length > 0) {
//       for (let i = 0; i < vehicles.length; i++) {
//         for (let j = i + 1; j < vehicles.length; j++) {
//           const v1 = vehicles[i];
//           const v2 = vehicles[j];
          
//           // Skip if both are in lanes (already checked above)
//           if (v1.turnState === 'STRAIGHT' && v2.turnState === 'STRAIGHT') continue;
          
//           // Use circular collision for turning vehicles
//           const dist = Math.sqrt(
//             (v1.position.x - v2.position.x) ** 2 +
//             (v1.position.z - v2.position.z) ** 2
//           );
          
//           const threshold = (v1.turnState === 'ROTATING' || v2.turnState === 'ROTATING') ?
//                            TURN_COLLISION_RADIUS : COLLISION_THRESHOLD;
          
//           if (dist < threshold) {
//             const pairId = v1.Id < v2.Id ? `${v1.Id}-${v2.Id}` : `${v2.Id}-${v1.Id}`;
//             currentCollidingPairs.add(pairId);
            
//             if (!collidedPairs.has(pairId)) {
//               collidedPairs.add(pairId);
//               sceneDataRef.current.collisionCount++;
//               setCollisionCount(sceneDataRef.current.collisionCount);
//             }
//           }
//         }
//       }
//     }
    
//     // Clean up pairs that are no longer colliding
//     collidedPairs.forEach(pairId => {
//       if (!currentCollidingPairs.has(pairId)) {
//         const [id1, id2] = pairId.split('-');
//         if (!localVehicles[id1] || !localVehicles[id2]) {
//           collidedPairs.delete(pairId);
//         }
//       }
//     });

//     // Remove vehicles that have gone too far
//     Object.keys(localVehicles).forEach(id => {
//       const vehicle = localVehicles[id];
//       if (vehicle.currentPosition > STOP_LINE + REMOVAL_DISTANCE) {
//         delete localVehicles[id];
//         collidedPairs.forEach(pairId => {
//           if (pairId.includes(id)) {
//             collidedPairs.delete(pairId);
//           }
//         });
//       }
//     });
//   }

//   function updateVehicleMeshes(localVehicles, scene, vehiclesRef) {
//     if (!localVehicles) return;
    
//     const { LANE_OFFSET, ROAD_HEIGHT } = CONFIG;
//     const presentIds = new Set();
    
//     // Precompute lane offsets
//     const laneOffsets = {
//       1: -LANE_OFFSET * 0.8,
//       2: LANE_OFFSET * 0.8
//     };
    
//     Object.values(localVehicles).forEach(vehicle => {
//       presentIds.add(vehicle.Id);
      
//       let mesh = vehiclesRef[vehicle.Id];
      
//       // Create new mesh if doesn't exist
//       if (!mesh) {
//         // Reuse geometry and materials to reduce allocations
//         if (!sceneDataRef.current.vehicleMeshesShared) {
//           const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
//           sceneDataRef.current.vehicleMeshesShared = {
//             bodyGeo: new THREE.BoxGeometry(1.8, 0.8, 3.5),
//             roofGeo: new THREE.BoxGeometry(1.4, 0.5, 1.8),
//             bodyMats: colors.map(c => new THREE.MeshLambertMaterial({ color: c })),
//             roofMat: new THREE.MeshLambertMaterial({ color: '#333333' })
//           };
//         }
        
//         const colorIndex = vehicle.Id % sceneDataRef.current.vehicleMeshesShared.bodyMats.length;
//         const bodyMat = sceneDataRef.current.vehicleMeshesShared.bodyMats[colorIndex];
//         mesh = new THREE.Mesh(sceneDataRef.current.vehicleMeshesShared.bodyGeo, bodyMat);
//         mesh.castShadow = true;
//         scene.add(mesh);
//         vehiclesRef[vehicle.Id] = mesh;
        
//         // Add simple roof
//         const roof = new THREE.Mesh(sceneDataRef.current.vehicleMeshesShared.roofGeo, sceneDataRef.current.vehicleMeshesShared.roofMat);
//         roof.position.y = 0.6;
//         roof.position.z = -0.3;
//         mesh.add(roof);
//       }
      
//       // Handle fading
//       if (vehicle.fading) {
//         const fadeTime = (performance.now() - vehicle.fadeStart) / 1000;
//         const opacity = Math.max(0, 1 - fadeTime / 2); // Fade over 2 seconds
//         mesh.material.opacity = opacity;
//         mesh.material.transparent = true;
//         if (opacity <= 0) {
//           // Mark for removal
//           vehicle.toRemove = true;
//         }
//       } else {
//         mesh.material.opacity = 1;
//         mesh.material.transparent = false;
//       }
      
//       // Update position and rotation from vehicle state
//       // The physics update already computed position.x and position.z
//       mesh.position.set(vehicle.position.x, CONFIG.VEHICLE_Y, vehicle.position.z);
      
//       // Use smooth rotation during turns, otherwise use direction-based rotation
//       if (vehicle.turnState !== 'STRAIGHT') {
//         mesh.rotation.y = vehicle.rotation;
//       } else {
//         mesh.rotation.y = calculateCurrentRotation(vehicle.Sens);
//       }
      
//       // Visual feedback for waiting (only update if changed)
//       const brakeLightColor = vehicle.waiting ? 0xff0000 : 0x333333;
//       if (mesh.children[0] && mesh.children[0].material.color.getHex() !== brakeLightColor) {
//         mesh.children[0].material.color.setHex(brakeLightColor);
//       }
//     });
    
//     // Remove faded vehicles
//     Object.keys(localVehicles).forEach(id => {
//       if (localVehicles[id].toRemove) {
//         delete localVehicles[id];
//       }
//     });
    
//     // Remove vehicles that are no longer present
//     Object.keys(vehiclesRef).forEach(id => {
//       if (!presentIds.has(parseInt(id))) {
//         const mesh = vehiclesRef[id];
//         scene.remove(mesh);
//         mesh.geometry.dispose();
//         mesh.material.dispose();
//         delete vehiclesRef[id];
//       }
//     });
//   }

//   // ==========================================================================
//   //  Render
//   // ==========================================================================
  
//   return (
//     <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
//       <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
//       {/* Loading Screen Overlay */}
//       {isLoading && (
//         <div style={{
//           position: 'absolute',
//           top: 0,
//           left: 0,
//           right: 0,
//           bottom: 0,
//           background: 'rgba(0, 0, 0, 0.95)',
//           display: 'flex',
//           flexDirection: 'column',
//           justifyContent: 'center',
//           alignItems: 'center',
//           zIndex: 1000,
//           animation: 'fadeIn 0.3s ease'
//         }}>
//           <div style={{
//             fontSize: 48,
//             marginBottom: 30,
//             animation: 'spin 2s linear infinite'
//           }}>
//             {MAP_CONFIGS[currentMap]?.icon || '🚗'}
//           </div>
//           <h2 style={{
//             color: 'white',
//             fontFamily: 'Arial, sans-serif',
//             fontSize: 28,
//             marginBottom: 20
//           }}>
//             Loading {MAP_CONFIGS[currentMap]?.name || 'Map'}...
//           </h2>
//           <div style={{
//             width: 300,
//             height: 8,
//             background: 'rgba(255,255,255,0.2)',
//             borderRadius: 4,
//             overflow: 'hidden'
//           }}>
//             <div style={{
//               width: `${loadingProgress}%`,
//               height: '100%',
//               background: 'linear-gradient(90deg, #3498db, #2ecc71)',
//               borderRadius: 4,
//               transition: 'width 0.2s ease'
//             }} />
//           </div>
//           <div style={{
//             color: 'rgba(255,255,255,0.6)',
//             marginTop: 15,
//             fontFamily: 'Arial, sans-serif',
//             fontSize: 14
//           }}>
//             {loadingProgress}% Complete
//           </div>
//         </div>
//       )}
      
//       {/* Map Selection Sidebar */}
//       <div style={{
//         position: 'absolute',
//         top: 0,
//         left: sidebarOpen ? 0 : -320,
//         width: 320,
//         height: '100%',
//         background: 'rgba(20, 20, 30, 0.98)',
//         boxShadow: sidebarOpen ? '4px 0 20px rgba(0,0,0,0.5)' : 'none',
//         transition: 'left 0.3s ease',
//         zIndex: 100,
//         display: 'flex',
//         flexDirection: 'column',
//         fontFamily: 'Arial, sans-serif'
//       }}>
//         {/* Sidebar Header */}
//         <div style={{
//           padding: '20px',
//           borderBottom: '1px solid rgba(255,255,255,0.1)',
//           display: 'flex',
//           justifyContent: 'space-between',
//           alignItems: 'center'
//         }}>
//           <h2 style={{ color: 'white', margin: 0, fontSize: 20 }}>🗺️ Select Map</h2>
//           <button
//             onClick={() => setSidebarOpen(false)}
//             style={{
//               background: 'none',
//               border: 'none',
//               color: 'white',
//               fontSize: 24,
//               cursor: 'pointer',
//               padding: 5
//             }}
//           >
//             ✕
//           </button>
//         </div>
        
//         {/* Map Options */}
//         <div style={{
//           flex: 1,
//           overflowY: 'auto',
//           padding: '15px'
//         }}>
//           {Object.values(MAP_CONFIGS).map((map) => (
//             <div
//               key={map.id}
//               onClick={() => !isLoading && switchMap(map.id)}
//               style={{
//                 padding: '15px',
//                 marginBottom: '12px',
//                 background: currentMap === map.id 
//                   ? 'linear-gradient(135deg, rgba(52, 152, 219, 0.3), rgba(46, 204, 113, 0.3))'
//                   : 'rgba(255,255,255,0.05)',
//                 borderRadius: 12,
//                 cursor: isLoading ? 'not-allowed' : 'pointer',
//                 border: currentMap === map.id 
//                   ? '2px solid rgba(52, 152, 219, 0.8)'
//                   : '2px solid transparent',
//                 transition: 'all 0.2s ease',
//                 opacity: isLoading ? 0.5 : 1
//               }}
//               onMouseEnter={(e) => {
//                 if (currentMap !== map.id && !isLoading) {
//                   e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
//                   e.currentTarget.style.transform = 'translateX(5px)';
//                 }
//               }}
//               onMouseLeave={(e) => {
//                 if (currentMap !== map.id) {
//                   e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
//                   e.currentTarget.style.transform = 'translateX(0)';
//                 }
//               }}
//             >
//               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
//                 <div style={{
//                   width: 50,
//                   height: 50,
//                   background: map.preview,
//                   borderRadius: 10,
//                   display: 'flex',
//                   alignItems: 'center',
//                   justifyContent: 'center',
//                   fontSize: 24
//                 }}>
//                   {map.icon}
//                 </div>
//                 <div>
//                   <div style={{
//                     color: 'white',
//                     fontWeight: 'bold',
//                     fontSize: 16,
//                     marginBottom: 4
//                   }}>
//                     {map.name}
//                     {currentMap === map.id && (
//                       <span style={{
//                         marginLeft: 8,
//                         fontSize: 12,
//                         background: '#2ecc71',
//                         padding: '2px 8px',
//                         borderRadius: 4
//                       }}>
//                         Active
//                       </span>
//                     )}
//                   </div>
//                   <div style={{
//                     color: 'rgba(255,255,255,0.6)',
//                     fontSize: 12
//                   }}>
//                     {map.description}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
        
//         {/* Sidebar Footer */}
//         <div style={{
//           padding: '15px 20px',
//           borderTop: '1px solid rgba(255,255,255,0.1)',
//           color: 'rgba(255,255,255,0.5)',
//           fontSize: 12,
//           textAlign: 'center'
//         }}>
//           Select a map to switch the simulation environment
//         </div>
//       </div>
      
//       {/* Map Toggle Button (when sidebar is closed) */}
//       {!sidebarOpen && (
//         <button
//           onClick={() => setSidebarOpen(true)}
//           style={{
//             position: 'absolute',
//             top: 80,
//             left: 10,
//             padding: '12px 16px',
//             background: 'rgba(52, 152, 219, 0.9)',
//             color: 'white',
//             border: 'none',
//             borderRadius: 8,
//             fontSize: 14,
//             fontWeight: 'bold',
//             fontFamily: 'Arial, sans-serif',
//             cursor: 'pointer',
//             boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
//             transition: 'all 0.2s ease',
//             display: 'flex',
//             alignItems: 'center',
//             gap: 8,
//             zIndex: 50
//           }}
//           onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
//           onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
//         >
//           🗺️ Maps
//         </button>
//       )}
      
//       {/* Connection status and Pause/Play button */}
//       <div style={{
//         position: 'absolute',
//         top: 10,
//         left: 10,
//         display: 'flex',
//         flexDirection: 'column',
//         gap: 10,
//         zIndex: 40
//       }}>
//         <div style={{
//           padding: '8px 16px',
//           background: connected ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)',
//           color: 'white',
//           borderRadius: 4,
//           fontSize: 14,
//           fontFamily: 'Arial, sans-serif'
//         }}>
//           {connected ? '● Connected' : '○ Disconnected'}
//         </div>
//       </div>
      
//       {/* Controls (bottom left) */}
//       <div style={{
//         position: 'absolute',
//         bottom: 10,
//         left: 10,
//         display: 'flex',
//         flexDirection: 'column',
//         gap: 10,
//         zIndex: 40
//       }}>
//         {/* Pause/Play Button */}
//         <button
//           onClick={() => setPaused(!paused)}
//           style={{
//             padding: '12px 20px',
//             background: paused ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)',
//             color: 'white',
//             border: 'none',
//             borderRadius: 8,
//             fontSize: 16,
//             fontWeight: 'bold',
//             fontFamily: 'Arial, sans-serif',
//             cursor: 'pointer',
//             boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
//             transition: 'all 0.2s ease',
//             display: 'flex',
//             alignItems: 'center',
//             gap: 8
//           }}
//           onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
//           onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
//         >
//           {paused ? '▶ Resume' : '⏸ Pause'}
//         </button>
        
//         {/* Instructions */}
//         <div style={{
//           padding: '8px 12px',
//           background: 'rgba(0, 0, 0, 0.6)',
//           color: 'white',
//           borderRadius: 4,
//           fontSize: 12,
//           fontFamily: 'Arial, sans-serif'
//         }}>
//           Drag to rotate view
//         </div>
//       </div>
      
//       {/* Events panel */}
//       <div style={{
//         position: 'absolute',
//         top: 10,
//         right: 10,
//         display: 'flex',
//         flexDirection: 'column',
//         alignItems: 'flex-end',
//         gap: 10,
//         zIndex: 40
//       }}>
//         {/* Current Map Display */}
//         <div style={{
//           padding: '12px 20px',
//           background: 'rgba(52, 152, 219, 0.9)',
//           color: 'white',
//           borderRadius: 8,
//           fontSize: 16,
//           fontFamily: 'Arial, sans-serif',
//           boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
//           display: 'flex',
//           alignItems: 'center',
//           gap: 10
//         }}>
//           <span style={{ fontSize: 20 }}>{MAP_CONFIGS[currentMap]?.icon}</span>
//           <div>
//             <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.7 }}>Current Map</div>
//             <div style={{ fontWeight: 'bold' }}>{MAP_CONFIGS[currentMap]?.name}</div>
//           </div>
//         </div>
        
//         {/* Traffic State HUD */}
//         <div style={{
//           padding: '12px 20px',
//           background: 'rgba(0, 0, 0, 0.85)',
//           color: 'white',
//           borderRadius: 8,
//           fontSize: 16,
//           fontFamily: 'Arial, sans-serif',
//           borderLeft: `6px solid ${
//             trafficState === 'Slow' ? '#e74c3c' : 
//             trafficState === 'Moderate' ? '#f39c12' : '#2ecc71'
//           }`,
//           boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
//         }}>
//           <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Traffic State</div>
//           <div style={{ fontSize: 24, fontWeight: 'bold' }}>{trafficState}</div>
//         </div>

//         {/* Collision Counter */}
//         <div style={{
//           padding: '12px 20px',
//           background: 'rgba(255, 0, 0, 0.9)',
//           color: 'white',
//           borderRadius: 8,
//           fontSize: 16,
//           fontFamily: 'Arial, sans-serif',
//           boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
//         }}>
//           <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Accidents</div>
//           <div style={{ fontSize: 24, fontWeight: 'bold' }}>{collisionCount}</div>
//         </div>

//         {/* Day Time */}
//         <div style={{
//           padding: '12px 20px',
//           background: 'rgba(0, 0, 0, 0.85)',
//           color: 'white',
//           borderRadius: 8,
//           fontSize: 16,
//           fontFamily: 'Arial, sans-serif',
//           boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
//         }}>
//           <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Time</div>
//           <div style={{ fontSize: 20, fontWeight: 'bold' }}>{Math.floor(dayTime / 3600).toString().padStart(2, '0')}:{Math.floor((dayTime % 3600) / 60).toString().padStart(2, '0')}</div>
//         </div>

//         {/* Active Event HUD */}
//         {activeEvent && (
//           <div style={{
//             padding: '12px 20px',
//             background: 'rgba(192, 57, 43, 0.9)',
//             color: 'white',
//             borderRadius: 8,
//             fontSize: 16,
//             fontFamily: 'Arial, sans-serif',
//             animation: 'pulse 2s infinite',
//             boxShadow: '0 4px 15px rgba(192, 57, 43, 0.4)'
//           }}>
//             <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4 }}>⚠ ACTIVE EVENT</div>
//             <div style={{ fontSize: 20, fontWeight: 'bold' }}>{activeEvent}</div>
//           </div>
//         )}
//       </div>
      
//       {/* CSS Animations */}
//       <style>{`
//         @keyframes fadeIn {
//           from { opacity: 0; }
//           to { opacity: 1; }
//         }
//         @keyframes spin {
//           from { transform: rotate(0deg); }
//           to { transform: rotate(360deg); }
//         }
//         @keyframes pulse {
//           0%, 100% { opacity: 1; }
//           50% { opacity: 0.7; }
//         }
//       `}</style>
//     </div>
//   );
// }