"""
Simple Traffic Simulation - WebSocket Server
60-second intervals with 3 record types: Traffic, Light, Vehicle
"""

import asyncio
import json
import os
import random
from aiohttp import web

# Config
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 8000))
INTERVAL = 60  # seconds per state update


# ============================================================================
#  RECORDS (simple dictionaries)
# ============================================================================

def make_light(direction, color, timer):
    """Light record: Sens (N/S/E/W), Couleur (RED/YELLOW/GREEN), Timer (seconds left)"""
    return {"Sens": direction, "Couleur": color, "Timer": timer}

def make_vehicle(id, direction, lane, position, speed):
    """Vehicle record: Id, Sens, Voie (Lane1/Lane2), Position, Speed"""
    return {"Id": id, "Sens": direction, "Voie": f"Lane{lane}", "Position": position, "Speed": speed, "Waiting": False}

# ============================================================================
#  TRAFFIC LIGHT STATE MACHINE
# ============================================================================

class TrafficLightController:
    """Manages traffic light states with proper transitions."""
    
    def __init__(self):
        # Initial state: N/S green, E/W red
        self.lights = {
            'N': {'color': 'GREEN', 'timer': 30},
            'S': {'color': 'GREEN', 'timer': 30},
            'E': {'color': 'RED', 'timer': 30},
            'W': {'color': 'RED', 'timer': 30},
        }
        self.green_duration = 30  # seconds
        self.yellow_duration = 3   # seconds
    
    def update(self, dt):
        """Update all lights by dt seconds. Returns list of light records."""
        # Decrement timers
        for direction in self.lights:
            self.lights[direction]['timer'] -= dt
        
        # Check for transitions (use N as reference for N/S pair, E for E/W pair)
        self._check_transition('N', 'S', 'E', 'W')
        self._check_transition('E', 'W', 'N', 'S')
        
        # Return current state as records
        return [
            make_light(d, self.lights[d]['color'], max(0, self.lights[d]['timer']))
            for d in ['N', 'S', 'E', 'W']
        ]
    
    def _check_transition(self, dir1, dir2, opp1, opp2):
        """Check and handle transition for a pair of lights."""
        light = self.lights[dir1]
        
        if light['timer'] <= 0:
            if light['color'] == 'GREEN':
                # GREEN -> YELLOW (3 seconds)
                self.lights[dir1]['color'] = 'YELLOW'
                self.lights[dir2]['color'] = 'YELLOW'
                self.lights[dir1]['timer'] = self.yellow_duration
                self.lights[dir2]['timer'] = self.yellow_duration
            
            elif light['color'] == 'YELLOW':
                # YELLOW -> RED, and opposite goes GREEN
                self.lights[dir1]['color'] = 'RED'
                self.lights[dir2]['color'] = 'RED'
                self.lights[dir1]['timer'] = self.green_duration + self.yellow_duration
                self.lights[dir2]['timer'] = self.green_duration + self.yellow_duration
                
                # Opposite pair goes green
                self.lights[opp1]['color'] = 'GREEN'
                self.lights[opp2]['color'] = 'GREEN'
                self.lights[opp1]['timer'] = self.green_duration
                self.lights[opp2]['timer'] = self.green_duration

# Global traffic light controller
traffic_controller = TrafficLightController()

def make_traffic(direction, flow, event=None):
    """Traffic record: direction, flow (vehicles/min), optional event"""
    return {"direction": direction, "flow": flow, "event": event}

# ============================================================================
#  STATE GENERATOR
# ============================================================================

EVENTS = [
    {"name": "Rush Hour", "flow_mult": 1.8},
    {"name": "Accident", "flow_mult": 0.4},
    {"name": "Bad Weather", "flow_mult": 0.6},
    {"name": "Event Nearby", "flow_mult": 2.0},
    {"name": "Construction", "flow_mult": 0.5},
    None,  # No event (normal traffic)
    None,
    None,  # Weight toward normal
]

vehicle_counter = 0

