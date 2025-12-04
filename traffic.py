"""
Traffic Simulation Server
=========================
WebSocket server for real-time traffic light and vehicle simulation.
Uses dataclasses for clean data structures and dictionaries for state management.
"""

import asyncio
import json
import os
import random
import time
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional
from enum import Enum
import websockets

# =============================================================================
#  CONFIGURATION
# =============================================================================

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 8000))

# Simulation timing
TICK_RATE = 0.5  # seconds between broadcasts (slower = less spam)
VEHICLE_SPAWN_CHANCE = 0.15  # chance per tick to spawn vehicle per direction
EVENT_CHANCE = 0.02  # 2% chance per tick for random event

# =============================================================================
#  ENUMS
# =============================================================================

class LightColor(str, Enum):
    RED = "RED"
    YELLOW = "YELLOW"
    GREEN = "GREEN"

class Direction(str, Enum):
    NORTH = "N"
    SOUTH = "S"
    EAST = "E"
    WEST = "W"

# =============================================================================
#  DATA CLASSES (Records)
# =============================================================================

@dataclass
class TrafficLight:
    """Represents a single traffic light."""
    direction: str
    color: str = "RED"
    duration: float = 6.0  # seconds for current phase
    timer: float = 0.0     # countdown timer
    
    def to_dict(self) -> dict:
        return {
            "Sens": self.direction,
            "Couleur": self.color,
            "Duree": self.duration,
            "Timer": round(self.duration - self.timer, 1)  # Time remaining
        }

@dataclass  
class Vehicle:
    """Represents a vehicle in the simulation."""
    id: int
    direction: str  # Which road it's on (N, S, E, W)
    lane: int       # 1 or 2
    position: float # Distance along road (0 = at light, negative = approaching)
    speed: float = 8.0
    waiting: bool = False
    
    def to_dict(self) -> dict:
        return {
            "Id": self.id,
            "Sens": self.direction,
            "Voie": f"{self.direction}{self.lane}",
            "Position": round(self.position, 1),
            "Velocite": self.speed,
            "Waiting": self.waiting
        }

@dataclass
class TrafficFlow:
    """Traffic flow for a direction."""
    direction: str
    base_flux: int = 10
    current_flux: int = 10
    
    def to_dict(self) -> dict:
        return {
            "Sens": self.direction,
            "Flux": self.current_flux
        }

@dataclass
class TrafficEvent:
    """Random traffic event."""
    name: str
    description: str
    flux_multiplier: float
    duration: float = 30.0  # seconds
    time_remaining: float = 30.0
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "flux_multiplier": self.flux_multiplier,
            "time_remaining": round(self.time_remaining, 1)
        }

# =============================================================================
#  SIMULATION STATE (using dictionaries)
# =============================================================================

