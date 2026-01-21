import React from 'react';
import { MAP_CONFIGS } from '../utils/Constants';

// =============================================================================
//  CONNECTION STATUS
// =============================================================================

export function ConnectionStatus({ connected }) {
  return (
    <div style={{
      padding: '8px 16px',
      background: connected ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)',
      color: 'white',
      borderRadius: 4,
      fontSize: 14,
      fontFamily: 'Arial, sans-serif'
    }}>
      {connected ? '● Connected' : '○ Disconnected'}
    </div>
  );
}

// =============================================================================
//  PAUSE/PLAY BUTTON
// =============================================================================

export function PauseButton({ paused, setPaused }) {
  return (
    <button
      onClick={() => setPaused(!paused)}
      style={{
        padding: '12px 20px',
        background: paused ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
      onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
    >
      {paused ? '▶ Resume' : '⏸ Pause'}
    </button>
  );
}

// =============================================================================
//  CURRENT MAP DISPLAY
// =============================================================================

export function CurrentMapDisplay({ currentMap }) {
  return (
    <div style={{
      padding: '12px 20px',
      background: 'rgba(52, 152, 219, 0.9)',
      color: 'white',
      borderRadius: 8,
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }}>
      <span style={{ fontSize: 20 }}>{MAP_CONFIGS[currentMap]?.icon}</span>
      <div>
        <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.7 }}>Current Map</div>
        <div style={{ fontWeight: 'bold' }}>{MAP_CONFIGS[currentMap]?.name}</div>
      </div>
    </div>
  );
}

// =============================================================================
//  TRAFFIC STATE HUD
// =============================================================================

export function TrafficStateHUD({ trafficState }) {
  return (
    <div style={{
      padding: '12px 20px',
      background: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      borderRadius: 8,
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      borderLeft: `6px solid ${
        trafficState === 'Slow' ? '#e74c3c' : 
        trafficState === 'Moderate' ? '#f39c12' : '#2ecc71'
      }`,
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
    }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Traffic State</div>
      <div style={{ fontSize: 24, fontWeight: 'bold' }}>{trafficState}</div>
    </div>
  );
}

// =============================================================================
//  COLLISION COUNTER
// =============================================================================

export function CollisionCounter({ collisionCount }) {
  return (
    <div style={{
      padding: '12px 20px',
      background: 'rgba(255, 0, 0, 0.9)',
      color: 'white',
      borderRadius: 8,
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
    }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Accidents</div>
      <div style={{ fontSize: 24, fontWeight: 'bold' }}>{collisionCount}</div>
    </div>
  );
}

// =============================================================================
//  DAY TIME DISPLAY
// =============================================================================

export function DayTimeDisplay({ dayTime }) {
  const hours = Math.floor(dayTime / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((dayTime % 3600) / 60).toString().padStart(2, '0');
  
  return (
    <div style={{
      padding: '12px 20px',
      background: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      borderRadius: 8,
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
    }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Time</div>
      <div style={{ fontSize: 20, fontWeight: 'bold' }}>{hours}:{minutes}</div>
    </div>
  );
}

// =============================================================================
//  ACTIVE EVENT HUD
// =============================================================================

export function ActiveEventHUD({ activeEvent }) {
  if (!activeEvent) return null;
  
  return (
    <div style={{
      padding: '12px 20px',
      background: 'rgba(192, 57, 43, 0.9)',
      color: 'white',
      borderRadius: 8,
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      animation: 'pulse 2s infinite',
      boxShadow: '0 4px 15px rgba(192, 57, 43, 0.4)'
    }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4 }}>⚠ ACTIVE EVENT</div>
      <div style={{ fontSize: 20, fontWeight: 'bold' }}>{activeEvent}</div>
    </div>
  );
}

// =============================================================================
//  INSTRUCTIONS
// =============================================================================

export function Instructions() {
  return (
    <div style={{
      padding: '8px 12px',
      background: 'rgba(0, 0, 0, 0.6)',
      color: 'white',
      borderRadius: 4,
      fontSize: 12,
      fontFamily: 'Arial, sans-serif'
    }}>
      Drag to rotate view
    </div>
  );
}

// =============================================================================
//  CSS ANIMATIONS
// =============================================================================

export function HUDStyles() {
  return (
    <style>{`
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `}</style>
  );
}
