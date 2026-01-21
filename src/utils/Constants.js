// =============================================================================
//  CONFIGURATION
// =============================================================================

export const CONFIG = {
  // Road dimensions
  ROAD_WIDTH: 10,
  ROAD_LENGTH: 120,
  ROAD_HEIGHT: 0.2,
  
  // Traffic lights
  LIGHT_DISTANCE: 14,  // Distance from center
  LANE_OFFSET: 2.5,    // Lane offset from center line
  
  // Vehicle settings
  VEHICLE_Y: 0.5,
  
  // Turn settings (all position-based for uniform arcs)
  TURN_TRIGGER_POSITION: 38,    // Position to start turn (after stop line at 35)
  ENTERING_TURN_DISTANCE: 2,    // Distance to travel while entering turn
  ROTATION_DISTANCE: 9.54,      // Distance to travel during 90° turn
  EXITING_TURN_DISTANCE: 2,     // Distance to travel while exiting turn
  TURN_SPEED_FACTOR: 0.8,       // Speed multiplier during turn
};

// =============================================================================
//  MAP CONFIGURATIONS
// =============================================================================

export const MAP_CONFIGS = {
  intersection: {
    id: 'intersection',
    name: 'Simple Intersection',
    description: '4-way intersection with traffic lights',
    icon: '✚',
    preview: '#3498db'
  },
  rainyIntersection: {
    id: 'rainyIntersection',
    name: 'Rainy Intersection',
    description: 'Wet roads with rain weather conditions',
    icon: '🌧️',
    preview: '#5d6d7e'
  },
  desertIntersection: {
    id: 'desertIntersection',
    name: 'Desert Intersection',
    description: 'Sandy terrain with hot desert landscape',
    icon: '🏜️',
    preview: '#d4ac6e'
  },
  snowyIntersection: {
    id: 'snowyIntersection',
    name: 'Snowy Intersection',
    description: 'Snow-covered roads in winter conditions',
    icon: '❄️',
    preview: '#aed6f1'
  },
  cityGrid: {
    id: 'cityGrid',
    name: 'City Grid',
    description: 'Multiple intersections in a grid layout',
    icon: '▦',
    preview: '#e74c3c'
  }
};

// =============================================================================
//  DIRECTION MAPPINGS
// =============================================================================

export const DIRECTIONS = {
  N: { index: 0, name: 'North', angle: Math.PI },      // Cars coming FROM south, going north
  E: { index: 1, name: 'East',  angle: Math.PI / 2 },  // Cars coming FROM west, going east
  S: { index: 2, name: 'South', angle: 0 },            // Cars coming FROM north, going south  
  W: { index: 3, name: 'West',  angle: -Math.PI / 2 }  // Cars coming FROM east, going west
};

// =============================================================================
//  PHYSICS CONSTANTS
// =============================================================================

export const PHYSICS = {
  STOP_LINE: 35,           // Position where cars should stop
  SAFE_DISTANCE: 4,        // Minimum distance between cars
  STOPPING_BUFFER: 2,      // Extra buffer to start stopping
  COLLISION_THRESHOLD: 2.5,// Distance threshold for collision detection
  TURN_COLLISION_RADIUS: 3.0, // Larger radius for turning vehicles
  REMOVAL_DISTANCE: 120    // Remove vehicles that have traveled too far
};

// =============================================================================
//  VEHICLE COLORS
// =============================================================================

export const VEHICLE_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
