"""
Traffic Simulation WebSocket Server - Main Entry Point

This is the main entry point for the traffic simulation server.
It imports and runs the modular components:
- traffic_simulation.py: Traffic lights, vehicle generation, state management
- server.py: WebSocket server, security, rate limiting, broadcasting

Usage:
    python traffic.py
"""

import asyncio
import logging
import os
from dotenv import load_dotenv

from traffic_simulation import TrafficSimulator
from server import WebSocketServer

# Load environment variables from .env file
load_dotenv()

# ============================================================================
#  LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
#  MAIN
# ============================================================================

async def main():
    """Initialize and run the traffic simulation server."""
    # Configuration
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", 8000))
    interval = 60  # seconds per state update
    
    # Create simulator
    simulator = TrafficSimulator(interval=interval)
    
    # Create and run server
    server = WebSocketServer(simulator, host=host, port=port)
    await server.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
