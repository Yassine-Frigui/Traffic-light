# Project Audit — Traffic Simulation

> Generated audit for the repository at the root of this workspace.

## 1. High-level summary
- Purpose: real-time traffic intersection simulation with a Python backend driving traffic light state and a React + Three.js frontend visualizing vehicles and lights.
- Runtime: Backend runs an asyncio + aiohttp WebSocket server (`traffic.py`), frontend runs a Vite/React app (`src/ThreeScene.jsx`, `main.jsx`). There is also a `server.js` (Node) and static assets (`index.html`, `netlify.toml`) for deployment.

## 2. Core components (files)
- [traffic.py](traffic.py): Python simulation engine and WebSocket server. Implements `TrafficLightController`, `generate_state()`, `state_loop()`, and `broadcast()` to clients. Controls light transitions and spawns vehicles.
- [src/ThreeScene.jsx](src/ThreeScene.jsx): Three.js scene, WebSocket client, vehicle physics, traffic light rendering and timer HUD. Receives backend `current_state` and runs local physics for vehicles.
- [server.js](server.js): (present) likely used for hosting or proxying; check contents for deployment specifics.
- [package.json](package.json): Frontend build scripts and dependencies. Used by Vite.
- [requirements.txt](requirements.txt): Python dependencies (aiohttp, etc.).
- [index.html](index.html): App entry for the frontend.
- [vite.config.js](vite.config.js): Frontend bundler config.
- [netlify.toml](netlify.toml): Deployment config for Netlify (static hosting settings).
- [src/main.js / src/main.jsx](src/main.js, src/main.jsx): Frontend bootstrap.

## 3. Data model and runtime behavior
- State shape broadcasted by backend: keys `Lights` (array of objects with `Sens`, `Couleur`, `Timer`), `Vehicles` (array of vehicle records with `Id`, `Sens`, `Voie`, `Position`, `Speed`), `Traffic`, `Event`, `Interval`, `Reset`.
- Backend responsibilities:
  - Single source of truth for light color and timer.
  - Generates an interval state every `INTERVAL` seconds (60s by default).
  - Runs `TrafficLightController.update(dt)` repeatedly (previously 0.1s ticks) and broadcasts when either light color or integer-displayed timer changes.
  - When state regenerated, sets `Reset: True` to tell frontend to reset vehicles.
- Frontend responsibilities:
  - Connect via WebSocket, receive `current_state` and update `sceneDataRef.current.simulationData`.
  - Maintain local vehicle physics (`currentPosition`, `currentSpeed`) and localLights map for rendering.
  - Render Three.js scene, update vehicle meshes and traffic light HUD.

## 4. What currently works
- Light state machine implementing GREEN → YELLOW → RED → GREEN for perpendicular pairs (N/S vs E/W) with configurable durations.
- Backend-driven timers and broadcast logic; frontend consumes the state and renders lights/vehicles.
- Vehicles are spawned and given initial positions and speeds; local physics advances vehicle positions and handles stopping behavior at the stop line.
- WebSocket reconnect logic and basic error handling on the frontend.

## 5. Observed issues & risks
- Countdown appearance: frontend previously performed local timer interpolation/decrement which could desync with backend; recent change removed local decrement to rely solely on backend timer updates. If backend updates are infrequent, UI appearance can be jumpy or frozen.
- Broadcast frequency vs load: sending updates too frequently can produce many small JSON messages. Current approach broadcasts on color change or integer second change; earlier iterations used 0.1s ticks and broadcast when the displayed integer changed.
- Scaling: single-process aiohttp will be overwhelmed with many clients; no autoscaling / clustering / persistent storage.
- Message reliability: no ACK or sequence number; out-of-order messages or slow clients could display stale data. No TTL or compacting strategy for backlog.
- Vehicle spawning: vehicles are spawned per-interval at random positions which can produce unrealistic clumping or initial positions that are far past the stop line.
- Missing tests: no unit or integration tests for the light controller, vehicle physics, or WebSocket flows.
- Monitoring & observability: no metrics, no structured logging, no health endpoints beyond `/healthz`.
- Security: WebSocket endpoint currently unauthenticated; consider CORS, origin checks, rate limits for public deployments.
- Resource cleanup: ensure WebSocket `clients` set is pruned for closed/disconnected sockets (code appears to discard on finally, but verify edge cases).

