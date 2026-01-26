import * as THREE from 'three';
import { CONFIG, PHYSICS, VEHICLE_COLORS, INTERSECTION_CONFIGS, LIGHT_ZONE_CONFIGS } from '../utils/Constants';
import {
  calculateCurrentRotation,
  calculateTargetRotation,
  getNewDirection,
  shouldInitiateTurn,
  getDirectionMultipliers
} from '../utils/TurnHelpers';

// =============================================================================
//  TURN STATE HANDLERS
// =============================================================================

function updateEnteringTurn(vehicle, dt) {
  const multipliers = getDirectionMultipliers(vehicle.Sens);

  vehicle.position.x += vehicle.currentSpeed * dt * multipliers.x;
  vehicle.position.z += vehicle.currentSpeed * dt * multipliers.z;
  vehicle.currentPosition += vehicle.currentSpeed * dt;

  const distanceTraveled = vehicle.currentPosition - vehicle.turnStartPosition;
  if (distanceTraveled >= CONFIG.ENTERING_TURN_DISTANCE) {
    vehicle.turnState = 'ROTATING';
    vehicle.initialRotation = calculateCurrentRotation(vehicle.Sens);
    vehicle.targetRotation = calculateTargetRotation(vehicle.Sens, vehicle.turnDirection);
    vehicle.turnStartPosition = vehicle.currentPosition;
  }
}

function updateRotatingTurn(vehicle, dt) {
  const distanceTraveled = vehicle.currentPosition - vehicle.turnStartPosition;

  let rotationDistance = CONFIG.ROTATION_DISTANCE;
  if (vehicle.turnDirection === 'right') {
    rotationDistance *= 0.8;
  } else if (vehicle.turnDirection === 'left') {
    rotationDistance *= 0.9;
  }

  const turnProgress = Math.min(distanceTraveled / rotationDistance, 1.0);

  vehicle.rotation = THREE.MathUtils.lerp(
    vehicle.initialRotation,
    vehicle.targetRotation,
    turnProgress
  );

  const easedProgress = Math.sin(turnProgress * Math.PI / 2);

  const currentDir = vehicle.Sens;
  const newDir = getNewDirection(currentDir, vehicle.turnDirection);

  const currentMult = getDirectionMultipliers(currentDir);
  const newMult = getDirectionMultipliers(newDir);

  let blendedX, blendedZ;

  if (vehicle.turnDirection === 'right') {
    blendedX = currentMult.x * (1.5 - easedProgress) + newMult.x * easedProgress;
    blendedZ = currentMult.z * (1.5 - easedProgress) + newMult.z * easedProgress;
  } else if (vehicle.turnDirection === 'left') {
    const earlyProgress = Math.pow(easedProgress, 0.7);
    const lateProgress = Math.pow(easedProgress, 1.5);

    blendedX = currentMult.x * (2 - earlyProgress) + newMult.x * lateProgress;
    blendedZ = currentMult.z * (2 - earlyProgress) + newMult.z * lateProgress;

    const lateralPush = Math.sin(easedProgress * Math.PI) * 0.4;
    blendedX += newMult.x * lateralPush;
    blendedZ += newMult.z * lateralPush;
  } else {
    blendedX = currentMult.x;
    blendedZ = currentMult.z;
  }

  const speedFactor = vehicle.currentSpeed * dt * CONFIG.TURN_SPEED_FACTOR;
  vehicle.position.x += blendedX * speedFactor;
  vehicle.position.z += blendedZ * speedFactor;

  vehicle.currentPosition += vehicle.currentSpeed * dt * CONFIG.TURN_SPEED_FACTOR;

  if (turnProgress >= 1.0) {
    vehicle.turnState = 'EXITING_TURN';
    vehicle.Sens = newDir;
    vehicle.rotation = vehicle.targetRotation;
    vehicle.turnStartPosition = vehicle.currentPosition;
    vehicle.Voie = 'Lane2';
  }
}

