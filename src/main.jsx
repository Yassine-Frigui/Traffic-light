import React from 'react';
import { createRoot } from 'react-dom/client';
import ThreeScene from './ThreeScene.jsx';
import { LanguageProvider } from './contexts/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <div className="hud">
        <h1>Roundabout Playground</h1>
        <span className="tag">React</span>
        <span className="tag">Three.js</span>
        <span className="tag">Cars</span>
      </div>
      <ThreeScene />
    </LanguageProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
