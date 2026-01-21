"""
Traffic Simulation Logic
Handles traffic lights, vehicle generation, and state management
"""

import random
import time


# ============================================================================
#  RECORD BUILDERS
# ============================================================================

def make_light(direction, color, timer):
    """Light record: Sens (N/S/E/W), Couleur (RED/YELLOW/GREEN), Timer (seconds left).
    Also includes TimerMs and ExpiresAt (epoch ms) so clients can interpolate smoothly."""
    now_ms = int(time.time() * 1000)
    timer = max(0.0, float(timer))
    timer_ms = int(timer * 1000)
    expires_at = now_ms + timer_ms
    return {
        "Sens": direction,
        "Couleur": color,
        "Timer": timer,
        "TimerMs": timer_ms,
        "ExpiresAt": expires_at
    }


def make_vehicle(id, direction, lane, position, speed):
    """Vehicle record: Id, Sens, Voie (Lane1/Lane2), Position, Speed"""
    return {
        "Id": id,
        "Sens": direction,
        "Voie": f"Lane{lane}",
        "Position": position,
        "Speed": speed,
        "Waiting": False
    }


def make_traffic(direction, flow, event=None):
    """Traffic record: direction, flow (vehicles/min), optional event"""
    return {"direction": direction, "flow": flow, "event": event}


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


# ============================================================================
#  STATE GENERATION
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


class TrafficSimulator:
    """Generates traffic states and manages simulation."""
    
    def __init__(self, interval=60):
        self.interval = interval  # seconds per state update
        self.vehicle_counter = 0
        self.traffic_controller = TrafficLightController()
    
    def generate_state(self):
        """Generate a complete traffic state for the current interval."""
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
        
        # Get current light states from controller
        lights = [
            make_light(d, self.traffic_controller.lights[d]['color'], 
                       max(0, self.traffic_controller.lights[d]['timer']))
            for d in ['N', 'S', 'E', 'W']
        ]
        
        # Vehicles: spawn based on flow
        vehicles = []
        STOP_LINE = 64  # Keep consistent with frontend stop line
        MAX_NEAR = min(30, STOP_LINE - 5)
        MAX_VEHICLES_PER_DIRECTION = 6
        
        for t in traffic:
            count = max(1, min(MAX_VEHICLES_PER_DIRECTION, int(t["flow"])))
            nearest_pos = random.uniform(-10, MAX_NEAR)
            
            for i in range(count):
                self.vehicle_counter += 1
                spacing = random.uniform(8, 15)
                pos = max(nearest_pos - i * spacing, -50)
                
                vehicles.append(make_vehicle(
                    id=self.vehicle_counter,
                    direction=t["direction"],
                    lane=1,
                    position=pos,
                    speed=random.uniform(8, 15)
                ))
        
        return {
            "Lights": lights,
            "Vehicles": vehicles,
            "Traffic": traffic,
            "Event": event,
            "Interval": self.interval,
            "Reset": True,  # Signal to frontend to clear old vehicles
            "ServerTime": int(time.time() * 1000)
        }
    
    def update_lights(self, dt):
        """Update traffic light controller."""
        self.traffic_controller.update(dt)
    
    def get_current_lights(self):
        """Get current light states."""
        return [
            make_light(d, self.traffic_controller.lights[d]['color'], 
                       max(0, self.traffic_controller.lights[d]['timer']))
            for d in ['N', 'S', 'E', 'W']
        ]
