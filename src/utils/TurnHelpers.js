import { DIRECTIONS, CONFIG } from './Constants';

// =============================================================================
//  TURN HELPER FUNCTIONS
// =============================================================================

export function calculateCurrentRotation(direction) {
  return DIRECTIONS[direction]?.angle || 0;
}

export function calculateTargetRotation(currentDir, turnType) {
  const current = calculateCurrentRotation(currentDir);
  if (turnType === 'right') {
    return current - Math.PI / 2; // 90° clockwise
  } else if (turnType === 'left') {
    return current + Math.PI / 2; // 90° counter-clockwise
  }
  return current;
}

export function getNewDirection(currentDir, turnType) {
  const turnMap = {
    'N': { left: 'W', right: 'E' },
    'E': { left: 'N', right: 'S' },
    'S': { left: 'E', right: 'W' },
    'W': { left: 'S', right: 'N' }
  };
  return turnMap[currentDir]?.[turnType] || currentDir;
}

export function shouldInitiateTurn(vehicle) {
  if (vehicle.turnDirection === 'straight') return false;
  if (vehicle.turnState !== 'STRAIGHT') return false;
  
  // Turn should start when vehicle reaches the intersection center area
  // Stop line is at 35, turn starts shortly after
  return vehicle.currentPosition >= CONFIG.TURN_TRIGGER_POSITION;
}

export function getDirectionMultipliers(direction) {
  // These define which way a car MOVES based on its direction
  // N = going north = moving in -Z direction (from south to north in world coords)
  // S = going south = moving in +Z direction (from north to south in world coords)
  // E = going east = moving in +X direction
  // W = going west = moving in -X direction
  const multipliers = {
    'N': { x: 0, z: -1 },  // North-bound cars move toward -Z
    'S': { x: 0, z: 1 },   // South-bound cars move toward +Z
    'E': { x: 1, z: 0 },   // East-bound cars move toward +X
    'W': { x: -1, z: 0 }   // West-bound cars move toward -X
  };
  return multipliers[direction] || { x: 0, z: 0 };
}
