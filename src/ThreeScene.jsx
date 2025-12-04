import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Configuration constants at top for server-side tuning
const CAR_CONFIG = {
  SPEED: 12,              // units per second
  SPAWN_DISTANCE: -20,    // start position behind road entry
  ROAD_LENGTH: 100,       // total distance before respawn
  LANE_OFFSET: 1.8,       // distance from road center
  ROUNDABOUT_RADIUS: 4,   // radius for roundabout navigation
  APPROACH_DISTANCE: 40,  // distance before entering roundabout
  EXIT_DISTANCE: 40       // distance after exiting roundabout
};

// Car with roundabout navigation
class Car {
  constructor(entryRoad, exitRoad, color, startDelay = 0) {
    // entryRoad, exitRoad: 0=north, 1=east, 2=south, 3=west
    this.entryRoad = entryRoad;
    this.exitRoad = exitRoad;
    this.speed = CAR_CONFIG.SPEED;
    this.distance = -startDelay * this.speed;
    this.state = 'approach'; // 'approach', 'roundabout', 'exit'
    
    const bodyGeo = new THREE.BoxGeometry(1.5, 0.6, 2.2);
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.castShadow = true;
  }
  
  update(dt) {
    this.distance += this.speed * dt;
    
    let x = 0, z = 0, rot = 0;
    const radius = CAR_CONFIG.ROUNDABOUT_RADIUS;
    const offset = CAR_CONFIG.LANE_OFFSET;
    
    if (this.state === 'approach') {
      const approachDist = CAR_CONFIG.APPROACH_DISTANCE;
      
      if (this.distance < approachDist) {
        const progress = this.distance;
        
        // Simple straight line approach to roundabout edge
        if (this.entryRoad === 0) {      // north (coming from south, z decreases)
          x = -offset;
          z = 50 - progress;
          rot = Math.PI;
        } else if (this.entryRoad === 1) { // east (coming from west, x increases)
          x = -50 + progress;
          z = -offset;
          rot = Math.PI / 2;
        } else if (this.entryRoad === 2) { // south (coming from north, z increases)
          x = offset;
          z = -50 + progress;
          rot = 0;
        } else {                          // west (coming from east, x decreases)
          x = 50 - progress;
          z = offset;
          rot = -Math.PI / 2;
        }
      } else {
        this.state = 'roundabout';
        this.distance = 0;
      }
    }
    
    else if (this.state === 'roundabout') {
      // Entry angles for each road (where they meet the roundabout)
      const entryAngles = [-Math.PI/2, Math.PI, Math.PI/2, 0]; // N, E, S, W
      const entryAngle = entryAngles[this.entryRoad];
      const exitAngle = entryAngles[this.exitRoad];
      
      // Calculate arc to travel (always clockwise/right turn)
      let arcAngle = exitAngle - entryAngle;
      if (arcAngle <= 0) arcAngle += Math.PI * 2;
      
      const arcLength = radius * arcAngle;
      
      if (this.distance < arcLength) {
        const currentAngle = entryAngle + (this.distance / radius);
        x = Math.cos(currentAngle) * radius;
        z = Math.sin(currentAngle) * radius;
        rot = currentAngle + Math.PI / 2; // tangent to circle
      } else {
        this.state = 'exit';
        this.distance = 0;
      }
    }
    
    else if (this.state === 'exit') {
      const exitDist = CAR_CONFIG.EXIT_DISTANCE;
      
      if (this.distance < exitDist) {
        const progress = this.distance;
        
        // Simple straight line exit from roundabout
        if (this.exitRoad === 0) {      // north (leaving toward north, z decreases)
          x = -offset;
          z = -radius - progress;
          rot = Math.PI;
        } else if (this.exitRoad === 1) { // east (leaving toward east, x increases)
          x = radius + progress;
          z = -offset;
          rot = Math.PI / 2;
        } else if (this.exitRoad === 2) { // south (leaving toward south, z increases)
          x = offset;
          z = radius + progress;
          rot = 0;
        } else {                          // west (leaving toward west, x decreases)
          x = -radius - progress;
          z = offset;
          rot = -Math.PI / 2;
        }
      } else {
        // Respawn with new random roads
        this.state = 'approach';
        this.distance = CAR_CONFIG.SPAWN_DISTANCE;
        this.entryRoad = Math.floor(Math.random() * 4);
        do {
          this.exitRoad = Math.floor(Math.random() * 4);
        } while (this.exitRoad === this.entryRoad);
      }
    }
    
    this.mesh.position.set(x, 0.5, z);
    this.mesh.rotation.y = rot;
  }
}

