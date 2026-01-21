import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// Utils
import { CONFIG, MAP_CONFIGS } from './utils/Constants';
import { calculateCurrentRotation } from './utils/TurnHelpers';

// Scene modules
import { buildMapByType } from './scene/MapBuilders';
import { updateTrafficLights } from './scene/TrafficLights';
import { updateVehiclesPhysics, updateVehicleMeshes } from './scene/VehiclePhysics';

// UI Components
import { LoadingScreen } from './components/LoadingScreen';
import { MapSidebar } from './components/MapSidebar';
import { LanguageSelector } from './components/LanguageSelector';
import {
  ConnectionStatus,
  PauseButton,
  CurrentMapDisplay,
  TrafficStateHUD,
  CollisionCounter,
  DayTimeDisplay,
  ActiveEventHUD,
  Instructions,
  HUDStyles
} from './components/HUD';

// =============================================================================
//  MAIN COMPONENT
// =============================================================================

export default function ThreeScene() {
  const mountRef = useRef(null);
  const sceneDataRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    trafficLights: {},
    vehicles: {},
    simulationData: null,
    lastPacketTime: 0,
    localVehicles: {},
    localLights: {},
    collisionCount: 0,
    collidedPairs: new Set(),
    dayTime: 0,
    vehicleMeshesShared: null
  });
  
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [trafficState, setTrafficState] = useState('Moderate');
  const [activeEvent, setActiveEvent] = useState(null);
  const [collisionCount, setCollisionCount] = useState(0);
  const [dayTime, setDayTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  
  // Map selection state
  const [currentMap, setCurrentMap] = useState('intersection');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const currentMapRef = useRef('intersection');
  
  // Keep refs in sync
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { currentMapRef.current = currentMap; }, [currentMap]);

  // ==========================================================================
  //  Map Switching Logic
  // ==========================================================================
  
  const switchMap = useCallback(async (mapId) => {
    if (mapId === currentMap || isLoading) return;
    
    setIsLoading(true);
    setLoadingProgress(0);
    setSidebarOpen(false);
    
    const loadingSteps = [
      { progress: 10, delay: 100 },
      { progress: 30, delay: 200 },
      { progress: 50, delay: 300 },
      { progress: 70, delay: 200 },
      { progress: 90, delay: 150 },
      { progress: 100, delay: 100 },
    ];
    
    for (const step of loadingSteps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      setLoadingProgress(step.progress);
    }
    
    const { scene, vehicles, trafficLights } = sceneDataRef.current;
    
    // Remove all vehicles
    Object.keys(vehicles).forEach(id => {
      const mesh = vehicles[id];
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry?.dispose();
        mesh.material?.dispose();
      }
      delete vehicles[id];
    });
    
    // Remove traffic light groups
    Object.keys(trafficLights).forEach(dir => {
      const light = trafficLights[dir];
      if (light?.group) {
        scene.remove(light.group);
      }
      delete trafficLights[dir];
    });
    
    // Clear local state
    sceneDataRef.current.localVehicles = {};
    sceneDataRef.current.collisionCount = 0;
    sceneDataRef.current.collidedPairs = new Set();
    setCollisionCount(0);
    
    // Remove map objects
    const objectsToRemove = [];
    scene.traverse((child) => {
      if (child.userData.mapObject) {
        objectsToRemove.push(child);
      }
    });
    objectsToRemove.forEach(obj => {
      scene.remove(obj);
      obj.geometry?.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    
    // Build new map
    buildMapByType(scene, sceneDataRef.current.trafficLights, mapId);
    
    setCurrentMap(mapId);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsLoading(false);
  }, [currentMap, isLoading]);

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
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          sceneDataRef.current.simulationData = data;
          sceneDataRef.current.lastPacketTime = performance.now();
          
          if (data.Vehicles) {
            if (data.Reset === true) {
              Object.values(sceneDataRef.current.localVehicles).forEach(v => {
                v.fading = true;
                v.fadeStart = performance.now();
              });
            }
            
            data.Vehicles.forEach(v => {
              if (!v.Id || !v.Sens || !['N','S','E','W'].includes(v.Sens)) return;
              
              if (!sceneDataRef.current.localVehicles[v.Id]) {
                const turnRandom = Math.random();
                const turnDirection = turnRandom < 0.5 ? 'straight' : (turnRandom < 0.75 ? 'left' : 'right');
                
                const { LANE_OFFSET } = CONFIG;
                const lane = v.Voie?.includes('1') ? 1 : 2;
                const laneOff = (lane === 1 ? -LANE_OFFSET : LANE_OFFSET) * 0.8;
                const currentPos = v.Position || 0;
                
                let initX = 0, initZ = 0;
                if (v.Sens === 'N') {
                  initX = -laneOff;
                  initZ = 50 - currentPos;
                } else if (v.Sens === 'S') {
                  initX = laneOff;
                  initZ = -50 + currentPos;
                } else if (v.Sens === 'E') {
                  initX = -50 + currentPos;
                  initZ = -laneOff;
                } else if (v.Sens === 'W') {
                  initX = 50 - currentPos;
                  initZ = laneOff;
                }
                
                sceneDataRef.current.localVehicles[v.Id] = {
                  ...v,
                  currentPosition: currentPos,
                  currentSpeed: v.Speed || 0,
                  waiting: false,
                  fading: false,
                  turnDirection,
                  turnState: 'STRAIGHT',
                  turnStartPosition: 0,
                  turnProgress: 0,
                  rotation: calculateCurrentRotation(v.Sens),
                  initialRotation: calculateCurrentRotation(v.Sens),
                  targetRotation: calculateCurrentRotation(v.Sens),
                  position: { x: initX, z: initZ },
                  hasTurned: false
                };
              }
            });
            
            sceneDataRef.current.localVehicles = { ...sceneDataRef.current.localVehicles };
          }

          if (data.Lights) {
            const newLocalLights = {};
            const serverTime = data.ServerTime || Date.now();
            sceneDataRef.current.serverTimeAtLastPacket = serverTime;
            sceneDataRef.current.clientPerfAtLastPacket = performance.now();
            
            data.Lights.forEach(light => {
              const expiresAt = light.ExpiresAt || (serverTime + (light.Timer || 0) * 1000);
              newLocalLights[light.Sens] = {
                color: light.Couleur,
                expiresAt,
                lastUpdateTime: performance.now()
              };
            });
            sceneDataRef.current.localLights = newLocalLights;
          }

          if (data.Event) {
            setActiveEvent(data.Event.name);
            const name = data.Event.name;
            if (['Rush Hour', 'Accident', 'Construction', 'Bad Weather'].includes(name)) {
              setTrafficState('Slow');
            } else if (name === 'Event Nearby') {
              setTrafficState('Moderate');
            } else {
              setTrafficState('Moderate');
            }
          } else {
            setActiveEvent(null);
            setTrafficState('Fast');
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
    scene.background = new THREE.Color('#87CEEB');
    
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
    
    // Build initial map
    buildMapByType(scene, sceneDataRef.current.trafficLights, currentMapRef.current);
    
    // Camera controls
    let dragging = false, prevX = 0, prevY = 0;
    
    const onPointerDown = (e) => { 
      dragging = true; 
      prevX = e.clientX; 
      prevY = e.clientY; 
    };
    
    const onPointerUp = () => { dragging = false; };
    
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
    let lastLightingUpdate = 0;
    const LIGHTING_UPDATE_MS = 1000;
    
    const animate = (now) => {
      requestAnimationFrame(animate);
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      
      if (pausedRef.current) {
        renderer.render(scene, camera);
        return;
      }
      
      // Day/night cycle
      sceneDataRef.current.dayTime += dt * 100;
      if (sceneDataRef.current.dayTime >= 86400) sceneDataRef.current.dayTime = 0;
      
      if (now - lastLightingUpdate > LIGHTING_UPDATE_MS) {
        lastLightingUpdate = now;
        setDayTime(sceneDataRef.current.dayTime);
        
        const hour = (sceneDataRef.current.dayTime / 3600) % 24;
        const isDay = hour >= 6 && hour <= 18;
        const intensity = isDay ? 0.8 : 0.2;
        sun.intensity = intensity;
        ambient.intensity = isDay ? 0.6 : 0.3;
        scene.background = new THREE.Color(isDay ? '#87CEEB' : '#191970');
      }
      
      // Update from simulation
      const data = sceneDataRef.current.simulationData;
      if (data) {
        const serverTimeBase = sceneDataRef.current.serverTimeAtLastPacket || Date.now();
        const clientPerfBase = sceneDataRef.current.clientPerfAtLastPacket || performance.now();
        const estimatedServerNow = serverTimeBase + (now - clientPerfBase);
        
        updateTrafficLights(
          sceneDataRef.current.trafficLights, 
          sceneDataRef.current.localLights, 
          0, 
          estimatedServerNow
        );
        
        updateVehiclesPhysics(
          dt, 
          data.Lights, 
          sceneDataRef.current.localVehicles, 
          sceneDataRef.current.localLights, 
          estimatedServerNow,
          sceneDataRef,
          setCollisionCount
        );
        
        updateVehicleMeshes(
          sceneDataRef.current.localVehicles, 
          scene, 
          sceneDataRef.current.vehicles,
          sceneDataRef
        );
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
  //  Render
  // ==========================================================================
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Loading Screen */}
      <LoadingScreen 
        isLoading={isLoading} 
        currentMap={currentMap} 
        loadingProgress={loadingProgress} 
      />
      
      {/* Map Sidebar */}
      <MapSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentMap={currentMap}
        switchMap={switchMap}
        isLoading={isLoading}
        
      />
      
      {/* Top Left Controls */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        zIndex: 40
      }}>
        <ConnectionStatus connected={connected} />
        
      </div>
      
      {/* Bottom Left Controls */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 40
      }}>

        
        <PauseButton paused={paused} setPaused={setPaused} />
        <Instructions />
      </div>
      
      {/* Right Side HUD */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
        zIndex: 40
      }}>
        <CurrentMapDisplay currentMap={currentMap} />
        <TrafficStateHUD trafficState={trafficState} />
        <CollisionCounter collisionCount={collisionCount} />
        <DayTimeDisplay dayTime={dayTime} />
        <ActiveEventHUD activeEvent={activeEvent} />
        <LanguageSelector 
        
        />
      </div>
      
      <HUDStyles />
    </div>
  );
}