class TrafficSimulation:
    """Main simulation state manager."""
    
    # Event templates
    EVENT_TEMPLATES = [
        {"name": "Rush Hour", "description": "Peak traffic period", "flux_multiplier": 1.8},
        {"name": "Accident", "description": "Road incident slowing traffic", "flux_multiplier": 0.5},
        {"name": "Event Nearby", "description": "Local event increasing vehicles", "flux_multiplier": 2.0},
        {"name": "Weather", "description": "Poor weather conditions", "flux_multiplier": 0.7},
        {"name": "Construction", "description": "Road work ahead", "flux_multiplier": 0.6},
        {"name": "School Zone", "description": "School hours - slow traffic", "flux_multiplier": 0.8},
    ]
    
    def __init__(self):
        self.vehicle_counter = 0
        self.last_tick = time.time()
        
        # Traffic lights dictionary: direction -> TrafficLight
        # North-South pair and East-West pair alternate
        self.lights: Dict[str, TrafficLight] = {
            Direction.NORTH: TrafficLight(Direction.NORTH, LightColor.GREEN, 5.0, 0.0),
            Direction.SOUTH: TrafficLight(Direction.SOUTH, LightColor.GREEN, 5.0, 0.0),
            Direction.EAST: TrafficLight(Direction.EAST, LightColor.RED, 6.0, 0.0),
            Direction.WEST: TrafficLight(Direction.WEST, LightColor.RED, 6.0, 0.0),
        }
        
        # Vehicles list
        self.vehicles: List[Vehicle] = []
        
        # Traffic flow per direction
        self.traffic_flow: Dict[str, TrafficFlow] = {
            d: TrafficFlow(d) for d in [Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST]
        }
        
        # Active events
        self.active_events: List[TrafficEvent] = []
        
        # Spawn initial vehicles
        self._spawn_initial_vehicles()
    
    def _spawn_initial_vehicles(self):
        """Spawn some vehicles to start."""
        for direction in [Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST]:
            for i in range(2):
                self._spawn_vehicle(direction, position=-20 - i * 15)
    
    def _spawn_vehicle(self, direction: str, position: float = -50.0) -> Vehicle:
        """Spawn a new vehicle."""
        self.vehicle_counter += 1
        vehicle = Vehicle(
            id=self.vehicle_counter,
            direction=direction,
            lane=random.randint(1, 2),
            position=position,
            speed=random.uniform(6.0, 12.0)
        )
        self.vehicles.append(vehicle)
        return vehicle
    
    def _get_light_for_direction(self, direction: str) -> TrafficLight:
        """Get traffic light for a direction."""
        return self.lights.get(direction)
    
    def _update_lights(self, dt: float):
        """Update all traffic lights with proper cycling."""
        # North-South are paired, East-West are paired
        ns_light = self.lights[Direction.NORTH]  # Use north as reference
        ew_light = self.lights[Direction.EAST]   # Use east as reference
        
        # Update timers
        ns_light.timer += dt
        ew_light.timer += dt
        
        # Sync paired lights
        self.lights[Direction.SOUTH].timer = ns_light.timer
        self.lights[Direction.SOUTH].color = ns_light.color
        self.lights[Direction.SOUTH].duration = ns_light.duration
        
        self.lights[Direction.WEST].timer = ew_light.timer
        self.lights[Direction.WEST].color = ew_light.color
        self.lights[Direction.WEST].duration = ew_light.duration
        
        # Check if NS needs to change
        if ns_light.timer >= ns_light.duration:
            ns_light.timer = 0.0
            if ns_light.color == LightColor.GREEN:
                ns_light.color = LightColor.YELLOW
                ns_light.duration = 2.0
            elif ns_light.color == LightColor.YELLOW:
                ns_light.color = LightColor.RED
                ns_light.duration = 7.0  # Wait for EW green + yellow
                # Turn EW green
                ew_light.color = LightColor.GREEN
                ew_light.duration = 5.0
                ew_light.timer = 0.0
            elif ns_light.color == LightColor.RED and ew_light.color == LightColor.RED:
                # Both red briefly, then NS goes green
                ns_light.color = LightColor.GREEN
                ns_light.duration = 5.0
        
        # Check if EW needs to change
        if ew_light.timer >= ew_light.duration:
            ew_light.timer = 0.0
            if ew_light.color == LightColor.GREEN:
                ew_light.color = LightColor.YELLOW
                ew_light.duration = 2.0
            elif ew_light.color == LightColor.YELLOW:
                ew_light.color = LightColor.RED
                ew_light.duration = 7.0
                # Turn NS green
                ns_light.color = LightColor.GREEN
                ns_light.duration = 5.0
                ns_light.timer = 0.0
        
        # Sync paired lights after changes
        self.lights[Direction.SOUTH].color = ns_light.color
        self.lights[Direction.SOUTH].duration = ns_light.duration
        self.lights[Direction.SOUTH].timer = ns_light.timer
        
        self.lights[Direction.WEST].color = ew_light.color
        self.lights[Direction.WEST].duration = ew_light.duration
        self.lights[Direction.WEST].timer = ew_light.timer
    
    def _update_vehicles(self, dt: float):
        """Update all vehicle positions."""
        stop_line = -2.0  # Position of stop line
        safe_distance = 4.0  # Minimum distance between vehicles
        
        for vehicle in self.vehicles:
            light = self._get_light_for_direction(vehicle.direction)
            
            # Check if should stop at red/yellow light
            should_stop = False
            if vehicle.position < stop_line and vehicle.position > -30:
                if light.color in [LightColor.RED, LightColor.YELLOW]:
                    should_stop = True
            
            # Check for vehicle ahead
            for other in self.vehicles:
                if other.id != vehicle.id and other.direction == vehicle.direction:
                    if other.lane == vehicle.lane:
                        if other.position > vehicle.position and other.position - vehicle.position < safe_distance:
                            should_stop = True
                            break
            
            vehicle.waiting = should_stop
            
            if not should_stop:
                vehicle.position += vehicle.speed * dt
            
            # Remove vehicles that have passed through
            if vehicle.position > 80:
                self.vehicles.remove(vehicle)
    
    def _maybe_spawn_vehicles(self):
        """Randomly spawn new vehicles based on traffic flow."""
        for direction in [Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST]:
            flow = self.traffic_flow[direction]
            spawn_chance = VEHICLE_SPAWN_CHANCE * (flow.current_flux / 10.0)
            
            if random.random() < spawn_chance:
                # Don't spawn if too many vehicles already
                dir_count = sum(1 for v in self.vehicles if v.direction == direction)
                if dir_count < 6:
                    self._spawn_vehicle(direction, position=random.uniform(-60, -40))
    
    def _maybe_trigger_event(self):
        """Randomly trigger traffic events."""
        if random.random() < EVENT_CHANCE and len(self.active_events) < 3:
            template = random.choice(self.EVENT_TEMPLATES)
            event = TrafficEvent(
                name=template["name"],
                description=template["description"],
                flux_multiplier=template["flux_multiplier"],
                duration=random.uniform(20, 60),
                time_remaining=random.uniform(20, 60)
            )
            self.active_events.append(event)
            self._apply_events_to_traffic()
            print(f"Event triggered: {event.name}")
    
    def _update_events(self, dt: float):
        """Update event timers and remove expired ones."""
        expired = []
        for event in self.active_events:
            event.time_remaining -= dt
            if event.time_remaining <= 0:
                expired.append(event)
        
        for event in expired:
            self.active_events.remove(event)
            print(f"Event ended: {event.name}")
        
        if expired:
            self._apply_events_to_traffic()
    
    def _apply_events_to_traffic(self):
        """Apply active events to traffic flow."""
        for direction, flow in self.traffic_flow.items():
            multiplier = 1.0
            for event in self.active_events:
                multiplier *= event.flux_multiplier
            flow.current_flux = max(1, int(flow.base_flux * multiplier))
    
    def update(self, dt: float):
        """Main update loop."""
        self._update_lights(dt)
        self._update_vehicles(dt)
        self._update_events(dt)
        self._maybe_spawn_vehicles()
        self._maybe_trigger_event()
    
    def get_state(self) -> dict:
        """Get current state as dictionary for JSON serialization."""
        return {
            "Lights": [light.to_dict() for light in self.lights.values()],
            "Vehicles": [v.to_dict() for v in self.vehicles],
            "Traffic": [flow.to_dict() for flow in self.traffic_flow.values()],
            "Events": [e.to_dict() for e in self.active_events]
        }

