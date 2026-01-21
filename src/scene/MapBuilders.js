import * as THREE from 'three';
import { CONFIG } from '../utils/Constants';
import { buildTrafficLights } from './TrafficLights';

// =============================================================================
//  SIMPLE INTERSECTION (Default Map)
// =============================================================================

export function buildGround(scene) {
  const groundGeo = new THREE.PlaneGeometry(300, 300);
  const groundMat = new THREE.MeshLambertMaterial({ color: '#7ec850' });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  ground.userData.mapObject = true;
  scene.add(ground);
  
  // Trees
  const treeMat = new THREE.MeshLambertMaterial({ color: '#228b22' });
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#8B4513' });
  
  const treePositions = [
    { x: 30, z: -30 }, { x: 50, z: -45 }, { x: 40, z: -60 }, { x: 65, z: -35 },
    { x: 25, z: -55 }, { x: 55, z: -25 }, { x: 70, z: -55 },
    { x: -30, z: -30 }, { x: -50, z: -45 }, { x: -40, z: -60 }, { x: -65, z: -35 },
    { x: -25, z: -55 }, { x: -55, z: -25 }, { x: -70, z: -55 },
    { x: 30, z: 30 }, { x: 50, z: 45 }, { x: 40, z: 60 }, { x: 65, z: 35 },
    { x: 25, z: 55 }, { x: 55, z: 25 }, { x: 70, z: 55 },
    { x: -30, z: 30 }, { x: -50, z: 45 }, { x: -40, z: 60 }, { x: -65, z: 35 },
    { x: -25, z: 55 }, { x: -55, z: 25 }, { x: -70, z: 55 },
  ];
  
  treePositions.forEach((pos) => {
    const scale = 0.7 + Math.random() * 0.6;
    const trunkHeight = 2 * scale;
    const foliageHeight = 4 * scale;
    const foliageRadius = 2 * scale;
    
    const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, trunkHeight, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(pos.x, trunkHeight / 2 + 0.1, pos.z);
    trunk.castShadow = true;
    trunk.userData.mapObject = true;
    scene.add(trunk);
    
    const foliageGeo = new THREE.ConeGeometry(foliageRadius, foliageHeight, 8);
    const foliage = new THREE.Mesh(foliageGeo, treeMat);
    foliage.position.set(pos.x, trunkHeight + foliageHeight / 2, pos.z);
    foliage.castShadow = true;
    foliage.userData.mapObject = true;
    scene.add(foliage);
  });
}