## 6. UX & frontend improvements
- Smooth timer display: prefer backend as source of truth but send timestamps and remaining-time in milliseconds (or `expires_at` epoch ms) so the frontend can smoothly interpolate using `performance.now()` rather than relying on integer updates. This reduces message frequency while keeping a smooth UI.
- Interpolation & prediction: for vehicles, send periodic authoritative positions and allow the client to interpolate frames between server updates (use `lastUpdateMs` + `position` + `speed`). Consider sending `seq` numbers to drop out-of-order updates.
- Mobile / responsiveness: add responsive UI controls, low-quality rendering mode for low-powered devices.
- Accessibility: HUD text contrast, ARIA labels for status panel.

## 7. Reliability, scaling & architecture suggestions
Priority: order these from easiest to implement to more advanced.

1) Short-term (easy, high value)
- Add a `timestamp` (epoch ms) and `seq` on each state broadcast so clients can compute exact remaining timer and ignore out-of-order packets. Example: `state._ts = Date.now(); state.seq = ++counter`.
- Use `TimerMs` (ms remaining) or `ExpiresAt` for lights instead of only integer seconds.
- Limit broadcast rate with a simple debounce/throttle: broadcast when displayed integer second changes, but include `ExpiresAt` so frontend can interpolate smoothly.
- Add a tiny end-to-end test for `TrafficLightController` transitions.

2) Medium term
- Add structured logging and metrics (Prometheus exporter or simple /metrics endpoint). Log light changes, client connect/disconnect counts, broadcast rates.
- Add unit tests for `TrafficLightController` and vehicle physics.
- Add a `maxClients` guard and monitor for message backlog; consider trimming old messages or throttling per-client sends.
- Improve vehicle spawn positions to avoid unrealistic instantiation inside intersection; spawn strictly upstream.
- Harden WebSocket handler with proper exception handling and origin checks.

3) Long term (scaling)
- Use a message broker (Redis pub/sub or NATS) for horizontal scaling and to decouple simulation from WebSocket frontends.
- Move simulation into a worker process with an authoritative store and use clustered deployment (gunicorn/uvicorn with multiple workers behind a load balancer for Python, or containerized workers behind a queue).
- Consider protobuf or MsgPack for compact binary messages if bandwidth is an issue.

## 8. Code quality & DX
- Add linting and type checking: `flake8`/`black`/`ruff` for Python, ESLint + Prettier for JS, consider TypeScript for stronger typing in frontend.
- Add `Makefile` or npm scripts for common tasks: `start`, `dev`, `lint`, `test`.
- Add a `README.md` section describing how to run the backend and frontend locally, and how to connect them (WebSocket URL). If you plan to use Netlify for frontend, document how to build and deploy.

## 9. Security & deployment
- For public deployment: use origin validation, TLS, and optionally simple shared-secret or JWT-based authentication for WebSocket endpoints.
- Consider containerizing the app with a `Dockerfile` for the backend and a small Node/NGINX static server for the frontend.
- Add CI (GitHub Actions) to run linting and tests on PRs.

## 10. Concrete prioritized action items (next steps)
1. Add `timestamp` and `expires_at` (ms) to `traffic.py` state broadcasts so frontend can interpolate timers smoothly.
2. Add `seq` to messages to detect/dismiss out-of-order updates on the client.
3. Keep backend tick at `0.1s` or higher fidelity but only broadcast when `Math.floor(timer)` changes; still send `expires_at` to allow smooth frontend interpolation.
4. Add a small unit test for `TrafficLightController` that validates transitions from green → yellow → red → green with configured durations.
5. Add basic logging and `/metrics` or structured logs for debugging in production.
6. Add `README.md` with run instructions for local development and deployment.

## 11. Files I referenced
- [traffic.py](traffic.py)
- [src/ThreeScene.jsx](src/ThreeScene.jsx)
- [server.js](server.js)
- [package.json](package.json)
- [requirements.txt](requirements.txt)
- [index.html](index.html)
- [vite.config.js](vite.config.js)
- [netlify.toml](netlify.toml)
- [src/main.js](src/main.js)
- [src/main.jsx](src/main.jsx)

## 12. Offer — I can implement the top suggestions
If you want, I can implement one or more of these now:
- Add `timestamp` + `expires_at` and include `seq` in `traffic.py` broadcasts, and update the frontend to use `expires_at` for smooth interpolation.
- Add a unit test for `TrafficLightController`.
- Add basic logging and a `/metrics` endpoint.

Tell me which item to implement first and I will open a small PR with the changes.

---
*Audit generated by the assistant. If you want a more detailed deep-dive (file-by-file annotated changes, test coverage, or performance benchmark scripts), tell me which area to focus on.*