# =============================================================================
#  WEBSOCKET SERVER
# =============================================================================

connected_clients = set()
simulation = TrafficSimulation()

async def handler(websocket):
    """Handle WebSocket connections."""
    connected_clients.add(websocket)
    print(f"Client connected. Total: {len(connected_clients)}")
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print(f"Client disconnected. Total: {len(connected_clients)}")

async def broadcast_state():
    """Broadcast simulation state to all connected clients."""
    if not connected_clients:
        return
    
    state = simulation.get_state()
    message = json.dumps(state)
    
    await asyncio.gather(
        *[client.send(message) for client in connected_clients],
        return_exceptions=True
    )

async def simulation_loop():
    """Main simulation loop."""
    last_time = time.time()
    
    while True:
        now = time.time()
        dt = now - last_time
        last_time = now
        
        simulation.update(dt)
        
        # Only broadcast if clients connected (reduce log spam)
        if connected_clients:
            await broadcast_state()
        
        await asyncio.sleep(TICK_RATE)

async def main():
    """Start the WebSocket server and simulation."""
    print(f"Starting Traffic Simulation Server on ws://{HOST}:{PORT}")
    
    async with websockets.serve(handler, HOST, PORT):
        print("Server started. Waiting for connections...")
        await simulation_loop()

if __name__ == "__main__":
    asyncio.run(main())