export default function ThreeScene() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const carsRef = useRef([]);
  const trafficLightsRef = useRef([]);
  const [simulationData, setSimulationData] = useState({});

  // Connect to Python WebSocket for real-time simulation data
  useEffect(() => {
    // Use environment variable for WebSocket URL, fallback to localhost for dev
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to Python simulation');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSimulationData(data);
        // Log events for debugging
        if (data.Events && data.Events.length > 0) {
          console.log('Active Events:', data.Events);
        }
      } catch (error) {
        console.error('Failed to parse simulation data:', error);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from Python simulation');
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        console.log('Attempting to reconnect...');
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#c8f7ff');

  // Slightly narrower FOV to reduce perspective distortion
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 10000);
  camera.position.set(25, 32, 25);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(25, 50, 10);
    sun.castShadow = true;
    scene.add(sun);

    const palette = {
      road: new THREE.MeshLambertMaterial({ 
        color: '#555b6e',
        depthTest: true,
        depthWrite: true
      }),
      line: new THREE.MeshBasicMaterial({ 
        color: '#fff',
        depthTest: false // always on top
      }),
      grass: new THREE.MeshLambertMaterial({ color: '#90e39a' }),
      roundabout: new THREE.MeshLambertMaterial({ color: '#ffda79' }),
      pole: new THREE.MeshLambertMaterial({ color: '#4f4f4f' }),
      housing: new THREE.MeshLambertMaterial({ color: '#ff9ecd' }),
    };

    // Ground
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const ground = new THREE.Mesh(groundGeo, palette.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05; // slightly below roads
    ground.receiveShadow = true;
    scene.add(ground);

    // Roads: use BoxGeometry for solid roads
    const roadWidth = 10;
    const roadLength = 120;
    const roadHeight = 0.2;
    
    // Horizontal road (East-West)
    const horizontalRoadGeo = new THREE.BoxGeometry(roadLength, roadHeight, roadWidth);
    const horizontalRoad = new THREE.Mesh(horizontalRoadGeo, palette.road);
    horizontalRoad.position.y = roadHeight / 2;
    horizontalRoad.receiveShadow = true;
    horizontalRoad.castShadow = true;
    scene.add(horizontalRoad);
    
    // Vertical road (North-South)
    const verticalRoadGeo = new THREE.BoxGeometry(roadWidth, roadHeight, roadLength);
    const verticalRoad = new THREE.Mesh(verticalRoadGeo, palette.road);
    verticalRoad.position.y = roadHeight / 2;
    verticalRoad.receiveShadow = true;
    verticalRoad.castShadow = true;
    scene.add(verticalRoad);

    // Road lane markings (dashed center lines on top of roads)
    function createDashedLine(length, dashCount, isVertical = false) {
      const group = new THREE.Group();
      const dashGeo = new THREE.BoxGeometry(isVertical ? 0.4 : 2.5, 0.08, isVertical ? 2.5 : 0.4);
      for (let i = 0; i < dashCount; i++) {
        const dash = new THREE.Mesh(dashGeo, palette.line);
        const pos = -length / 2 + (i + 0.5) * (length / dashCount);
        if (isVertical) {
          dash.position.set(0, roadHeight + 0.05, pos);
        } else {
          dash.position.set(pos, roadHeight + 0.05, 0);
        }
        group.add(dash);
      }
      return group;
    }
    const horizontalLine = createDashedLine(roadLength, 35, false);
    scene.add(horizontalLine);
    const verticalLine = createDashedLine(roadLength, 35, true);
    scene.add(verticalLine);
    
    // Roundabout (update radius to match CAR_CONFIG)
    const roundaboutRadius = CAR_CONFIG.ROUNDABOUT_RADIUS;
    const roundaboutGeo = new THREE.CylinderGeometry(roundaboutRadius, roundaboutRadius, 1.2, 48);
    const roundaboutMesh = new THREE.Mesh(roundaboutGeo, palette.roundabout);
    roundaboutMesh.position.y = roadHeight + 0.6;
    roundaboutMesh.castShadow = true;
    roundaboutMesh.receiveShadow = true;
    scene.add(roundaboutMesh);

    const rimGeo = new THREE.TorusGeometry(roundaboutRadius + 0.6, 0.4, 16, 64);
    const rimMat = new THREE.MeshLambertMaterial({ color: '#ff6f91' });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = roadHeight + 1.2;
    scene.add(rim);
    scene.add(rim);

    // Tree decoration
    const trunkGeo = new THREE.CylinderGeometry(0.6, 0.6, 3, 12);
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#b57f50' });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = roadHeight + 2.5;
    trunk.castShadow = true;
    scene.add(trunk);
    const foliageGeo = new THREE.SphereGeometry(2.2, 24, 16);
    const foliageMat = new THREE.MeshLambertMaterial({ color: '#6ee7b7' });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.y = roadHeight + 4.5;
    foliage.castShadow = true;
    scene.add(foliage);

    // Traffic lights - positioned at each road entry, facing inward toward center
    const trafficLights = [];
    function createTrafficLight(roadIndex) {
      // roadIndex: 0=north, 1=east, 2=south, 3=west
      const group = new THREE.Group();
      const distance = roundaboutRadius + 6;
      
      // Position and rotation for each road
      const configs = [
        { x: -CAR_CONFIG.LANE_OFFSET - 2, z: distance, rotY: 0 },           // north - faces south
        { x: distance, z: -CAR_CONFIG.LANE_OFFSET - 2, rotY: -Math.PI/2 }, // east - faces west
        { x: CAR_CONFIG.LANE_OFFSET + 2, z: -distance, rotY: Math.PI },    // south - faces north
        { x: -distance, z: CAR_CONFIG.LANE_OFFSET + 2, rotY: Math.PI/2 }   // west - faces east
      ];
      
      const config = configs[roadIndex];
      group.position.set(config.x, 0, config.z);
      group.rotation.y = config.rotY;

      const poleGeo = new THREE.CylinderGeometry(0.3, 0.3, 5, 12);
      const pole = new THREE.Mesh(poleGeo, palette.pole);
      pole.position.y = 2.5;
      pole.castShadow = true;
      group.add(pole);

      const housingGeo = new THREE.BoxGeometry(1.2, 2.8, 1.2);
      const housing = new THREE.Mesh(housingGeo, palette.housing);
      housing.position.y = 4.6;
      housing.castShadow = true;
      group.add(housing);

      const lightGeo = new THREE.SphereGeometry(0.35, 16, 12);
      const colors = ['#ff4545', '#ffd54a', '#3edc81'];
      const bulbs = colors.map((c, idx) => {
        const mat = new THREE.MeshLambertMaterial({ color: c, emissive: 0x000000 });
        const bulb = new THREE.Mesh(lightGeo, mat);
        bulb.position.set(0, 5.4 - idx * 0.9, 0.6);
        bulb.castShadow = true;
        group.add(bulb);
        return bulb;
      });

      scene.add(group);
      return { group, bulbs };
    }
    // Create traffic lights for each road (0=north, 1=east, 2=south, 3=west)
    [0, 1, 2, 3].forEach(roadIndex => trafficLights.push(createTrafficLight(roadIndex)));

    let currentGreenIndex = 0;
    const cycleTime = 3000;
    const yellowTime = 800;
    let cycleState = 'green';
    let lastChange = performance.now();

    function updateTrafficLights() {
      if (!simulationData.Lights) return;
      simulationData.Lights.forEach((light, idx) => {
        if (idx >= trafficLights.length) return;
        const [red, yellow, green] = trafficLights[idx].bulbs;
        red.material.emissive.setHex(0x000000);
        yellow.material.emissive.setHex(0x000000);
        green.material.emissive.setHex(0x000000);
        if (light.Couleur === 'RED') {
          red.material.emissive.setHex(0xff2222);
        } else if (light.Couleur === 'YELLOW') {
          yellow.material.emissive.setHex(0xffff55);
        } else if (light.Couleur === 'GREEN') {
          green.material.emissive.setHex(0x22ff66);
        }
      });
    }

    function updateCars() {
      if (!simulationData.Vehicles || !Array.isArray(simulationData.Vehicles)) return;
      simulationData.Vehicles.forEach((vehicle, idx) => {
        if (idx >= carMeshes.length) return;
        const mesh = carMeshes[idx];
        // Simple positioning: set z to Position, assuming north-south road
        mesh.position.z = vehicle.Position;
        mesh.position.x = idx === 0 ? -1.8 : 1.8; // lane offset
        mesh.position.y = 0.5;
        // Rotation based on Voie, assume 'N1' is north
        mesh.rotation.y = vehicle.Voie === 'N1' ? Math.PI : 0;
      });
    }

    // Cars - meshes to be updated from Python simulation
    const carMeshes = [];
    const carColors = ['#ff6f91', '#ff9671'];
    
    for (let i = 0; i < 2; i++) {
      const bodyGeo = new THREE.BoxGeometry(1.5, 0.6, 2.2);
      const bodyMat = new THREE.MeshLambertMaterial({ color: carColors[i] });
      const mesh = new THREE.Mesh(bodyGeo, bodyMat);
      mesh.castShadow = true;
      scene.add(mesh);
      carMeshes.push(mesh);
    }
    carsRef.current = carMeshes;

    // Interaction drag rotate
    let dragging = false; let prevX = 0; let prevY = 0;
    function onPointerDown(e){ dragging = true; prevX = e.clientX; prevY = e.clientY; }
    function onPointerUp(){ dragging = false; }
    function onPointerMove(e){
      if (!dragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX; prevY = e.clientY;
      const angle = dx * 0.005;
      camera.position.applyAxisAngle(new THREE.Vector3(0,1,0), angle);
      camera.lookAt(0,0,0);
      camera.position.y = Math.max(10, camera.position.y - dy * 0.02);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointerleave', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);

    window.addEventListener('resize', () => {
      const w = window.innerWidth; const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    let last = performance.now();
    function animate(now) {
      const dt = (now - last) / 1000; // seconds
      last = now;
      requestAnimationFrame(animate);
      updateTrafficLights();
      rim.rotation.z += 0.0018;
      updateCars();
      renderer.render(scene, camera);
    }
    animate(last);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointerleave', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} />;
}