export function buildRoads(scene) {
  const roadMat = new THREE.MeshLambertMaterial({ color: '#404040' });
  const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  
  const { ROAD_WIDTH, ROAD_HEIGHT } = CONFIG;
  const EXTENDED_ROAD_LENGTH = 300;
  
  const hRoadGeo = new THREE.BoxGeometry(EXTENDED_ROAD_LENGTH, ROAD_HEIGHT, ROAD_WIDTH);
  const hRoad = new THREE.Mesh(hRoadGeo, roadMat);
  hRoad.position.y = ROAD_HEIGHT / 2;
  hRoad.receiveShadow = true;
  hRoad.userData.mapObject = true;
  scene.add(hRoad);
  
  const vRoadGeo = new THREE.BoxGeometry(ROAD_WIDTH, ROAD_HEIGHT, EXTENDED_ROAD_LENGTH);
  const vRoad = new THREE.Mesh(vRoadGeo, roadMat);
  vRoad.position.y = ROAD_HEIGHT / 2;
  vRoad.receiveShadow = true;
  vRoad.userData.mapObject = true;
  scene.add(vRoad);
  
  const dashGeo = new THREE.BoxGeometry(3, 0.05, 0.3);
  for (let i = -60; i <= 60; i += 4) {
    if (Math.abs(i * 2) < 8) continue;
    const hDash = new THREE.Mesh(dashGeo, lineMat);
    hDash.position.set(i * 2, ROAD_HEIGHT + 0.05, 0);
    hDash.userData.mapObject = true;
    scene.add(hDash);
  }
  
  const vDashGeo = new THREE.BoxGeometry(0.3, 0.05, 3);
  for (let i = -60; i <= 60; i += 4) {
    if (Math.abs(i * 2) < 8) continue;
    const vDash = new THREE.Mesh(vDashGeo, lineMat);
    vDash.position.set(0, ROAD_HEIGHT + 0.05, i * 2);
    vDash.userData.mapObject = true;
    scene.add(vDash);
  }
  
  // Stop lines (made transparent to avoid visual artifacts)
  const stopLineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
  const stopLineGeo = new THREE.BoxGeometry(ROAD_WIDTH / 2 - 0.5, 0.06, 0.5);
  
  const stopN = new THREE.Mesh(stopLineGeo, stopLineMat);
  stopN.position.set(-ROAD_WIDTH / 4 - 0.25, ROAD_HEIGHT + 0.06, -ROAD_WIDTH / 2 - 1);
  stopN.userData.mapObject = true;
  scene.add(stopN);
  
  const stopS = new THREE.Mesh(stopLineGeo, stopLineMat);
  stopS.position.set(ROAD_WIDTH / 4 + 0.25, ROAD_HEIGHT + 0.06, ROAD_WIDTH / 2 + 1);
  stopS.userData.mapObject = true;
  scene.add(stopS);
  
  const stopLineGeoV = new THREE.BoxGeometry(0.5, 0.06, ROAD_WIDTH / 2 - 0.5);
  const stopE = new THREE.Mesh(stopLineGeoV, stopLineMat);
  stopE.position.set(ROAD_WIDTH / 2 + 1, ROAD_HEIGHT + 0.06, -ROAD_WIDTH / 4 - 0.25);
  stopE.userData.mapObject = true;
  scene.add(stopE);
  
  const stopW = new THREE.Mesh(stopLineGeoV, stopLineMat);
  stopW.position.set(-ROAD_WIDTH / 2 - 1, ROAD_HEIGHT + 0.06, ROAD_WIDTH / 4 + 0.25);
  stopW.userData.mapObject = true;
  scene.add(stopW);
}

// =============================================================================
//  HELPER: Standard Intersection Roads
// =============================================================================

function buildIntersectionRoads(scene, roadColor, lineColor) {
  const roadMat = new THREE.MeshLambertMaterial({ color: roadColor });
  const lineMat = new THREE.MeshBasicMaterial({ color: lineColor });
  
  const { ROAD_WIDTH, ROAD_HEIGHT } = CONFIG;
  const EXTENDED_ROAD_LENGTH = 300;
  
  const hRoadGeo = new THREE.BoxGeometry(EXTENDED_ROAD_LENGTH, ROAD_HEIGHT, ROAD_WIDTH);
  const hRoad = new THREE.Mesh(hRoadGeo, roadMat);
  hRoad.position.y = ROAD_HEIGHT / 2;
  hRoad.receiveShadow = true;
  hRoad.userData.mapObject = true;
  scene.add(hRoad);
  
  const vRoadGeo = new THREE.BoxGeometry(ROAD_WIDTH, ROAD_HEIGHT, EXTENDED_ROAD_LENGTH);
  const vRoad = new THREE.Mesh(vRoadGeo, roadMat);
  vRoad.position.y = ROAD_HEIGHT / 2;
  vRoad.receiveShadow = true;
  vRoad.userData.mapObject = true;
  scene.add(vRoad);
  
  const dashGeo = new THREE.BoxGeometry(3, 0.05, 0.3);
  for (let i = -60; i <= 60; i += 4) {
    if (Math.abs(i * 2) < 8) continue;
    const hDash = new THREE.Mesh(dashGeo, lineMat);
    hDash.position.set(i * 2, ROAD_HEIGHT + 0.05, 0);
    hDash.userData.mapObject = true;
    scene.add(hDash);
  }
  
  const vDashGeo = new THREE.BoxGeometry(0.3, 0.05, 3);
  for (let i = -60; i <= 60; i += 4) {
    if (Math.abs(i * 2) < 8) continue;
    const vDash = new THREE.Mesh(vDashGeo, lineMat);
    vDash.position.set(0, ROAD_HEIGHT + 0.05, i * 2);
    vDash.userData.mapObject = true;
    scene.add(vDash);
  }
  
  // Stop lines (made transparent to avoid visual artifacts)
  const stopLineMat = new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: 0 });
  const stopLineGeo = new THREE.BoxGeometry(ROAD_WIDTH / 2 - 0.5, 0.06, 0.5);
  
  const stopN = new THREE.Mesh(stopLineGeo, stopLineMat);
  stopN.position.set(-ROAD_WIDTH / 4 - 0.25, ROAD_HEIGHT + 0.06, -ROAD_WIDTH / 2 - 1);
  stopN.userData.mapObject = true;
  scene.add(stopN);
  
  const stopS = new THREE.Mesh(stopLineGeo, stopLineMat);
  stopS.position.set(ROAD_WIDTH / 4 + 0.25, ROAD_HEIGHT + 0.06, ROAD_WIDTH / 2 + 1);
  stopS.userData.mapObject = true;
  scene.add(stopS);
  
  const stopLineGeoV = new THREE.BoxGeometry(0.5, 0.06, ROAD_WIDTH / 2 - 0.5);
  const stopE = new THREE.Mesh(stopLineGeoV, stopLineMat);
  stopE.position.set(ROAD_WIDTH / 2 + 1, ROAD_HEIGHT + 0.06, -ROAD_WIDTH / 4 - 0.25);
  stopE.userData.mapObject = true;
  scene.add(stopE);
  
  const stopW = new THREE.Mesh(stopLineGeoV, stopLineMat);
  stopW.position.set(-ROAD_WIDTH / 2 - 1, ROAD_HEIGHT + 0.06, ROAD_WIDTH / 4 + 0.25);
  stopW.userData.mapObject = true;
  scene.add(stopW);
}