def generate_state():
    """Generate a complete traffic state for the current 60-second interval."""
    global vehicle_counter
    
    # Pick random event (or None for normal traffic)
    event = random.choice(EVENTS)
    base_flow = 10
    flow_mult = event["flow_mult"] if event else 1.0
    
    # Traffic for each direction
    traffic = [
        make_traffic("N", int(base_flow * flow_mult * random.uniform(0.8, 1.2)), event),
        make_traffic("S", int(base_flow * flow_mult * random.uniform(0.8, 1.2)), event),
        make_traffic("E", int(base_flow * flow_mult * random.uniform(0.8, 1.2)), event),
        make_traffic("W", int(base_flow * flow_mult * random.uniform(0.8, 1.2)), event),
    ]
    
    # Get current light states from controller (don't update here, just get current)
    lights = [
        make_light(d, traffic_controller.lights[d]['color'], 
                   max(0, traffic_controller.lights[d]['timer']))
        for d in ['N', 'S', 'E', 'W']
    ]
    
    # Vehicles: spawn based on flow
    vehicles = []
    for t in traffic:
        count = max(1, t["flow"])  # Use full flow count
        for i in range(count):
            vehicle_counter += 1
            # Spawn vehicles closer to intersection
            # Position range: -50 to 30 (negative = approaching, positive = past stop line)
            vehicles.append(make_vehicle(
                id=vehicle_counter,
                direction=t["direction"],
                lane=random.randint(1, 2),
                position=random.uniform(-50, 30), 
                speed=random.uniform(8, 15)
            ))
    
    return {
        "Lights": lights,
        "Vehicles": vehicles,
        "Traffic": traffic,
        "Event": event,
        "Interval": INTERVAL
    }

# ============================================================================
#  WEBSOCKET SERVER (aiohttp)
# ============================================================================

clients = set()
current_state = generate_state()

async def websocket_handler(request):
    """Handle a WebSocket connection."""
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    
    clients.add(ws)
    print(f"Client connected ({len(clients)} total)")
    
    # Send current state immediately
    try:
        await ws.send_json(current_state)
    except:
        pass
    
    try:
        async for msg in ws:
            pass # Ignore incoming messages
    finally:
        clients.discard(ws)
        print(f"Client disconnected ({len(clients)} total)")
    
    return ws

async def health_check(request):
    """Handle HTTP health check requests."""
    return web.Response(text="OK")

async def broadcast(state):
    """Send state to all connected clients."""
    if not clients:
        return
    # Create tasks for sending
    tasks = [ws.send_json(state) for ws in clients]
    # Use gather to run them concurrently
    await asyncio.gather(*tasks, return_exceptions=True)

async def light_update_loop():
    """Update traffic lights every second and broadcast."""
    global current_state
    while True:
        await asyncio.sleep(1)  # Update every second
        # Update traffic controller
        traffic_controller.update(1)
        # Update lights in current state
        current_state["Lights"] = [
            make_light(d, traffic_controller.lights[d]['color'], 
                       max(0, traffic_controller.lights[d]['timer']))
            for d in ['N', 'S', 'E', 'W']
        ]
        # Broadcast updated state
        await broadcast(current_state)

async def state_loop():
    """Generate new state every INTERVAL seconds."""
    global current_state
    while True:
        await asyncio.sleep(INTERVAL)
        current_state = generate_state()
        event_name = current_state["Event"]["name"] if current_state["Event"] else "Normal"
        print(f"New state: {event_name} traffic, {len(current_state['Vehicles'])} vehicles")
        await broadcast(current_state)

async def init_app():
    app = web.Application()
    app.add_routes([
        web.get('/', websocket_handler, allow_head=False),
        web.head('/', health_check),
        web.get('/healthz', health_check),
    ])
    return app

async def main():
    """Start server."""
    print(f"Traffic server starting on http://{HOST}:{PORT}")
    print(f"State updates every {INTERVAL} seconds")
    
    app = await init_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()
    
    print("Server ready!")
    
    # Run both loops concurrently
    await asyncio.gather(
        light_update_loop(),
        state_loop()
    )

if __name__ == "__main__":
    asyncio.run(main())