function updateExitingTurn(vehicle, dt) {
  const multipliers = getDirectionMultipliers(vehicle.Sens);

  vehicle.position.x += vehicle.currentSpeed * dt * multipliers.x;
  vehicle.position.z += vehicle.currentSpeed * dt * multipliers.z;
  vehicle.currentPosition += vehicle.currentSpeed * dt;

  const distanceTraveled = vehicle.currentPosition - vehicle.turnStartPosition;
  if (distanceTraveled >= CONFIG.EXITING_TURN_DISTANCE) {
    vehicle.turnState = 'STRAIGHT';
    // Re-randomize turn direction for potential next intersection
    const turnRandom = Math.random();
    vehicle.turnDirection = turnRandom < 0.5 ? 'straight' : (turnRandom < 0.75 ? 'left' : 'right');
    vehicle.turnStartPosition = 0;
    vehicle.turnIntersection = null;
    vehicle.turnPivot = null;
  }
}

// =============================================================================
//  MAIN PHYSICS UPDATE
// =============================================================================

export function updateVehiclesPhysics(dt, lightsData, localVehicles, localLights, estimatedServerNow, sceneDataRef, setCollisionCount) {
  if (!localVehicles) return;

  const getLightColor = (dir) => {
    const light = localLights[dir];
    return light ? light.color : 'GREEN';
  };

  const { STOP_LINE, SAFE_DISTANCE, STOPPING_BUFFER, COLLISION_THRESHOLD, TURN_COLLISION_RADIUS, REMOVAL_DISTANCE } = PHYSICS;

  const vehicles = Object.values(localVehicles);

  // Group by lane for collision checking
  const lanes = {};
  vehicles.forEach(v => {
    if (v.turnState !== 'STRAIGHT') return;
    const key = `${v.Sens}-${v.Voie}`;
    if (!lanes[key]) lanes[key] = [];
    lanes[key].push(v);
  });

  // Sort cars in each lane by position
  Object.values(lanes).forEach(laneVehicles => {
    laneVehicles.sort((a, b) => b.currentPosition - a.currentPosition);
  });

  // Update each vehicle
  vehicles.forEach(v => {
    if (v.turnState === 'ENTERING_TURN') {
      updateEnteringTurn(v, dt);
      return;
    } else if (v.turnState === 'ROTATING') {
      updateRotatingTurn(v, dt);
      return;
    } else if (v.turnState === 'EXITING_TURN') {
      updateExitingTurn(v, dt);
      return;
    }

    const lightColor = getLightColor(v.Sens);
    const light = localLights[v.Sens];
    const remainingMs = light ? (light.expiresAt - estimatedServerNow) : 0;
    const remainingSec = remainingMs / 1000;
    let shouldStop = false;
    let targetStopPosition = null;

    const distToCenter = Math.sqrt(v.position.x ** 2 + v.position.z ** 2);

    // Check if vehicle is near any intersection and should turn
    const intersections = sceneDataRef.current.intersections || INTERSECTION_CONFIGS.intersection;
    const TURN_TRIGGER_RADIUS = 10;

    for (const intersection of intersections) {
      const distToIntersection = Math.sqrt(
        (v.position.x - (intersection.x + .2)) ** 2 +
        (v.position.z - (intersection.z + .2)) ** 2
      );

      // Check if we haven't already turned at this intersection
      const intersectionKey = `${intersection.x},${intersection.z}`;
      if (!v.visitedIntersections) v.visitedIntersections = new Set();

      if (distToIntersection < TURN_TRIGGER_RADIUS &&
        !v.visitedIntersections.has(intersectionKey) &&
        shouldInitiateTurn(v)) {
        v.visitedIntersections.add(intersectionKey);
        v.turnState = 'ENTERING_TURN';
        v.turnStartPosition = v.currentPosition;
        v.turnIntersection = { x: intersection.x, z: intersection.z };
        return;
      }
    }

    const key = `${v.Sens}-${v.Voie}`;
    const laneVehicles = lanes[key] || [];
    const myIndex = laneVehicles.indexOf(v);

    if (myIndex > 0) {
      const carAhead = laneVehicles[myIndex - 1];
      const distanceToCarAhead = carAhead.currentPosition - v.currentPosition;

      if (distanceToCarAhead < SAFE_DISTANCE + STOPPING_BUFFER) {
        shouldStop = true;
        targetStopPosition = carAhead.currentPosition - SAFE_DISTANCE;
      }
    }

    // Check if vehicle is within the light zone (near traffic light)
    const currentMapId = sceneDataRef.current.currentMapId || 'intersection';
    const lightZone = LIGHT_ZONE_CONFIGS[currentMapId] || LIGHT_ZONE_CONFIGS.intersection;
    const distToLightZone = Math.sqrt(
      (v.position.x - lightZone.x) ** 2 +
      (v.position.z - lightZone.z) ** 2
    );
    const isInLightZone = distToLightZone < PHYSICS.LIGHT_ZONE_RADIUS;

    if (!shouldStop && isInLightZone && (lightColor === 'RED' || lightColor === 'YELLOW')) {
      if (v.currentPosition >= STOP_LINE) {
        // Already past stop line
      } else {
        const commitTimeThreshold = 1.0;
        const closeDistanceThreshold = 10;
        const shouldCommit = remainingSec <= commitTimeThreshold &&
          v.currentPosition >= STOP_LINE - closeDistanceThreshold;

        if (!shouldCommit) {
          const deceleration = 25;
          const stopDistance = (v.currentSpeed ** 2) / (2 * deceleration);

          if (v.currentPosition + stopDistance >= STOP_LINE - STOPPING_BUFFER) {
            shouldStop = true;
            targetStopPosition = STOP_LINE;
          }
        }
      }
    }

    if (shouldStop) {
      const distanceToStop = targetStopPosition ? (targetStopPosition - v.currentPosition) : 0;

      if (distanceToStop < 0.5) {
        v.currentSpeed = 0;
      } else {
        const decelerationRate = distanceToStop < 5 ? 20 : 15;
        v.currentSpeed = Math.max(0, v.currentSpeed - decelerationRate * dt);
      }
      v.waiting = true;
    } else {
      const targetSpeed = v.Speed;
      v.currentSpeed = Math.min(targetSpeed, v.currentSpeed + 15 * dt);
      v.waiting = false;
    }

    const multipliers = getDirectionMultipliers(v.Sens);
    v.position.x += v.currentSpeed * dt * multipliers.x;
    v.position.z += v.currentSpeed * dt * multipliers.z;
    v.currentPosition += v.currentSpeed * dt;
  });

  // Collision detection
  const collidedPairs = sceneDataRef.current.collidedPairs;
  const currentCollidingPairs = new Set();

  // Lane-based collision
  Object.values(lanes).forEach(laneVehicles => {
    for (let i = 0; i < laneVehicles.length - 1; i++) {
      const v1 = laneVehicles[i];
      const v2 = laneVehicles[i + 1];
      const distance = Math.abs(v1.currentPosition - v2.currentPosition);

      if (distance < COLLISION_THRESHOLD) {
        const pairId = v1.Id < v2.Id ? `${v1.Id}-${v2.Id}` : `${v2.Id}-${v1.Id}`;
        currentCollidingPairs.add(pairId);

        if (!collidedPairs.has(pairId)) {
          collidedPairs.add(pairId);
          sceneDataRef.current.collisionCount++;
          setCollisionCount(sceneDataRef.current.collisionCount);
        }
      }
    }
  });

  // Spatial collision for turning vehicles
  const turningVehicles = vehicles.filter(v => v.turnState === 'ROTATING');
  if (turningVehicles.length > 0) {
    for (let i = 0; i < vehicles.length; i++) {
      for (let j = i + 1; j < vehicles.length; j++) {
        const v1 = vehicles[i];
        const v2 = vehicles[j];

        if (v1.turnState === 'STRAIGHT' && v2.turnState === 'STRAIGHT') continue;

        const dist = Math.sqrt(
          (v1.position.x - v2.position.x) ** 2 +
          (v1.position.z - v2.position.z) ** 2
        );

        const threshold = (v1.turnState === 'ROTATING' || v2.turnState === 'ROTATING') ?
          TURN_COLLISION_RADIUS : COLLISION_THRESHOLD;

        if (dist < threshold) {
          const pairId = v1.Id < v2.Id ? `${v1.Id}-${v2.Id}` : `${v2.Id}-${v1.Id}`;
          currentCollidingPairs.add(pairId);

          if (!collidedPairs.has(pairId)) {
            collidedPairs.add(pairId);
            sceneDataRef.current.collisionCount++;
            setCollisionCount(sceneDataRef.current.collisionCount);
          }
        }
      }
    }
  }

  // Clean up old pairs
  collidedPairs.forEach(pairId => {
    if (!currentCollidingPairs.has(pairId)) {
      const [id1, id2] = pairId.split('-');
      if (!localVehicles[id1] || !localVehicles[id2]) {
        collidedPairs.delete(pairId);
      }
    }
  });

  // Remove vehicles that have left the scene (based on actual position, not distance traveled)
  const SCENE_BOUNDARY = PHYSICS.SCENE_BOUNDARY || 140;
  Object.keys(localVehicles).forEach(id => {
    const vehicle = localVehicles[id];
    // Remove if vehicle is outside scene boundary in any direction
    if (Math.abs(vehicle.position.x) > SCENE_BOUNDARY ||
      Math.abs(vehicle.position.z) > SCENE_BOUNDARY) {
      delete localVehicles[id];
      collidedPairs.forEach(pairId => {
        if (pairId.includes(id)) {
          collidedPairs.delete(pairId);
        }
      });
    }
  });
}