// =============================================================================
//  RAINY INTERSECTION
// =============================================================================

export function buildRainyIntersection(scene, trafficLightsRef) {
  const groundGeo = new THREE.PlaneGeometry(300, 300);
  const groundMat = new THREE.MeshLambertMaterial({ color: '#4a5a4a' });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  ground.userData.mapObject = true;
  scene.add(ground);
  
  buildIntersectionRoads(scene, '#2a2a2a', '#cccccc');
  
  // Rain puddles
  const puddleMat = new THREE.MeshLambertMaterial({ color: '#3a4a5a', transparent: true, opacity: 0.7 });
  const puddlePositions = [
    { x: 25, z: -30, r: 4 }, { x: -40, z: 50, r: 5 }, { x: 55, z: 35, r: 3 },
    { x: -35, z: -45, r: 6 }, { x: 60, z: -55, r: 4 }, { x: -60, z: 30, r: 5 },
    { x: 45, z: 60, r: 3 }, { x: -25, z: -60, r: 4 }
  ];
  
  puddlePositions.forEach(p => {
    const puddleGeo = new THREE.CircleGeometry(p.r, 16);
    const puddle = new THREE.Mesh(puddleGeo, puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(p.x, 0.01, p.z);
    puddle.userData.mapObject = true;
    scene.add(puddle);
  });
  
  // Dark wet trees
  const wetTreeMat = new THREE.MeshLambertMaterial({ color: '#1a4a1a' });
  const wetTrunkMat = new THREE.MeshLambertMaterial({ color: '#3a2a1a' });
  
  const treePositions = [
    { x: 35, z: -40 }, { x: -45, z: -35 }, { x: 50, z: 45 }, { x: -40, z: 50 },
    { x: 65, z: -25 }, { x: -55, z: -55 }, { x: 30, z: 65 }, { x: -65, z: 40 }
  ];
  
  treePositions.forEach(pos => {
    const scale = 0.8 + Math.random() * 0.4;
    const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 2 * scale, 8);
    const trunk = new THREE.Mesh(trunkGeo, wetTrunkMat);
    trunk.position.set(pos.x, scale + 0.1, pos.z);
    trunk.castShadow = true;
    trunk.userData.mapObject = true;
    scene.add(trunk);
    
    const foliageGeo = new THREE.ConeGeometry(2 * scale, 4 * scale, 8);
    const foliage = new THREE.Mesh(foliageGeo, wetTreeMat);
    foliage.position.set(pos.x, 2 * scale + 2 * scale, pos.z);
    foliage.castShadow = true;
    foliage.userData.mapObject = true;
    scene.add(foliage);
  });
  
  buildTrafficLights(scene, trafficLightsRef);
}

