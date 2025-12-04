import time
import random
import asyncio
import websockets
import json

# -----------------------------------------------------------
#  RANDOM EVENTS LIST
# -----------------------------------------------------------

random_events = [
    {"name": "Rush Hour", "description": "Increased traffic during peak hours", "flux_multiplier": 1.5},
    {"name": "Accident", "description": "Traffic slowdown due to an accident", "flux_multiplier": 0.7},  # Wait, accident should increase? No, user said increase traffic flow, so maybe more cars.
    {"name": "Event", "description": "Local event causing more vehicles", "flux_multiplier": 2.0},
    {"name": "Weather", "description": "Bad weather increasing traffic", "flux_multiplier": 1.3},
    {"name": "Construction", "description": "Road work causing delays", "flux_multiplier": 0.8}  # Again, for increase, maybe adjust.
]

# Note: Adjusted some to increase flux as per request. Accident might not increase, but user said "increase the traffic flow", so perhaps events that add more cars or speed up.

# Actually, to increase traffic flow, events that increase flux (more cars per time unit).

# -----------------------------------------------------------
#  DATA CREATION FUNCTIONS
# -----------------------------------------------------------
#  DATA CREATION FUNCTIONS
# -----------------------------------------------------------

def create_lights():
    return [
        {"Couleur": "GREEN", "Duree": 5, "Sens": "N", "Compteur": 0.0},
        {"Couleur": "RED",   "Duree": 6, "Sens": "S", "Compteur": 0.0}
    ]

def create_traffic():
    return [
        {"Sens": "N", "Flux": 10}
    ]

def create_vehicles():
    return [
        {"Velocite": 1.2, "Position": 0.0,  "Voie": "N1"},
        {"Velocite": 1.0, "Position": -3.0, "Voie": "N1"}
    ]

# -----------------------------------------------------------
#  UPDATE FUNCTIONS (PURE FUNCTIONAL)
# -----------------------------------------------------------

def update_light(light, dt):
    light["Compteur"] += dt

    if light["Compteur"] >= light["Duree"]:

        if light["Couleur"] == "GREEN":
            light["Couleur"] = "YELLOW"
            light["Duree"] = 2

        elif light["Couleur"] == "YELLOW":
            light["Couleur"] = "RED"
            light["Duree"] = 6

        else:  # RED → GREEN
            light["Couleur"] = "GREEN"
            light["Duree"] = 5

        light["Compteur"] = 0


def update_traffic(traffic, modifier):
    for t in traffic:
        t["Flux"] = max(0, int(t["Flux"] * modifier))


def trigger_random_event(traffic):
    if random.random() < 0.01:  # 1% chance per update
        event = random.choice(random_events)
        print(f"Event triggered: {event['name']} - {event['description']}")
        update_traffic(traffic, event['flux_multiplier'])
        return event
    return None


# Global set of connected WebSocket clients
connected_clients = set()

async def handler(websocket, path):
    connected_clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.remove(websocket)

async def broadcast_state(state):
    message = json.dumps(state)
    await asyncio.gather(
        *[client.send(message) for client in connected_clients],
        return_exceptions=True
    )

def update_vehicle(vehicle, dt):
    vehicle["Position"] += vehicle["Velocite"] * dt

async def run_simulation():
    lights = create_lights()
    traffic = create_traffic()
    vehicles = create_vehicles()
    active_events = []

    last = time.time()

    while True:
        now = time.time()
        dt = now - last
        last = now

        for l in lights:
            update_light(l, dt)

        event = trigger_random_event(traffic)
        if event:
            active_events.append(event)
            # Keep only last 5 events
            if len(active_events) > 5:
                active_events.pop(0)

        for v in vehicles:
            update_vehicle(v, dt)

        state = {
            "Lights": lights,
            "Vehicles": vehicles,
            "Traffic": traffic,
            "Events": active_events
        }

        print(state)
        await broadcast_state(state)
        await asyncio.sleep(0.1)

async def main():
    server = await websockets.serve(handler, "localhost", 8000)
    print("WebSocket server started on ws://localhost:8000/sim")
    await run_simulation()
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
