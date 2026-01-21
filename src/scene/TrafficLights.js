import * as THREE from 'three';
import { CONFIG } from '../utils/Constants';

// =============================================================================
//  TRAFFIC LIGHT BUILDER
// =============================================================================

export function buildTrafficLights(scene, trafficLightsRef) {
  const { LIGHT_DISTANCE, LANE_OFFSET, ROAD_HEIGHT } = CONFIG;
  
  // Traffic light positions and rotations
  const lightConfigs = {
    'N': { 
      position: new THREE.Vector3(-LANE_OFFSET - 1.5, 0, -LIGHT_DISTANCE),
      rotation: Math.PI,
      label: 'N'
    },
    'S': { 
      position: new THREE.Vector3(LANE_OFFSET + 1.5, 0, LIGHT_DISTANCE),
      rotation: 0,
      label: 'S'
    },
    'E': { 
      position: new THREE.Vector3(LIGHT_DISTANCE, 0, -LANE_OFFSET - 1.5),
      rotation: Math.PI / 2,
      label: 'E'
    },
    'W': { 
      position: new THREE.Vector3(-LIGHT_DISTANCE, 0, LANE_OFFSET + 1.5),
      rotation: -Math.PI / 2,
      label: 'W'
    }
  };
  
  const poleMat = new THREE.MeshLambertMaterial({ color: '#333333' });
  const housingMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
  
  Object.entries(lightConfigs).forEach(([direction, config]) => {
    const group = new THREE.Group();
    group.position.copy(config.position);
    group.rotation.y = config.rotation;
    group.userData.mapObject = true;
    
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
    ctx.fillText("--", 128, 88);
    timerTexture.needsUpdate = true;
    
    scene.add(group);
    
    // Store reference
    trafficLightsRef[direction] = {
      group,
      bulbs: { red: redBulb, yellow: yellowBulb, green: greenBulb },
      timerCanvas,
      timerTexture,
      timerSprite,
      directionName: dirName,
      lastCanvasUpdate: 0,
      lastDisplayedTimer: null,
      lastColor: null
    };
  });
}

// =============================================================================
//  TRAFFIC LIGHT UPDATE
// =============================================================================

export function updateTrafficLights(trafficLightsRef, localLights, elapsed, estimatedServerNow) {
  if (!localLights) return;
  
  const CANVAS_UPDATE_MS = 250;
  const perfNow = performance.now();
  
  Object.keys(localLights).forEach(direction => {
    const lightRef = trafficLightsRef[direction];
    if (!lightRef) return;
    
    const { bulbs, timerCanvas, timerTexture, directionName } = lightRef;
    const localLight = localLights[direction];
    if (!localLight) return;

    // Only change bulb colors if the color actually changed
    if (lightRef.lastColor !== localLight.color) {
      // Reset to dim first
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
      lightRef.lastColor = localLight.color;
    }
    
    // Compute remaining time
    const remainingMs = (localLight.expiresAt || 0) - estimatedServerNow;
    const displayStr = remainingMs > 0 ? (remainingMs / 1000).toFixed(1) + 's' : '0.0s';
    
    // Throttle canvas updates
    if (lightRef.lastDisplayedTimer !== displayStr) {
      if (perfNow - (lightRef.lastCanvasUpdate || 0) > CANVAS_UPDATE_MS) {
        lightRef.lastDisplayedTimer = displayStr;
        lightRef.lastCanvasUpdate = perfNow;

        const ctx = timerCanvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 128);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, 256, 128);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(directionName, 128, 35);

        ctx.fillStyle = localLight.color === 'RED' ? '#ff4444' : 
                        localLight.color === 'YELLOW' ? '#ffff44' : '#44ff44';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(displayStr, 128, 88);

        timerTexture.needsUpdate = true;
      }
    }
  });
}
