"""
WebSocket Server with Security Features
Handles client connections, rate limiting, origin validation, and broadcasting
"""

import asyncio
import logging
import os
import time
from aiohttp import web, WSMsgType
from collections import defaultdict

logger = logging.getLogger(__name__)


# ============================================================================
#  SECURITY CONFIGURATION
# ============================================================================

# Note: Configuration is read when server is instantiated, not at import time
# This ensures .env is loaded first in traffic.py

# Rate limiting storage
connection_attempts = defaultdict(list)  # IP -> list of timestamps


# ============================================================================
#  SECURITY HELPERS
# ============================================================================

def get_client_ip(request):
    """Extract client IP, considering proxy headers."""
    # Check for forwarded headers (when behind proxy/load balancer)
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip.strip()
    
    # Fall back to direct connection IP
    peername = request.transport.get_extra_info('peername')
    return peername[0] if peername else 'unknown'


def check_rate_limit(client_ip, window=60, max_connections=10):
    """Check if client IP has exceeded connection rate limit."""
    now = time.time()
    
    # Clean old entries
    connection_attempts[client_ip] = [
        ts for ts in connection_attempts[client_ip] 
        if now - ts < window
    ]
    
    # Check limit
    if len(connection_attempts[client_ip]) >= max_connections:
        return False
    
    # Record this attempt
    connection_attempts[client_ip].append(now)
    return True


def validate_origin(request, allowed_origins):
    """Validate the Origin header against allowed origins."""
    # If no allowed origins configured, allow all (development mode)
    if not allowed_origins or allowed_origins == ['']:
        return True
    
    origin = request.headers.get('Origin', '')
    
    # Allow requests without Origin header (non-browser clients)
    if not origin:
        return True
    
    # Check if origin is in allowed list
    return origin in allowed_origins


# ============================================================================
#  WEBSOCKET SERVER
# ============================================================================

