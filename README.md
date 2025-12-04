# React + Three.js Roundabout Playground

Child-like colorful roundabout visualization built with React + Three.js. Includes:

## Current Features
* 4 roads (N, S, E, W) crossing under a central roundabout.
* Central roundabout with playful tree and spinning rim.
* 4 animated traffic lights cycling green → yellow → red.
* Moving cars (bright boxes) circulating around the roundabout at varied speeds.
* Drag interaction (left-click drag) to rotate the camera; vertical drag adjusts elevation.
* Pastel / bright palette for a kid-friendly look.

## Tech Stack
* React 18
* Three.js r160
* Vite (dev/build)
* Optional Express server for production (`server.js`).

## Getting Started
Ensure you have Node.js (LTS) installed.

### 1. Install dependencies
```cmd
npm install
```

### 2. Development (hot reload)
```cmd
npm run dev
```
Open the printed URL (defaults to http://localhost:5173/).

### 3. Production build
```cmd
npm run build
```

### 4. Preview build (Vite)
```cmd
npm run preview
```

### 5. Serve with Express
```cmd
npm start
```
Serves the `dist` folder on http://localhost:5174/.

## File Overview
* `index.html` – Vite HTML entry.
* `src/main.jsx` – React root.
* `src/ThreeScene.jsx` – Three.js scene setup and animation loop (roads, lights, cars).
* `server.js` – Optional Express static server.
* `vite.config.js` – Vite config enabling React plugin.

## Customization Ideas
* Spawn cars from roads, merge onto roundabout then exit randomly.
* Car color randomization + headlights at night mode.
* Orthographic camera toggle for map view.
* GUI (dat.GUI or controls) to change traffic light timing.
* Sound effects (engine hum, light change "ding").
* Add lane arrows, zebra crossings, signage.

## License
You own the design assets. Code under MIT (implicit) – adapt freely.

## MIT Notice
Three.js and other dependencies are MIT licensed.
