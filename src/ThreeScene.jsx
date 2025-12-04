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
  
  // Roundabout
  ROUNDABOUT_RADIUS: 6,
  
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
    lastPacketTime: 0
  });
  
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);

  // ==========================================================================
  //  WebSocket Connection
  // ==========================================================================
  
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    let ws = null;
    let reconnectTimeout = null;
    
    const connect = () => {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✓ Connected to simulation server');
        setConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          sceneDataRef.current.simulationData = data;
          sceneDataRef.current.lastPacketTime = performance.now();
          
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
    buildRoundabout(scene);
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
        const elapsed = (now - sceneDataRef.current.lastPacketTime) / 1000;
        updateTrafficLights(data.Lights, sceneDataRef.current.trafficLights, elapsed);
        updateVehicles(data.Vehicles, scene, sceneDataRef.current.vehicles, elapsed);
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
      if (Math.abs(i) < 6) continue; // Skip roundabout area
      // Horizontal dashes
      const hDash = new THREE.Mesh(dashGeo, lineMat);
      hDash.position.set(i * 2, ROAD_HEIGHT + 0.05, 0);
      scene.add(hDash);
    }
    
    const vDashGeo = new THREE.BoxGeometry(0.3, 0.05, 3);
    for (let i = -25; i <= 25; i += 4) {
      if (Math.abs(i) < 6) continue;
      // Vertical dashes
      const vDash = new THREE.Mesh(vDashGeo, lineMat);
      vDash.position.set(0, ROAD_HEIGHT + 0.05, i * 2);
      scene.add(vDash);
    }
  }
  
  function buildRoundabout(scene) {
    const { ROUNDABOUT_RADIUS, ROAD_HEIGHT } = CONFIG;
    
    // Main roundabout island
    const islandGeo = new THREE.CylinderGeometry(ROUNDABOUT_RADIUS, ROUNDABOUT_RADIUS, 0.8, 48);
    const islandMat = new THREE.MeshLambertMaterial({ color: '#90EE90' }); // Light green
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = ROAD_HEIGHT + 0.4;
    island.castShadow = true;
    island.receiveShadow = true;
    scene.add(island);
    
    // Curb ring
    const curbGeo = new THREE.TorusGeometry(ROUNDABOUT_RADIUS + 0.5, 0.3, 16, 48);
    const curbMat = new THREE.MeshLambertMaterial({ color: '#808080' });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.rotation.x = Math.PI / 2;
    curb.position.y = ROAD_HEIGHT + 0.3;
    scene.add(curb);
    
    // Decorative center tree
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 3, 12);
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#8B4513' });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = ROAD_HEIGHT + 2.2;
    trunk.castShadow = true;
    scene.add(trunk);
    
    const foliageGeo = new THREE.SphereGeometry(2.5, 16, 12);
    const foliageMat = new THREE.MeshLambertMaterial({ color: '#228B22' });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.y = ROAD_HEIGHT + 5;
    foliage.castShadow = true;
    scene.add(foliage);
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
  function updateTrafficLights(lightsData, trafficLightsRef, elapsed) {
    if (!lightsData || !Array.isArray(lightsData)) return;
    
    lightsData.forEach(light => {
      const direction = light.Sens;
      const lightRef = trafficLightsRef[direction];
      if (!lightRef) return;
      
      const { bulbs, timerCanvas, timerTexture, directionName } = lightRef;
      
      // Reset all bulbs to dim
      bulbs.red.material.color.setHex(0x330000);
      bulbs.yellow.material.color.setHex(0x333300);
      bulbs.green.material.color.setHex(0x003300);
      
      // Light up active bulb
      if (light.Couleur === 'RED') {
        bulbs.red.material.color.setHex(0xff0000);
      } else if (light.Couleur === 'YELLOW') {
        bulbs.yellow.material.color.setHex(0xffff00);
      } else if (light.Couleur === 'GREEN') {
        bulbs.green.material.color.setHex(0x00ff00);
      }
      
      // Update timer and direction display
      // Only update texture if the integer second has changed to avoid performance issues
      const timeRemaining = Math.max(0, (light.Timer || 0) - elapsed);
      const displayTime = Math.ceil(timeRemaining);
      
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
        ctx.fillStyle = light.Couleur === 'RED' ? '#ff4444' : 
                        light.Couleur === 'YELLOW' ? '#ffff44' : '#44ff44';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(displayTime.toString() + 's', 128, 88);
        
        timerTexture.needsUpdate = true;
      }
    });
  }
  
  function updateVehicles(vehiclesData, scene, vehiclesRef, elapsed) {
    if (!vehiclesData || !Array.isArray(vehiclesData)) return;
    
    const { LANE_OFFSET, ROAD_HEIGHT } = CONFIG;
    
    // Track which vehicles are still present
    const presentIds = new Set();
    
    vehiclesData.forEach(vehicle => {
      presentIds.add(vehicle.Id);
      
      let mesh = vehiclesRef[vehicle.Id];
      
      // Create new mesh if doesn't exist
      if (!mesh) {
        const bodyGeo = new THREE.BoxGeometry(1.8, 0.8, 3.5);
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
        const color = colors[vehicle.Id % colors.length];
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
      // Extrapolate position based on speed and elapsed time
      const currentPos = vehicle.Position + (vehicle.Speed * elapsed);
      
      const laneOff = (lane === 1 ? -LANE_OFFSET : LANE_OFFSET) * 0.8;
      
      let x = 0, z = 0, rotY = 0;
      
      // Position based on direction
      // Position is distance along the road: negative = approaching, positive = past intersection
      switch (dir) {
        case 'N': // Going north (coming from south)
          x = -laneOff;  // Right side of road
          z = 50 - currentPos;  // Start from south, move north (z decreases)
          rotY = Math.PI; // Face north
          break;
        case 'S': // Going south (coming from north)
          x = laneOff;   // Right side of road
          z = -50 + currentPos; // Start from north, move south (z increases)
          rotY = 0;      // Face south
          break;
        case 'E': // Going east (coming from west)
          x = -50 + currentPos; // Start from west, move east (x increases)
          z = -laneOff;  // Right side of road
          rotY = Math.PI / 2; // Face east
          break;
        case 'W': // Going west (coming from east)
          x = 50 - currentPos;  // Start from east, move west (x decreases)
          z = laneOff;   // Right side of road
          rotY = -Math.PI / 2; // Face west
          break;
      }
      
      mesh.position.set(x, CONFIG.VEHICLE_Y, z);
      mesh.rotation.y = rotY;
      
      // Visual feedback for waiting
      if (vehicle.Waiting) {
        mesh.children[0]?.material?.color?.setHex(0xff0000); // Brake lights
      } else {
        mesh.children[0]?.material?.color?.setHex(0x333333);
      }
    });
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
      {events.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          padding: 12,
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          borderRadius: 8,
          fontSize: 13,
          fontFamily: 'Arial, sans-serif',
          maxWidth: 250
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#f39c12' }}>
            Active Events
          </div>
          {events.map((event, i) => (
            <div key={i} style={{ 
              marginBottom: 6, 
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 4
            }}>
              <div style={{ fontWeight: 'bold', color: '#3498db' }}>{event.name}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{event.description}</div>
              <div style={{ fontSize: 11, color: '#f39c12' }}>
                Time: {Math.ceil(event.time_remaining)}s | 
                Flow: {event.flux_multiplier > 1 ? '+' : ''}{Math.round((event.flux_multiplier - 1) * 100)}%
              </div>
            </div>
          ))}
        </div>
      )}
      
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
