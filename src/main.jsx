import React from 'react';
import { createRoot } from 'react-dom/client';
import ThreeScene from './ThreeScene.jsx';

function App() {
  return (
    <>
      <div className="hud">
        <h1>Roundabout Playground</h1>
        <span className="tag">React</span>
        <span className="tag">Three.js</span>
        <span className="tag">Cars</span>
      </div>
      <ThreeScene />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