// =============================================================================
//  DESERT INTERSECTION
// =============================================================================

export function buildDesertIntersection(scene, trafficLightsRef) {
  const groundGeo = new THREE.PlaneGeometry(300, 300);
  const groundMat = new THREE.MeshLambertMaterial({ color: '#d4a574' });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  ground.userData.mapObject = true;
  scene.add(ground);
  
  buildIntersectionRoads(scene, '#5a5045', '#e0d5c0');
  
  // Cacti
  const cactusMat = new THREE.MeshLambertMaterial({ color: '#2d5a2d' });
  const cactusPositions = [
    { x: 30, z: -35 }, { x: -40, z: 45 }, { x: 55, z: 50 }, { x: -50, z: -40 },
    { x: 70, z: -30 }, { x: -30, z: -65 }, { x: 45, z: 70 }, { x: -65, z: 55 },
    { x: 25, z: 40 }, { x: -55, z: -25 }
  ];
  
  cactusPositions.forEach(pos => {
    const height = 2 + Math.random() * 3;
    const stemGeo = new THREE.CylinderGeometry(0.4, 0.5, height, 8);
    const stem = new THREE.Mesh(stemGeo, cactusMat);
    stem.position.set(pos.x, height / 2, pos.z);
    stem.castShadow = true;
    stem.userData.mapObject = true;
    scene.add(stem);
    
    if (Math.random() > 0.4) {
      const armGeo = new THREE.CylinderGeometry(0.25, 0.3, 1.5, 6);
      const arm1 = new THREE.Mesh(armGeo, cactusMat);
      arm1.position.set(pos.x + 0.6, height * 0.6, pos.z);
      arm1.rotation.z = -Math.PI / 4;
      arm1.userData.mapObject = true;
      scene.add(arm1);
      
      if (Math.random() > 0.5) {
        const arm2 = new THREE.Mesh(armGeo, cactusMat);
        arm2.position.set(pos.x - 0.6, height * 0.5, pos.z);
        arm2.rotation.z = Math.PI / 4;
        arm2.userData.mapObject = true;
        scene.add(arm2);
      }
    }
  });
  
  // Desert rocks
  const rockMat = new THREE.MeshLambertMaterial({ color: '#8b7355' });
  const rockPositions = [
    { x: 60, z: -50 }, { x: -55, z: 60 }, { x: 40, z: -60 }, { x: -45, z: -55 },
    { x: 70, z: 40 }, { x: -70, z: -30 }
  ];
  
  rockPositions.forEach(pos => {
    const rockGeo = new THREE.DodecahedronGeometry(1.5 + Math.random() * 2, 0);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(pos.x, 0.8, pos.z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.y = 0.6;
    rock.castShadow = true;
    rock.userData.mapObject = true;
    scene.add(rock);
  });
  
  buildTrafficLights(scene, trafficLightsRef);
}

// =============================================================================
//  SNOWY INTERSECTION
// =============================================================================

export function buildSnowyIntersection(scene, trafficLightsRef) {
  const groundGeo = new THREE.PlaneGeometry(300, 300);
  const groundMat = new THREE.MeshLambertMaterial({ color: '#f0f5f5' });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  ground.userData.mapObject = true;
  scene.add(ground);
  
  buildIntersectionRoads(scene, '#3a4550', '#d0e0e5');
  
  // Snow banks
  const snowBankMat = new THREE.MeshLambertMaterial({ color: '#e8f0f0' });
  const snowBankPositions = [
    { x: 0, z: -8, w: 280, d: 3 }, { x: 0, z: 8, w: 280, d: 3 },
    { x: -8, z: 0, w: 3, d: 280 }, { x: 8, z: 0, w: 3, d: 280 }
  ];
  
  snowBankPositions.forEach(pos => {
    const bankGeo = new THREE.BoxGeometry(pos.w, 0.8, pos.d);
    const bank = new THREE.Mesh(bankGeo, snowBankMat);
    bank.position.set(pos.x, 0.4, pos.z);
    bank.userData.mapObject = true;
    scene.add(bank);
  });
  
  // Pine trees with snow
  const pineMat = new THREE.MeshLambertMaterial({ color: '#1a3a2a' });
  const snowMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const pineTrunkMat = new THREE.MeshLambertMaterial({ color: '#4a3020' });
  
  const pinePositions = [
    { x: 35, z: -35 }, { x: -40, z: -45 }, { x: 50, z: 40 }, { x: -45, z: 50 },
    { x: 60, z: -55 }, { x: -55, z: -35 }, { x: 35, z: 60 }, { x: -60, z: 35 },
    { x: 70, z: -30 }, { x: -30, z: -70 }, { x: 70, z: 55 }, { x: -70, z: -55 },
    { x: 25, z: -55 }, { x: -55, z: 25 }
  ];
  
  pinePositions.forEach(pos => {
    const scale = 0.7 + Math.random() * 0.5;
    
    const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2 * scale, 8);
    const trunk = new THREE.Mesh(trunkGeo, pineTrunkMat);
    trunk.position.set(pos.x, scale, pos.z);
    trunk.castShadow = true;
    trunk.userData.mapObject = true;
    scene.add(trunk);
    
    for (let layer = 0; layer < 3; layer++) {
      const layerScale = 1 - layer * 0.25;
      const coneGeo = new THREE.ConeGeometry(2.5 * scale * layerScale, 3 * scale * layerScale, 8);
      const cone = new THREE.Mesh(coneGeo, pineMat);
      cone.position.set(pos.x, 2 * scale + layer * 1.5 * scale, pos.z);
      cone.castShadow = true;
      cone.userData.mapObject = true;
      scene.add(cone);
      
      const snowCapGeo = new THREE.ConeGeometry(2.2 * scale * layerScale, 0.5 * scale, 8);
      const snowCap = new THREE.Mesh(snowCapGeo, snowMat);
      snowCap.position.set(pos.x, 2 * scale + layer * 1.5 * scale + 1.2 * scale * layerScale, pos.z);
      snowCap.userData.mapObject = true;
      scene.add(snowCap);
    }
  });
  
  // Snowmen
  const snowmanPositions = [{ x: 45, z: -25 }, { x: -50, z: 40 }];
  snowmanPositions.forEach(pos => {
    const bodyGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const body = new THREE.Mesh(bodyGeo, snowMat);
    body.position.set(pos.x, 1.2, pos.z);
    body.userData.mapObject = true;
    scene.add(body);
    
    const midGeo = new THREE.SphereGeometry(0.9, 16, 16);
    const mid = new THREE.Mesh(midGeo, snowMat);
    mid.position.set(pos.x, 2.8, pos.z);
    mid.userData.mapObject = true;
    scene.add(mid);
    
    const headGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const head = new THREE.Mesh(headGeo, snowMat);
    head.position.set(pos.x, 4, pos.z);
    head.userData.mapObject = true;
    scene.add(head);
    
    const noseMat = new THREE.MeshLambertMaterial({ color: '#ff6600' });
    const noseGeo = new THREE.ConeGeometry(0.1, 0.5, 8);
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(pos.x, 4, pos.z + 0.6);
    nose.rotation.x = Math.PI / 2;
    nose.userData.mapObject = true;
    scene.add(nose);
  });
  
  buildTrafficLights(scene, trafficLightsRef);
}