class WebSocketServer:
    """Manages WebSocket connections and broadcasting."""
    
    def __init__(self, simulator, host="0.0.0.0", port=8000):
        self.simulator = simulator
        self.host = host
        self.port = port
        self.clients = set()
        self.current_state = None
        self.total_intervals = 0
        
        # Load security configuration from environment
        self.max_clients = int(os.environ.get("MAX_CLIENTS", 100))
        self.rate_limit_window = 60  # seconds
        self.rate_limit_max_connections = 10  # max connections per IP per window
        
        # Parse ALLOWED_ORIGINS
        origins_str = os.environ.get("ALLOWED_ORIGINS", "")
        self.allowed_origins = origins_str.split(",") if origins_str else []
    
    async def websocket_handler(self, request):
        """Handle a WebSocket connection with security checks."""
        client_ip = get_client_ip(request)
        
        # Security Check 1: Origin validation
        if not validate_origin(request, self.allowed_origins):
            origin = request.headers.get('Origin', 'unknown')
            logger.warning(f"Rejected connection from {client_ip}: invalid origin '{origin}'")
            return web.Response(status=403, text="Forbidden: Invalid origin")
        
        # Security Check 2: Rate limiting
        if not check_rate_limit(client_ip, self.rate_limit_window, self.rate_limit_max_connections):
            logger.warning(f"Rate limit exceeded for {client_ip}")
            return web.Response(status=429, text="Too Many Requests")
        
        # Security Check 3: Max clients
        if len(self.clients) >= self.max_clients:
            logger.warning(f"Max clients reached, rejecting {client_ip}")
            return web.Response(status=503, text="Server at capacity")
        
        ws = web.WebSocketResponse(
            heartbeat=30,  # Send ping every 30 seconds
            max_msg_size=1024  # Limit incoming message size
        )
        await ws.prepare(request)
        
        self.clients.add(ws)
        logger.info(f"Client connected from {client_ip} ({len(self.clients)} total)")
        
        # Send current state immediately
        if self.current_state:
            try:
                await ws.send_json(self.current_state)
            except Exception as e:
                logger.error(f"Error sending initial state to {client_ip}: {e}")
        
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    logger.debug(f"Received text message from {client_ip}: {msg.data[:100]}")
                elif msg.type == WSMsgType.BINARY:
                    logger.warning(f"Received unexpected binary message from {client_ip}")
                elif msg.type == WSMsgType.ERROR:
                    logger.error(f"WebSocket error from {client_ip}: {ws.exception()}")
                    break
        except Exception as e:
            logger.error(f"Error handling WebSocket for {client_ip}: {e}")
        finally:
            self.clients.discard(ws)
            logger.info(f"Client disconnected from {client_ip} ({len(self.clients)} total)")
        
        return ws
    
    async def health_check(self, request):
        """Handle HTTP health check requests."""
        return web.Response(text="OK")
    
    async def metrics_endpoint(self, request):
        """Return server metrics for monitoring."""
        metrics = {
            "connected_clients": len(self.clients),
            "max_clients": self.max_clients,
            "uptime_intervals": self.total_intervals,
            "rate_limited_ips": len([
                ip for ip, attempts in connection_attempts.items() 
                if len(attempts) >= self.rate_limit_max_connections
            ])
        }
        return web.json_response(metrics)
    
    async def broadcast(self, state):
        """Send state to all connected clients with error handling."""
        if not self.clients:
            return
        
        dead_clients = set()
        
        for ws in self.clients:
            try:
                if ws.closed:
                    dead_clients.add(ws)
                else:
                    await ws.send_json(state)
            except Exception as e:
                logger.debug(f"Error broadcasting to client: {e}")
                dead_clients.add(ws)
        
        # Clean up dead connections
        for ws in dead_clients:
            self.clients.discard(ws)
    
    async def state_loop(self):
        """Generate new state every INTERVAL seconds and broadcast light updates."""
        # Track last colors and timers
        last_colors = {d: self.simulator.traffic_controller.lights[d]['color'] for d in ['N', 'S', 'E', 'W']}
        last_displayed_timers = {d: int(self.simulator.traffic_controller.lights[d]['timer']) for d in ['N', 'S', 'E', 'W']}
        elapsed = 0
        timer_update_elapsed = 0
        
        # Initial state
        self.current_state = self.simulator.generate_state()
        await self.broadcast(self.current_state)
        
        while True:
            await asyncio.sleep(0.1)
            elapsed += 0.1
            timer_update_elapsed += 0.1
            
            # Update traffic controller
            self.simulator.update_lights(0.1)
            
            # If interval elapsed, regenerate full state
            if elapsed >= self.simulator.interval:
                elapsed = 0
                self.total_intervals += 1
                self.current_state = self.simulator.generate_state()
                event_name = self.current_state["Event"]["name"] if self.current_state["Event"] else "Normal"
                logger.info(f"New state: {event_name} traffic, {len(self.current_state['Vehicles'])} vehicles")
                await self.broadcast(self.current_state)
                
                # Reset tracking
                last_colors = {d: self.simulator.traffic_controller.lights[d]['color'] for d in ['N', 'S', 'E', 'W']}
                last_displayed_timers = {d: int(self.simulator.traffic_controller.lights[d]['timer']) for d in ['N', 'S', 'E', 'W']}
                timer_update_elapsed = 0
                continue
            
            # Check if colors changed or 1 second passed
            current_colors = {d: self.simulator.traffic_controller.lights[d]['color'] for d in ['N', 'S', 'E', 'W']}
            current_displayed_timers = {d: int(self.simulator.traffic_controller.lights[d]['timer']) for d in ['N', 'S', 'E', 'W']}
            
            colors_changed = current_colors != last_colors
            should_update_timers = timer_update_elapsed >= 1.0
            
            if colors_changed or should_update_timers:
                # Update lights in current state
                self.current_state["Lights"] = self.simulator.get_current_lights()
                self.current_state["Reset"] = False
                self.current_state["ServerTime"] = int(time.time() * 1000)
                await self.broadcast(self.current_state)
                
                last_colors = current_colors
                last_displayed_timers = current_displayed_timers
                timer_update_elapsed = 0
                
                if colors_changed:
                    logger.info(f"Light change: {[(d, current_colors[d]) for d in ['N', 'S', 'E', 'W']]}")
    
    async def init_app(self):
        """Initialize the aiohttp application."""
        app = web.Application()
        
        app.add_routes([
            web.get('/', self.websocket_handler, allow_head=False),
            web.head('/', self.health_check),
            web.get('/healthz', self.health_check),
            web.get('/metrics', self.metrics_endpoint),
        ])
        
        return app
    
    async def run(self):
        """Start the WebSocket server."""
        logger.info(f"Traffic server starting on http://{self.host}:{self.port}")
        logger.info(f"State updates every {self.simulator.interval} seconds")
        logger.info(f"Max clients: {self.max_clients}")
        logger.info(f"Rate limit: {self.rate_limit_max_connections} connections per {self.rate_limit_window}s per IP")
        
        if self.allowed_origins and self.allowed_origins != ['']:
            logger.info(f"Allowed origins: {self.allowed_origins}")
        else:
            logger.warning("No ALLOWED_ORIGINS set - accepting connections from any origin (dev mode)")
        
        app = await self.init_app()
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        
        logger.info("Server ready!")
        
        # Run state loop
        await self.state_loop()
