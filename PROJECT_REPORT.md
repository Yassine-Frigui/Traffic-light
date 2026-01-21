# Traffic Light Simulation System - Technical Report

**Project:** Real-Time Traffic Light Intersection Simulation  
**Author:** Yassine Frigui  
**Date:** January 2026  
**Technologies:** React, Three.js, Python (aiohttp), WebSocket

---

## Executive Summary

This project implements a real-time traffic light simulation system featuring a 3D visualization frontend built with React and Three.js, connected to a Python WebSocket server that generates realistic traffic patterns. The system demonstrates advanced software engineering principles including modular architecture, real-time bidirectional communication, and production-ready security measures.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Backend Implementation](#2-backend-implementation)
3. [Frontend Implementation](#3-frontend-implementation)
4. [Communication Protocol](#4-communication-protocol)
5. [Technical Features](#5-technical-features)
6. [Development Approach](#6-development-approach)
7. [Deployment Strategy](#7-deployment-strategy)

---

## 1. System Architecture

### 1.1 Overall Architecture

The system follows a **client-server architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│         Frontend (React + Three.js)     │
│  • 3D Visualization                     │
│  • User Interface                       │
│  • Vehicle Physics                      │
│  • Collision Detection                  │
└──────────────┬──────────────────────────┘
               │ WebSocket (JSON)
               │ Real-time bidirectional
┌──────────────▼──────────────────────────┐
│       Backend (Python aiohttp)          │
│  • Traffic State Generation             │
│  • Traffic Light Controller             │
│  • Event System                         │
│  • Security & Rate Limiting             │
└─────────────────────────────────────────┘
```

### 1.2 Technology Stack

**Frontend:**
- React 18 (UI framework)
- Three.js r160 (3D rendering)
- Vite 5 (build tool, development server)
- Native WebSocket API

**Backend:**
- Python 3.12
- aiohttp 3.9 (async HTTP/WebSocket server)
- python-dotenv (environment configuration)

**Deployment:**
- Netlify (frontend hosting)
- Render.com (backend hosting)

---

## 2. Backend Implementation

### 2.1 Modular Structure

The backend is organized into three distinct modules for maintainability and testability:

#### **traffic.py** (Main Entry Point)
- Orchestrates application startup
- Loads environment variables
- Initializes simulator and server
- Handles graceful shutdown

```python
# Responsibilities:
- Configuration loading (.env)
- Component initialization
- Error handling and logging setup
```

#### **traffic_simulation.py** (Business Logic)
- **TrafficLightController**: State machine managing light transitions
  - Implements proper GREEN → YELLOW → RED cycles
  - Synchronized transitions (N/S pair vs E/W pair)
  - Configurable timing (30s green, 3s yellow)

- **TrafficSimulator**: Generates traffic states
  - Vehicle spawning based on traffic flow
  - Event system (Rush Hour, Accidents, Weather)
  - Position-based vehicle placement

```python
# Core state machine logic:
GREEN (30s) → YELLOW (3s) → RED (33s)
    ↓                           ↓
Opposite direction turns GREEN
```

#### **server.py** (Network Layer)
- **WebSocketServer**: Manages all network operations
  - Client connection handling
  - Security checks (origin, rate limiting, max clients)
  - State broadcasting (0.1s update cycle)
  - Health check and metrics endpoints

### 2.2 Traffic Light State Machine

The traffic light controller uses a **paired state machine** approach:

**Design Decision:**
- North/South lights operate as a synchronized pair
- East/West lights operate as a synchronized pair
- Only one pair can be GREEN at a time
- YELLOW transition ensures safety (3 seconds buffer)

**Implementation:**
```python
def _check_transition(dir1, dir2, opp1, opp2):
    # dir1/dir2: Current pair (e.g., N/S)
    # opp1/opp2: Opposite pair (e.g., E/W)
    
    if timer <= 0:
        if current == GREEN:
            # Safety transition
            change to YELLOW (3 seconds)
        elif current == YELLOW:
            # Switch to opposite direction
            current pair → RED
            opposite pair → GREEN
```

### 2.3 Event System

The simulation includes a weighted random event system:

**Events:**
- Rush Hour (1.8× traffic flow)
- Accident (0.4× traffic flow)
- Bad Weather (0.6× traffic flow)
- Event Nearby (2.0× traffic flow)
- Construction (0.5× traffic flow)
- None (normal traffic) - 3× weight

**Flow Calculation:**
```python
base_flow = 10 vehicles/minute
actual_flow = base_flow × event_multiplier × random(0.8, 1.2)
```

### 2.4 Vehicle Generation

**Approach:**
- Spawn 1-6 vehicles per direction per interval
- Position vehicles in a queue with spacing (8-15 units)
- Nearest vehicle placed before stop line (position 35)
- Each vehicle assigned unique ID, speed (8-15), and lane

**Spatial Logic:**
```
Stop Line at position 35
↓
Vehicle spacing: 8-15 units
Vehicle 1: position 20
Vehicle 2: position 8
Vehicle 3: position -5
etc.
```

### 2.5 Security Implementation

**Origin Validation:**
```python
# Checks Origin header against whitelist
# Prevents unauthorized domains from connecting
allowed_origins = [
    'https://iteam-traffic-light.netlify.app',
    'http://localhost:5173',
    'http://localhost:5174'
]
```

**Rate Limiting:**
- 10 connections per IP per 60-second window
- Sliding window implementation
- Automatic cleanup of expired timestamps

**Connection Limits:**
- Maximum 100 concurrent clients
- Returns 503 (Service Unavailable) when full
- Heartbeat pings every 30 seconds to detect dead connections

**Message Size Limits:**
- Maximum 1KB incoming message size
- Prevents memory exhaustion attacks

### 2.6 Broadcasting Strategy

**Update Cycle:**
```
Every 0.1 seconds:
    - Update traffic light timers
    - Check for color changes
    
Every 1 second:
    - Broadcast light timer updates (if changed)
    
Every 60 seconds:
    - Generate new traffic state
    - Spawn new vehicles
    - Pick new event
    - Broadcast full state reset
```

**Optimization:**
- Only broadcast when state changes
- Track last colors and timers to avoid duplicates
- Clean up dead WebSocket connections

---

## 3. Frontend Implementation

### 3.1 Component Architecture

The frontend follows a **modular component-based architecture**:

```
src/
├── ThreeScene.jsx          (Main orchestrator)
├── utils/
│   ├── Constants.js        (Configuration)
│   └── TurnHelpers.js      (Turn calculations)
├── scene/
│   ├── MapBuilders.js      (Map generation)
│   ├── TrafficLights.js    (Light rendering)
│   └── VehiclePhysics.js   (Physics engine)
└── components/
    ├── HUD.jsx             (Status displays)
    ├── LoadingScreen.jsx   (Transitions)
    └── MapSidebar.jsx      (Map selection)
```

### 3.2 Configuration System

**Constants.js** centralizes all configuration:

```javascript
CONFIG = {
    ROAD_WIDTH: 10,
    ROAD_LENGTH: 120,
    LIGHT_DISTANCE: 14,
    TURN_TRIGGER_POSITION: 38,
    ENTERING_TURN_DISTANCE: 2,
    ROTATION_DISTANCE: 9.54,
    EXITING_TURN_DISTANCE: 2
}

PHYSICS = {
    STOP_LINE: 35,
    SAFE_DISTANCE: 4,
    COLLISION_THRESHOLD: 2.5,
    REMOVAL_DISTANCE: 120
}
```

**Benefit:** Single source of truth for tuning behavior

### 3.3 Map System

**Five distinct map types:**

1. **Simple Intersection** - Basic 4-way intersection
2. **Rainy Intersection** - Dark asphalt, rain effects, wet look
3. **Desert Intersection** - Sandy terrain, warm colors
4. **Snowy Intersection** - White roads, winter atmosphere
5. **City Grid** - Multiple intersections in grid layout

**Implementation Approach:**
```javascript
function buildMapByType(scene, trafficLights, mapId) {
    switch(mapId) {
        case 'rainyIntersection':
            // Dark gray asphalt
            // Blue-tinted ambient
            // Puddle effects
        case 'desertIntersection':
            // Sandy ground texture
            // Warm lighting
            // Desert colors
        // ... etc
    }
}
```

**Map Switching:**
- Smooth loading transitions with progress bar
- Cleanup of previous map geometry
- Preservation of vehicle state during transition
- Fade-out/fade-in animation

### 3.4 Vehicle Physics Engine

**Turn State Machine:**

The vehicle physics implements a **4-state turn system**:

```
STRAIGHT → ENTERING_TURN → ROTATING → EXITING_TURN → STRAIGHT
```

**State Breakdown:**

1. **STRAIGHT**
   - Normal forward movement
   - Stop line detection
   - Traffic light obedience
   - Following distance maintenance

2. **ENTERING_TURN** (2 units)
   - Pre-turn positioning
   - Gradual approach to arc
   - Maintains current direction

3. **ROTATING** (9.54 units)
   - 90-degree rotation over distance
   - Curved path (arc interpolation)
   - Different radii for left/right turns
   - Speed reduced by 0.8× during turn

4. **EXITING_TURN** (2 units)
   - Straightening out
   - Transition to new direction
   - Lane change to outer lane

**Turn Direction Logic:**
```javascript
// Random assignment when vehicle spawns:
turnDirection = random < 0.5 ? 'straight' :
                random < 0.75 ? 'left' : 'right'
                
// 50% straight, 25% left, 25% right
```

**Arc Calculation for Turns:**
```javascript
// Blend between current and new direction
const easedProgress = sin(turnProgress × π / 2);

// Right turn: tighter radius
blendedX = currentDir × (1.5 - progress) + newDir × progress

// Left turn: wider radius with lateral push
blendedX = currentDir × (2 - earlyProgress) + newDir × lateProgress
lateralPush = sin(progress × π) × 0.4
```

### 3.5 Traffic Light System

**Visual Components:**
- Steel pole (0.15m radius, 6m height)
- Housing (1.0m × 3.0m × 0.8m black box)
- Three bulbs (red, yellow, green)
- Canvas-based timer display
- Direction label (NORTH, SOUTH, EAST, WEST)

**Update Strategy:**
```javascript
// Only update when necessary
if (color changed) {
    // Dim all bulbs
    red.color = #330000
    yellow.color = #333300
    green.color = #003300
    
    // Light active bulb
    activeBulb.color = full brightness
}

if (timer changed OR 250ms elapsed) {
    // Redraw canvas
    updateTimerDisplay(remainingSeconds)
}
```

**Timer Interpolation:**
```javascript
// Server sends ExpiresAt timestamp
estimatedServerNow = serverTime + (localElapsed - packetTime)
remainingMs = expiresAt - estimatedServerNow
remainingSec = remainingMs / 1000

// Smooth countdown without jerky updates
```

### 3.6 Collision Detection System

**Approach: Spatial Proximity Check**

```javascript
// For each vehicle pair:
const dx = v1.position.x - v2.position.x;
const dz = v1.position.z - v2.position.z;
const distance = sqrt(dx² + dz²);

// Different thresholds:
if (vehicle is turning) {
    threshold = 3.0 units  // Larger radius
} else {
    threshold = 2.5 units  // Normal radius
}

if (distance < threshold) {
    COLLISION_DETECTED
}
```

**Collision Tracking:**
- Unique pair identifier: `"${id1}-${id2}"`
- Set data structure prevents duplicate counts
- Persistent counter across simulation intervals

**Visual Feedback:**
- Collision counter in HUD
- Red warning color when collisions detected

### 3.7 Stopping Logic

**Multi-Factor Decision System:**

```javascript
// Factor 1: Traffic Light State
if (light is RED or YELLOW) {
    if (not past stop line) {
        // Calculate deceleration
        stopDistance = speed² / (2 × deceleration)
        
        if (position + stopDistance >= stopLine) {
            STOP_AT_LINE
        }
    }
}

// Factor 2: Vehicle Ahead
if (car ahead in same lane) {
    distanceToCarAhead = ahead.position - current.position
    
    if (distanceToCarAhead < SAFE_DISTANCE + BUFFER) {
        STOP_BEHIND_CAR
    }
}

// Factor 3: Yellow Light Commitment
if (light is YELLOW) {
    if (remainingTime <= 1.0s && distance < 10 units) {
        // Too close to stop safely
        COMMIT_AND_PROCEED
    }
}
```

**Deceleration Curve:**
```javascript
if (shouldStop) {
    const distanceToStop = targetPosition - currentPosition;
    const deceleration = 25; // units/s²
    
    if (distanceToStop > 0.5) {
        // Smooth deceleration
        speed = max(0, speed - deceleration × dt);
    } else {
        // Full stop
        speed = 0;
    }
}
```

### 3.8 User Interface Components

**HUD Elements:**

1. **Connection Status**
   - Green indicator when connected
   - Red indicator when disconnected
   - Real-time WebSocket state

2. **Pause Button**
   - Toggles simulation
   - Visual feedback (color change)
   - Hover animation (scale 1.05×)

3. **Current Map Display**
   - Map icon and name
   - Background color from map config
   - Always visible during simulation

4. **Traffic State HUD**
   - Displays current event
   - Color-coded border (red/yellow/green)
   - Shows traffic flow status

5. **Collision Counter**
   - Persistent count
   - Warning color when > 0
   - Updates in real-time

6. **Day/Night Cycle**
   - Time display (0-24 hours)
   - Progress bar visualization
   - Gradual lighting changes

7. **Active Event Display**
   - Large banner when event active
   - Event icon and description
   - Auto-hide for normal traffic

8. **Instructions Panel**
   - Keyboard controls
   - Mouse interactions
   - Tips for users

**Map Sidebar:**
- Grid layout of map options
- Hover effects (scale + glow)
- Current map highlighted
- Loading state during transitions

**Loading Screen:**
- Full-screen overlay
- Progress bar (0-100%)
- Map name and icon
- Smooth fade transitions

---

## 4. Communication Protocol

### 4.1 WebSocket Message Format

**Server → Client (State Broadcast):**

```json
{
  "Lights": [
    {
      "Sens": "N",
      "Couleur": "GREEN",
      "Timer": 27.3,
      "TimerMs": 27300,
      "ExpiresAt": 1737486156234
    },
    // ... S, E, W
  ],
  "Vehicles": [
    {
      "Id": 142,
      "Sens": "N",
      "Voie": "Lane1",
      "Position": 15.2,
      "Speed": 12.4,
      "Waiting": false
    },
    // ... more vehicles
  ],
  "Traffic": [
    {
      "direction": "N",
      "flow": 18,
      "event": {
        "name": "Rush Hour",
        "flow_mult": 1.8
      }
    },
    // ... S, E, W
  ],
  "Event": {
    "name": "Rush Hour",
    "flow_mult": 1.8
  },
  "Interval": 60,
  "Reset": true,
  "ServerTime": 1737486129234
}
```

**Field Descriptions:**

- **Lights**: Array of current traffic light states
  - `Sens`: Direction (N/S/E/W)
  - `Couleur`: Color (RED/YELLOW/GREEN)
  - `Timer`: Remaining seconds (float)
  - `ExpiresAt`: Exact timestamp when timer reaches 0

- **Vehicles**: Array of active vehicles
  - `Id`: Unique identifier
  - `Sens`: Travel direction
  - `Voie`: Lane (Lane1 or Lane2)
  - `Position`: Distance traveled from spawn
  - `Speed`: Current speed in units/second

- **Traffic**: Flow information per direction
  - `flow`: Vehicles per minute
  - `event`: Current traffic modifier

- **Reset**: Boolean flag to clear old vehicles
- **ServerTime**: Server's current timestamp (for sync)

### 4.2 Connection Lifecycle

**1. Connection Establishment:**
```
Client → Server: WebSocket upgrade request
                 Origin: https://iteam-traffic-light.netlify.app

Server → Client: 
    IF (origin valid AND rate limit OK AND slots available)
        → 101 Switching Protocols
        → Send current state immediately
    ELSE
        → 403 Forbidden (invalid origin)
        → 429 Too Many Requests (rate limited)
        → 503 Service Unavailable (full)
```

**2. Active Connection:**
```
Every 0.1s: Server updates light timers
Every 1.0s: Server broadcasts light changes
Every 30s: Server sends ping (heartbeat)
Every 60s: Server generates new full state
```

**3. Disconnection:**
```
Client closes → Server removes from client set
Client unresponsive → Heartbeat timeout → Auto-disconnect
Server shutdown → Graceful close all connections
```

### 4.3 Time Synchronization

**Problem:** Client and server clocks may differ, causing timer inaccuracies.

**Solution: Server-Authoritative Timing**

```javascript
// On each packet received:
const serverTime = data.ServerTime;
const packetReceivedAt = performance.now();

// Store these values
lastServerTime = serverTime;
lastPacketTime = packetReceivedAt;

// When rendering (every frame):
const localElapsed = performance.now() - lastPacketTime;
const estimatedServerNow = lastServerTime + localElapsed;

// Calculate remaining time:
const remainingMs = light.ExpiresAt - estimatedServerNow;
const remainingSec = Math.max(0, remainingMs / 1000);
```

**Result:** Smooth, accurate countdown without network jitter

---

## 5. Technical Features

### 5.1 Camera System

**Interactive Camera Controls:**

```javascript
// Mouse drag to rotate camera
onMouseMove: (dx, dy) => {
    azimuthalAngle += dx × 0.003  // Horizontal rotation
    polarAngle += dy × 0.003      // Vertical rotation
    
    // Clamp polar angle (prevent flipping)
    polarAngle = clamp(0.1, Math.PI - 0.1)
}

// Scroll to zoom
onWheel: (delta) => {
    distance += delta × 0.001
    distance = clamp(20, 200)  // Min/max zoom
}

// Convert spherical → Cartesian coordinates
camera.position.x = distance × sin(polar) × cos(azimuthal)
camera.position.y = distance × cos(polar)
camera.position.z = distance × sin(polar) × sin(azimuthal)

camera.lookAt(0, 0, 0)  // Always look at center
```

**Initial Position:**
- Distance: 60 units
- Polar angle: 65° (elevated view)
- Azimuthal angle: 45° (diagonal perspective)

### 5.2 Performance Optimizations

**Geometry Reuse:**
```javascript
// Create shared geometry once
const vehicleGeometry = new BoxGeometry(2, 1, 4);

// Reuse for all vehicles (saves memory)
const mesh = new Mesh(vehicleGeometry.clone(), material);
```

**Frustum Culling:**
- Three.js automatically culls off-screen objects
- Vehicles beyond 120 units are removed

**Update Throttling:**
```javascript
// Canvas updates throttled to 250ms
if (now - lastCanvasUpdate > 250) {
    redrawTimerCanvas();
    lastCanvasUpdate = now;
}
```

**Dead Connection Cleanup:**
```javascript
// Remove closed WebSocket connections
for (ws of clients) {
    if (ws.closed) {
        dead_clients.add(ws);
    }
}
clients.difference_update(dead_clients);
```

### 5.3 State Management

**React State:**
```javascript
const [connected, setConnected] = useState(false);
const [paused, setPaused] = useState(false);
const [currentMap, setCurrentMap] = useState('intersection');
const [collisionCount, setCollisionCount] = useState(0);
```

**Refs for Three.js:**
```javascript
sceneDataRef.current = {
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    vehicles: {},           // id → mesh
    trafficLights: {},      // direction → light data
    localVehicles: {},      // id → physics state
    simulationData: null,   // Latest server packet
    collisionCount: 0,
    collidedPairs: Set      // Track unique collisions
};
```

**Why Refs?**
- Avoid re-renders on every frame
- Direct access to Three.js objects
- Persist across component lifecycle

### 5.4 Animation Loop

**60 FPS Rendering:**

```javascript
function animate() {
    requestAnimationFrame(animate);
    
    if (paused) return;  // Skip when paused
    
    const dt = clock.getDelta();
    
    // 1. Update physics
    updateVehiclesPhysics(dt, ...);
    
    // 2. Update vehicle meshes
    updateVehicleMeshes(vehicles, localVehicles);
    
    // 3. Update traffic lights
    updateTrafficLights(trafficLights, localLights, dt, serverTime);
    
    // 4. Update day/night cycle
    updateLighting(dayTime);
    
    // 5. Render scene
    renderer.render(scene, camera);
}
```

**Delta Time (dt):**
- Ensures consistent physics regardless of frame rate
- 60 FPS: dt ≈ 0.0167 seconds
- 30 FPS: dt ≈ 0.0333 seconds
- Same behavior at any frame rate

---

## 6. Development Approach

### 6.1 Iterative Development Process

**Phase 1: Proof of Concept**
- Basic intersection rendering
- Simple vehicle movement
- Traffic light state machine
- WebSocket connection

**Phase 2: Core Features**
- Proper turn logic
- Collision detection
- Multiple maps
- Event system
- Stopping logic

**Phase 3: Polish & UX**
- HUD components
- Loading transitions
- Map switching
- Pause functionality
- Visual feedback

**Phase 4: Production Readiness**
- Security measures
- Code modularization
- Documentation
- Deployment configuration
- Performance optimization

### 6.2 Problem-Solving Approach

**Challenge: Realistic Turn Behavior**

*Initial Problem:* Vehicles making instant 90° turns looked unnatural.

*Solution Evolution:*
1. Simple arc interpolation → Too robotic
2. Bezier curves → Difficult to control
3. **Multi-state system with distance-based progression** ← Final solution
   - ENTERING_TURN: Gradual approach (2 units)
   - ROTATING: Curved path with direction blending (9.54 units)
   - EXITING_TURN: Straightening (2 units)

**Challenge: Smooth Traffic Light Timers**

*Initial Problem:* Server updates every 1 second caused jerky countdowns.

*Solution Evolution:*
1. Linear interpolation between packets → Still jerky
2. **Client-side timer extrapolation using ExpiresAt timestamps** ← Final solution
   - Server provides exact expiration time
   - Client calculates remaining time each frame
   - Smooth countdown regardless of packet rate

**Challenge: Collision Detection**

*Initial Problem:* Too many false positives, performance issues.

*Solution Evolution:*
1. Check all pairs every frame → O(n²), too slow
2. Spatial partitioning → Complex, over-engineered
3. **Lane-based grouping + distance threshold** ← Final solution
   - Group vehicles by lane
   - Only check within same/adjacent lanes
   - Different thresholds for turning vs straight

### 6.3 Code Organization Philosophy

**Principles Applied:**

1. **Separation of Concerns**
   - Network logic separated from simulation logic
   - Business logic separated from rendering
   - UI components isolated from physics

2. **Single Responsibility**
   - Each module/component has one clear purpose
   - Functions do one thing well
   - Constants centralized for easy tuning

3. **Configuration Over Code**
   - All magic numbers in Constants.js
   - Environment variables for deployment
   - Easy to adjust behavior without code changes

4. **Defensive Programming**
   - Input validation (WebSocket messages)
   - Null checks before accessing objects
   - Graceful degradation (disconnection handling)

---

## 7. Deployment Strategy

### 7.1 Environment Configuration

**Development Environment:**
```env
# .env
VITE_WS_URL=ws://localhost:8000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
MAX_CLIENTS=100
PROD=0
```

**Production Environment:**
```env
# Netlify
VITE_WS_URL=wss://traffic-light-ugoe.onrender.com

# Render
ALLOWED_ORIGINS=https://iteam-traffic-light.netlify.app
MAX_CLIENTS=100
PORT=10000
```

### 7.2 Build Process

**Frontend (Netlify):**
```bash
# Build command
npm run build

# Output directory
dist/

# Assets
- Bundled JavaScript (code splitting)
- Minified CSS
- Tree-shaken Three.js
- Gzipped assets
```

**Backend (Render):**
```bash
# Build command
pip install -r requirements.txt

# Start command
python traffic.py

# Process
- Load .env
- Initialize simulator
- Start WebSocket server on PORT
- Health check endpoint: /healthz
```

### 7.3 Monitoring

**Backend Metrics Endpoint:**

```
GET /metrics

Response:
{
  "connected_clients": 23,
  "max_clients": 100,
  "uptime_intervals": 147,
  "rate_limited_ips": 2
}
```

**Health Check:**

```
GET /healthz

Response: "OK" (200)
```

**Logging:**
```
[INFO] Client connected from 93.45.67.89 (24 total)
[INFO] Light change: [('N', 'YELLOW'), ('S', 'YELLOW'), ...]
[INFO] New state: Rush Hour traffic, 18 vehicles
[WARNING] Rate limit exceeded for 192.168.1.100
```

### 7.4 Scaling Considerations

**Current Limits:**
- 100 concurrent WebSocket connections
- 10 connections/minute per IP
- 60-second update interval

**Future Scaling Options:**
1. Horizontal scaling with load balancer
2. Redis for shared rate limiting state
3. Message queue for high-traffic scenarios
4. CDN for static assets
5. Database for persistent statistics

---

## Conclusion

This traffic light simulation demonstrates a complete full-stack application with:

✅ **Clean Architecture** - Modular, maintainable codebase  
✅ **Real-Time Communication** - WebSocket with proper synchronization  
✅ **Production Security** - Origin validation, rate limiting, monitoring  
✅ **Rich User Experience** - 3D visualization, interactive controls, multiple maps  
✅ **Deployment Ready** - Environment configuration, documentation, hosting setup  

The project showcases advanced software engineering practices including state machines, physics simulation, real-time networking, and production-grade security measures.

---

**Project Statistics:**

- **Total Lines of Code:** ~3,500
- **Frontend Modules:** 12 files
- **Backend Modules:** 3 files
- **Map Types:** 5 distinct environments
- **Event Types:** 6 traffic scenarios
- **Update Rate:** 10 updates/second (physics), 60 FPS (rendering)
- **Network Latency Tolerance:** ~200ms (graceful degradation)

---

*End of Technical Report*
