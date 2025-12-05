import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// =============================================================================
//  CONFIGURATION
// =============================================================================

const CONFIG = {
  // Road dimensions
  ROAD_WIDTH: 10,
  ROAD_LENGTH: 120,
  ROAD_HEIGHT: 0.2,
  
  // Traffic lights
  LIGHT_DISTANCE: 14,  // Distance from center
  LANE_OFFSET: 2.5,    // Lane offset from center line
  
  // Vehicle settings
  VEHICLE_Y: 0.5,
};

// Direction mappings for clarity
const DIRECTIONS = {
  N: { index: 0, name: 'North', angle: Math.PI },      // Cars coming FROM south, going north
  E: { index: 1, name: 'East',  angle: Math.PI / 2 },  // Cars coming FROM west, going east
  S: { index: 2, name: 'South', angle: 0 },            // Cars coming FROM north, going south  
  W: { index: 3, name: 'West',  angle: -Math.PI / 2 }  // Cars coming FROM east, going west
};

// =============================================================================
//  MAIN COMPONENT
// =============================================================================

export default function ThreeScene() {
  const mountRef = useRef(null);
  const sceneDataRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    trafficLights: {},   // direction -> {group, bulbs, timerMesh, lastDisplayedTimer}
    vehicles: {},        // id -> mesh
    simulationData: null,
    lastPacketTime: 0,
    localVehicles: {},   // id -> { position, speed, lane, direction, waiting }
    localLights: {}      // direction -> { color, timer, transitioning }
  });
  
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [trafficState, setTrafficState] = useState('Moderate');
  const [activeEvent, setActiveEvent] = useState(null);

  // ==========================================================================
  //  WebSocket Connection
  // ==========================================================================
  
  useEffect(() => {
    const isProd = import.meta.env.PROD;
    const wsUrl = isProd ? import.meta.env.VITE_WS_URL : 'ws://localhost:8000';
    
    let ws = null;
    let reconnectTimeout = null;
    
    const connect = () => {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✓ Connected to simulation server');
        setConnected(true);
        console.log(`${isProd ? 'Production' : 'Development'} mode`)
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          sceneDataRef.current.simulationData = data;
          sceneDataRef.current.lastPacketTime = performance.now();
          
          // Initialize local vehicle state from server data
          if (data.Vehicles) {
            const newLocalVehicles = {};
            data.Vehicles.forEach(v => {
              if (!v.Id || !v.Sens || !['N','S','E','W'].includes(v.Sens)) return; // Skip invalid vehicles
              newLocalVehicles[v.Id] = {
                ...v,
                currentPosition: v.Position || 0,
                currentSpeed: v.Speed || 0,
                waiting: false
              };
            });
            sceneDataRef.current.localVehicles = newLocalVehicles;
          }

          // Initialize local light state from server data
          if (data.Lights) {
            const newLocalLights = {};
            data.Lights.forEach(light => {
              newLocalLights[light.Sens] = {
                color: light.Couleur,
                timer: light.Timer || 0,
                transitioning: false
              };
            });
            sceneDataRef.current.localLights = newLocalLights;
          }

          // Update HUD state
          if (data.Event) {
            setActiveEvent(data.Event.name);
            // Map event to traffic state
            const name = data.Event.name;
            if (['Rush Hour', 'Accident', 'Construction', 'Bad Weather'].includes(name)) {
              setTrafficState('Slow');
            } else if (name === 'Event Nearby') {
              setTrafficState('Moderate'); // High volume but moving
            } else {
              setTrafficState('Moderate');
            }
          } else {
            setActiveEvent(null);
            setTrafficState('Fast'); // No event = normal/fast
          }

          if (data.Events) {
            setEvents(data.Events);
          }
        } catch (error) {
          console.error('Failed to parse data:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('✗ Disconnected from server');
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };
    
    connect();
    
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  // ==========================================================================
  //  Three.js Scene Setup
  // ==========================================================================
  
  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    
    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#87CEEB');  // Sky blue
    
    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(40, 50, 40);
    camera.lookAt(0, 0, 0);
    
    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(30, 60, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);
    
    // Store refs
    sceneDataRef.current.scene = scene;
    sceneDataRef.current.camera = camera;
    sceneDataRef.current.renderer = renderer;
    
    // Build the scene
    buildGround(scene);
    buildRoads(scene);
    buildTrafficLights(scene, sceneDataRef.current.trafficLights);
    
    // Camera controls (drag to rotate)
    let dragging = false, prevX = 0, prevY = 0;
    
    const onPointerDown = (e) => { 
      dragging = true; 
      prevX = e.clientX; 
      prevY = e.clientY; 
    };
    
    const onPointerUp = () => { 
      dragging = false; 
    };
    
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      
      camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.005);
      camera.position.y = Math.max(15, Math.min(100, camera.position.y - dy * 0.1));
      camera.lookAt(0, 0, 0);
    };
    
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointerleave', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    
    // Resize handler
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    
    // Animation loop
    let lastTime = performance.now();
    
    const animate = (now) => {
      requestAnimationFrame(animate);
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      
      // Update from simulation data
      const data = sceneDataRef.current.simulationData;
      if (data) {
        // Calculate delta time for this frame
        const elapsedTotal = (now - sceneDataRef.current.lastPacketTime) / 1000;
        
        updateTrafficLights(data.Lights, sceneDataRef.current.trafficLights, sceneDataRef.current.localLights, elapsedTotal);
        
        // Run physics simulation step
        updateVehiclesPhysics(dt, data.Lights, sceneDataRef.current.localVehicles, sceneDataRef.current.localLights);
        
        // Update meshes based on local physics state
        updateVehicleMeshes(sceneDataRef.current.localVehicles, scene, sceneDataRef.current.vehicles);
      }
      
      renderer.render(scene, camera);
    };
    
    animate(lastTime);
    
    // Cleanup
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointerleave', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // ==========================================================================
  //  Scene Building Functions
  // ==========================================================================
  
  function buildGround(scene) {
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshLambertMaterial({ color: '#7ec850' }); // Grass green
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);
  }
  
  function buildRoads(scene) {
    const roadMat = new THREE.MeshLambertMaterial({ color: '#404040' });
    const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    
    const { ROAD_WIDTH, ROAD_LENGTH, ROAD_HEIGHT } = CONFIG;
    
    // Horizontal road (East-West)
    const hRoadGeo = new THREE.BoxGeometry(ROAD_LENGTH, ROAD_HEIGHT, ROAD_WIDTH);
    const hRoad = new THREE.Mesh(hRoadGeo, roadMat);
    hRoad.position.y = ROAD_HEIGHT / 2;
    hRoad.receiveShadow = true;
    scene.add(hRoad);
    
    // Vertical road (North-South)
    const vRoadGeo = new THREE.BoxGeometry(ROAD_WIDTH, ROAD_HEIGHT, ROAD_LENGTH);
    const vRoad = new THREE.Mesh(vRoadGeo, roadMat);
    vRoad.position.y = ROAD_HEIGHT / 2;
    vRoad.receiveShadow = true;
    scene.add(vRoad);
    
    // Center line markings (dashed)
    const dashGeo = new THREE.BoxGeometry(3, 0.05, 0.3);
    for (let i = -25; i <= 25; i += 4) {
      // Horizontal dashes
      const hDash = new THREE.Mesh(dashGeo, lineMat);
      hDash.position.set(i * 2, ROAD_HEIGHT + 0.05, 0);
      scene.add(hDash);
    }
    
    const vDashGeo = new THREE.BoxGeometry(0.3, 0.05, 3);
    for (let i = -25; i <= 25; i += 4) {
      // Vertical dashes
      const vDash = new THREE.Mesh(vDashGeo, lineMat);
      vDash.position.set(0, ROAD_HEIGHT + 0.05, i * 2);
      scene.add(vDash);
    }
  }
  function buildTrafficLights(scene, trafficLightsRef) {
    const { LIGHT_DISTANCE, LANE_OFFSET, ROAD_HEIGHT } = CONFIG;
    
    // Traffic light positions and rotations
    // Each light faces TOWARD the incoming traffic (i.e., toward where cars are coming from)
    const lightConfigs = {
      // North light: positioned at north side, faces SOUTH (toward cars coming from south)
      'N': { 
        position: new THREE.Vector3(-LANE_OFFSET - 1.5, 0, -LIGHT_DISTANCE),
        rotation: Math.PI,  // Faces south
        label: 'N'
      },
      // South light: positioned at south side, faces NORTH (toward cars coming from north)
      'S': { 
        position: new THREE.Vector3(LANE_OFFSET + 1.5, 0, LIGHT_DISTANCE),
        rotation: 0,  // Faces north
        label: 'S'
      },
      // East light: positioned at east side, faces EAST (toward cars coming from east)
      'E': { 
        position: new THREE.Vector3(LIGHT_DISTANCE, 0, -LANE_OFFSET - 1.5),
        rotation: Math.PI / 2,  // Faces East
        label: 'E'
      },
      // West light: positioned at west side, faces WEST (toward cars coming from west)
      'W': { 
        position: new THREE.Vector3(-LIGHT_DISTANCE, 0, LANE_OFFSET + 1.5),
        rotation: -Math.PI / 2,  // Faces West
        label: 'W'
      }
    };
    
    const poleMat = new THREE.MeshLambertMaterial({ color: '#333333' });
    const housingMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
    
    Object.entries(lightConfigs).forEach(([direction, config]) => {
      const group = new THREE.Group();
      group.position.copy(config.position);
      group.rotation.y = config.rotation;
      
      // Pole
      const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 6, 12);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 3;
      pole.castShadow = true;
      group.add(pole);
      
      // Light housing
      const housingGeo = new THREE.BoxGeometry(1.0, 3.0, 0.8);
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(0, 5.5, 0);
      housing.castShadow = true;
      group.add(housing);
      
      // Light bulbs (Red, Yellow, Green from top to bottom)
      const bulbGeo = new THREE.CircleGeometry(0.3, 16);
      const bulbColors = {
        red: new THREE.MeshBasicMaterial({ color: '#330000' }),
        yellow: new THREE.MeshBasicMaterial({ color: '#333300' }),
        green: new THREE.MeshBasicMaterial({ color: '#003300' })
      };
      
      const redBulb = new THREE.Mesh(bulbGeo, bulbColors.red.clone());
      redBulb.position.set(0, 6.3, 0.41);
      group.add(redBulb);
      
      const yellowBulb = new THREE.Mesh(bulbGeo, bulbColors.yellow.clone());
      yellowBulb.position.set(0, 5.5, 0.41);
      group.add(yellowBulb);
      
      const greenBulb = new THREE.Mesh(bulbGeo, bulbColors.green.clone());
      greenBulb.position.set(0, 4.7, 0.41);
      group.add(greenBulb);
      
      // Timer and Direction label display (text sprite)
      const timerCanvas = document.createElement('canvas');
      timerCanvas.width = 256;
      timerCanvas.height = 128;
      const timerTexture = new THREE.CanvasTexture(timerCanvas);
      const timerMat = new THREE.SpriteMaterial({ map: timerTexture });
      const timerSprite = new THREE.Sprite(timerMat);
      timerSprite.position.set(0, 8, 0);
      timerSprite.scale.set(4, 2, 1);
      group.add(timerSprite);
      
      // Direction names
      const directionNames = { 'N': 'NORTH', 'S': 'SOUTH', 'E': 'EAST', 'W': 'WEST' };
      const dirName = directionNames[direction];

      // Initial draw
      const ctx = timerCanvas.getContext('2d');
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dirName, 128, 35);
      ctx.font = 'bold 48px Arial';
      ctx.fillText("--", 128, 88); // Placeholder for timer
      timerTexture.needsUpdate = true;
      
      scene.add(group);
      
      // Store reference
      trafficLightsRef[direction] = {
        group,
        bulbs: { red: redBulb, yellow: yellowBulb, green: greenBulb },
        timerCanvas,
        timerTexture,
        timerSprite,
        directionName: dirName
      };
    });
  }

  // ==========================================================================
  //  Update Functions
  // ==========================================================================
  function updateTrafficLights(lightsData, trafficLightsRef, localLights, elapsed) {
    if (!lightsData || !Array.isArray(lightsData)) return;
    
    lightsData.forEach(light => {
      const direction = light.Sens;
      const lightRef = trafficLightsRef[direction];
      if (!lightRef) return;
      
      const { bulbs, timerCanvas, timerTexture, directionName } = lightRef;
      
      // Update local light state from server data (Python handles state transitions)
      localLights[direction] = {
        color: light.Couleur,
        timer: light.Timer || 0,
        transitioning: false
      };
      
      const localLight = localLights[direction];
      
      // Reset all bulbs to dim
      bulbs.red.material.color.setHex(0x330000);
      bulbs.yellow.material.color.setHex(0x333300);
      bulbs.green.material.color.setHex(0x003300);
      
      // Light up active bulb
      if (localLight.color === 'RED') {
        bulbs.red.material.color.setHex(0xff0000);
      } else if (localLight.color === 'YELLOW') {
        bulbs.yellow.material.color.setHex(0xffff00);
      } else if (localLight.color === 'GREEN') {
        bulbs.green.material.color.setHex(0x00ff00);
      }
      
      // Update timer and direction display
      const displayTime = Math.ceil(localLight.timer);
      
      if (lightRef.lastDisplayedTimer !== displayTime) {
        lightRef.lastDisplayedTimer = displayTime;
        
        const ctx = timerCanvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 128);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, 256, 128);
        
        // Direction label at top
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(directionName, 128, 35);
        
        // Timer text below
        ctx.fillStyle = localLight.color === 'RED' ? '#ff4444' : 
                        localLight.color === 'YELLOW' ? '#ffff44' : '#44ff44';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(displayTime.toString() + 's', 128, 88);
        
        timerTexture.needsUpdate = true;
      }
    });
  }
  
  function updateVehiclesPhysics(dt, lightsData, localVehicles, localLights) {
    if (!localVehicles) return;

    // Helper to get light color for a direction
    const getLightColor = (dir) => {
      const light = localLights[dir];
      return light ? light.color : 'GREEN';
    };

    // Stop line is right before the intersection (where traffic lights are at position 14)
    // Vehicles should stop at position ~36 (which maps to z = 50 - 36 = 14 for N direction)
    const STOP_LINE = 36; // Position where cars should stop (just before the traffic light)
    const SAFE_DISTANCE = 5; // Minimum distance between cars

    // Convert object to array for sorting
    const vehicles = Object.values(localVehicles);

    // Group by lane (Direction + Lane ID) to check for cars ahead
    const lanes = {};
    vehicles.forEach(v => {
      const key = `${v.Sens}-${v.Voie}`;
      if (!lanes[key]) lanes[key] = [];
      lanes[key].push(v);
    });

    // Sort cars in each lane by position (descending = furthest ahead)
    Object.values(lanes).forEach(laneVehicles => {
      laneVehicles.sort((a, b) => b.currentPosition - a.currentPosition);
    });

    // Update each vehicle
    vehicles.forEach(v => {
      const lightColor = getLightColor(v.Sens);
      let shouldStop = false;

      // 1. Traffic Light Logic
      // If light is RED or YELLOW, and we haven't passed the stop line yet, stop
      if ((lightColor === 'RED' || lightColor === 'YELLOW') && 
          v.currentPosition < STOP_LINE) {
        shouldStop = true;
      }

      // 2. Collision Avoidance (Car ahead)
      const key = `${v.Sens}-${v.Voie}`;
      const laneVehicles = lanes[key];
      const myIndex = laneVehicles.indexOf(v);
      
      if (myIndex > 0) {
        const carAhead = laneVehicles[myIndex - 1];
        const distanceToCarAhead = carAhead.currentPosition - v.currentPosition;
        
        if (distanceToCarAhead < SAFE_DISTANCE) {
          shouldStop = true;
        }
      }

      // Apply physics
      if (shouldStop) {
        // Decelerate smoothly
        v.currentSpeed = Math.max(0, v.currentSpeed - 15 * dt);
        v.waiting = true;
      } else {
        // Accelerate to target speed
        v.currentSpeed = Math.min(v.Speed, v.currentSpeed + 8 * dt);
        v.waiting = false;
      }

      // Move
      v.currentPosition += v.currentSpeed * dt;
    });
  }

  function updateVehicleMeshes(localVehicles, scene, vehiclesRef) {
    if (!localVehicles) return;
    
    const { LANE_OFFSET, ROAD_HEIGHT } = CONFIG;
    const presentIds = new Set();
    
    Object.values(localVehicles).forEach(vehicle => {
      presentIds.add(vehicle.Id);
      
      let mesh = vehiclesRef[vehicle.Id];
      
      // Create new mesh if doesn't exist
      if (!mesh) {
        const bodyGeo = new THREE.BoxGeometry(1.8, 0.8, 3.5);
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
        const id = vehicle.Id || 0;
        const color = colors[id % colors.length];
        const bodyMat = new THREE.MeshLambertMaterial({ color });
        mesh = new THREE.Mesh(bodyGeo, bodyMat);
        mesh.castShadow = true;
        scene.add(mesh);
        vehiclesRef[vehicle.Id] = mesh;
        
        // Add simple roof
        const roofGeo = new THREE.BoxGeometry(1.4, 0.5, 1.8);
        const roofMat = new THREE.MeshLambertMaterial({ color: '#333333' });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 0.6;
        roof.position.z = -0.3;
        mesh.add(roof);
      }
      
      // Calculate position based on direction and lane
      const dir = vehicle.Sens;
      const lane = vehicle.Voie.includes('1') ? 1 : 2;
      const currentPos = vehicle.currentPosition;
      
      const laneOff = (lane === 1 ? -LANE_OFFSET : LANE_OFFSET) * 0.8;
      
      let x = 0, z = 0, rotY = 0;
      
      // Position based on direction
      switch (dir) {
        case 'N': // Going north (coming from south)
          x = -laneOff;
          z = 50 - currentPos;
          rotY = Math.PI;
          break;
        case 'S': // Going south (coming from north)
          x = laneOff;
          z = -50 + currentPos;
          rotY = 0;
          break;
        case 'E': // Going east (coming from west)
          x = -50 + currentPos;
          z = -laneOff;
          rotY = Math.PI / 2;
          break;
        case 'W': // Going west (coming from east)
          x = 50 - currentPos;
          z = laneOff;
          rotY = -Math.PI / 2;
          break;
        default:
          // Invalid direction, place at center
          x = 0;
          z = 0;
          rotY = 0;
          break;
      }
      
      mesh.position.set(x, CONFIG.VEHICLE_Y, z);
      mesh.rotation.y = rotY;
      
      // Visual feedback for waiting
      if (vehicle.waiting) {
        mesh.children[0]?.material?.color?.setHex(0xff0000); // Brake lights
      } else {
        mesh.children[0]?.material?.color?.setHex(0x333333);
      }
    });
    
    // Remove vehicles that are no longer present
    Object.keys(vehiclesRef).forEach(id => {
      if (!presentIds.has(parseInt(id))) {
        const mesh = vehiclesRef[id];
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        delete vehiclesRef[id];
      }
    });
  }

  // ==========================================================================
  //  Render
  // ==========================================================================
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Connection status */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        padding: '8px 16px',
        background: connected ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)',
        color: 'white',
        borderRadius: 4,
        fontSize: 14,
        fontFamily: 'Arial, sans-serif'
      }}>
        {connected ? '● Connected' : '○ Disconnected'}
      </div>
      
      {/* Events panel */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10
      }}>
        {/* Traffic State HUD */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          borderRadius: 8,
          fontSize: 16,
          fontFamily: 'Arial, sans-serif',
          borderLeft: `6px solid ${
            trafficState === 'Slow' ? '#e74c3c' : 
            trafficState === 'Moderate' ? '#f39c12' : '#2ecc71'
          }`,
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Traffic State</div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{trafficState}</div>
        </div>

        {/* Active Event HUD */}
        {activeEvent && (
          <div style={{
            padding: '12px 20px',
            background: 'rgba(192, 57, 43, 0.9)',
            color: 'white',
            borderRadius: 8,
            fontSize: 16,
            fontFamily: 'Arial, sans-serif',
            animation: 'pulse 2s infinite',
            boxShadow: '0 4px 15px rgba(192, 57, 43, 0.4)'
          }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4 }}>⚠ ACTIVE EVENT</div>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{activeEvent}</div>
          </div>
        )}
      </div>
      
      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        borderRadius: 4,
        fontSize: 12,
        fontFamily: 'Arial, sans-serif'
      }}>
        Drag to rotate view
      </div>
    </div>
  );
}