// =============================================================================
//  CITY GRID MAP
// =============================================================================

export function buildCityGridMap(scene, trafficLightsRef) {
  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshLambertMaterial({ color: '#7ec850' });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  ground.userData.mapObject = true;
  scene.add(ground);
  
  const roadMat = new THREE.MeshLambertMaterial({ color: '#404040' });
  const buildingColors = ['#8b8b8b', '#a0a0a0', '#707070', '#b0b0b0', '#606060'];
  const { ROAD_WIDTH, ROAD_HEIGHT, LIGHT_DISTANCE, LANE_OFFSET } = CONFIG;
  
  const spacing = 60;
  const offsets = [-spacing, 0, spacing];
  
  // Roads
  offsets.forEach(zOffset => {
    const roadGeo = new THREE.BoxGeometry(300, ROAD_HEIGHT, ROAD_WIDTH);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(0, ROAD_HEIGHT / 2, zOffset);
    road.receiveShadow = true;
    road.userData.mapObject = true;
    scene.add(road);
  });
  
  offsets.forEach(xOffset => {
    const roadGeo = new THREE.BoxGeometry(ROAD_WIDTH, ROAD_HEIGHT, 300);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(xOffset, ROAD_HEIGHT / 2, 0);
    road.receiveShadow = true;
    road.userData.mapObject = true;
    scene.add(road);
  });
  
  // Buildings
  const blockCenters = [];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      blockCenters.push({ x: offsets[i] + spacing / 2, z: offsets[j] + spacing / 2 });
      blockCenters.push({ x: offsets[i] - spacing / 2, z: offsets[j] - spacing / 2 });
    }
  }
  
  blockCenters.forEach((center) => {
    const buildingCount = 2 + Math.floor(Math.random() * 3);
    for (let b = 0; b < buildingCount; b++) {
      const bWidth = 8 + Math.random() * 10;
      const bDepth = 8 + Math.random() * 10;
      const bHeight = 10 + Math.random() * 30;
      
      const offsetX = (Math.random() - 0.5) * 20;
      const offsetZ = (Math.random() - 0.5) * 20;
      
      const colorIdx = Math.floor(Math.random() * buildingColors.length);
      const buildingMat = new THREE.MeshLambertMaterial({ color: buildingColors[colorIdx] });
      const buildingGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      const building = new THREE.Mesh(buildingGeo, buildingMat);
      building.position.set(center.x + offsetX, bHeight / 2, center.z + offsetZ);
      building.castShadow = true;
      building.receiveShadow = true;
      building.userData.mapObject = true;
      scene.add(building);
    }
  });
  
  // Traffic lights at center intersection
  const poleMat = new THREE.MeshLambertMaterial({ color: '#333333' });
  const housingMat = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
  
  const lightConfigs = {
    'N': { position: new THREE.Vector3(-LANE_OFFSET - 1.5, 0, -LIGHT_DISTANCE), rotation: Math.PI },
    'S': { position: new THREE.Vector3(LANE_OFFSET + 1.5, 0, LIGHT_DISTANCE), rotation: 0 },
    'E': { position: new THREE.Vector3(LIGHT_DISTANCE, 0, -LANE_OFFSET - 1.5), rotation: Math.PI / 2 },
    'W': { position: new THREE.Vector3(-LIGHT_DISTANCE, 0, LANE_OFFSET + 1.5), rotation: -Math.PI / 2 }
  };
  
  Object.entries(lightConfigs).forEach(([direction, config]) => {
    const group = new THREE.Group();
    group.position.copy(config.position);
    group.rotation.y = config.rotation;
    group.userData.mapObject = true;
    
    const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 6, 12);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 3;
    pole.castShadow = true;
    group.add(pole);
    
    const housingGeo = new THREE.BoxGeometry(1.0, 3.0, 0.8);
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.set(0, 5.5, 0);
    housing.castShadow = true;
    group.add(housing);
    
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
    
    const timerCanvas = document.createElement('canvas');
    timerCanvas.width = 256;
    timerCanvas.height = 128;
    const timerTexture = new THREE.CanvasTexture(timerCanvas);
    const timerMat = new THREE.SpriteMaterial({ map: timerTexture });
    const timerSprite = new THREE.Sprite(timerMat);
    timerSprite.position.set(0, 8, 0);
    timerSprite.scale.set(4, 2, 1);
    group.add(timerSprite);
    
    const directionNames = { 'N': 'NORTH', 'S': 'SOUTH', 'E': 'EAST', 'W': 'WEST' };
    const dirName = directionNames[direction];
    
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
//  MAP BUILDER DISPATCHER
// =============================================================================

export function buildMapByType(scene, trafficLightsRef, mapType) {
  switch (mapType) {
    case 'rainyIntersection':
      buildRainyIntersection(scene, trafficLightsRef);
      break;
    case 'desertIntersection':
      buildDesertIntersection(scene, trafficLightsRef);
      break;
    case 'snowyIntersection':
      buildSnowyIntersection(scene, trafficLightsRef);
      break;
    case 'cityGrid':
      buildCityGridMap(scene, trafficLightsRef);
      break;
    case 'intersection':
    default:
      buildGround(scene);
      buildRoads(scene);
      buildTrafficLights(scene, trafficLightsRef);
      break;
  }
}