// =============================================================================
//  VEHICLE MESH UPDATE
// =============================================================================

export function updateVehicleMeshes(localVehicles, scene, vehiclesRef, sceneDataRef) {
  if (!localVehicles) return;

  const { LANE_OFFSET, ROAD_HEIGHT, VEHICLE_Y } = CONFIG;
  const presentIds = new Set();

  Object.values(localVehicles).forEach(vehicle => {
    presentIds.add(vehicle.Id);

    let mesh = vehiclesRef[vehicle.Id];

    if (!mesh) {
      // Create shared geometry/materials if not exists
      if (!sceneDataRef.current.vehicleMeshesShared) {
        sceneDataRef.current.vehicleMeshesShared = {
          bodyGeo: new THREE.BoxGeometry(1.8, 0.8, 3.5),
          roofGeo: new THREE.BoxGeometry(1.4, 0.5, 1.8),
          bodyMats: VEHICLE_COLORS.map(c => new THREE.MeshLambertMaterial({ color: c })),
          roofMat: new THREE.MeshLambertMaterial({ color: '#333333' })
        };
      }

      const colorIndex = vehicle.Id % sceneDataRef.current.vehicleMeshesShared.bodyMats.length;
      const bodyMat = sceneDataRef.current.vehicleMeshesShared.bodyMats[colorIndex];
      mesh = new THREE.Mesh(sceneDataRef.current.vehicleMeshesShared.bodyGeo, bodyMat);
      mesh.castShadow = true;
      scene.add(mesh);
      vehiclesRef[vehicle.Id] = mesh;

      const roof = new THREE.Mesh(sceneDataRef.current.vehicleMeshesShared.roofGeo, sceneDataRef.current.vehicleMeshesShared.roofMat);
      roof.position.y = 0.6;
      roof.position.z = -0.3;
      mesh.add(roof);
    }

    // Handle fading
    if (vehicle.fading) {
      const fadeTime = (performance.now() - vehicle.fadeStart) / 1000;
      const opacity = Math.max(0, 1 - fadeTime / 2);
      mesh.material.opacity = opacity;
      mesh.material.transparent = true;
      if (opacity <= 0) {
        vehicle.toRemove = true;
      }
    } else {
      mesh.material.opacity = 1;
      mesh.material.transparent = false;
    }

    mesh.position.set(vehicle.position.x, VEHICLE_Y, vehicle.position.z);

    if (vehicle.turnState !== 'STRAIGHT') {
      mesh.rotation.y = vehicle.rotation;
    } else {
      mesh.rotation.y = calculateCurrentRotation(vehicle.Sens);
    }

    const brakeLightColor = vehicle.waiting ? 0xff0000 : 0x333333;
    if (mesh.children[0] && mesh.children[0].material.color.getHex() !== brakeLightColor) {
      mesh.children[0].material.color.setHex(brakeLightColor);
    }
  });

  // Remove faded vehicles
  Object.keys(localVehicles).forEach(id => {
    if (localVehicles[id].toRemove) {
      delete localVehicles[id];
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
