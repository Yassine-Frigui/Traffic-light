import React from 'react';
import { MAP_CONFIGS } from '../utils/Constants';

// =============================================================================
//  MAP SELECTION SIDEBAR
// =============================================================================

export function MapSidebar({ 
  sidebarOpen, 
  setSidebarOpen, 
  currentMap, 
  switchMap, 
  isLoading 
}) {
  return (
    <>
      {/* Sidebar Panel */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: sidebarOpen ? 0 : -320,
        width: 320,
        height: '100%',
        background: 'rgba(20, 20, 30, 0.98)',
        boxShadow: sidebarOpen ? '4px 0 20px rgba(0,0,0,0.5)' : 'none',
        transition: 'left 0.3s ease',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: 20 }}>🗺️ Select Map</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: 24,
              cursor: 'pointer',
              padding: 5
            }}
          >
            ✕
          </button>
        </div>
        
        {/* Map Options */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '15px'
        }}>
          {Object.values(MAP_CONFIGS).map((map) => (
            <MapOption 
              key={map.id}
              map={map}
              isActive={currentMap === map.id}
              isLoading={isLoading}
              onClick={() => !isLoading && switchMap(map.id)}
            />
          ))}
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '15px 20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 12,
          textAlign: 'center'
        }}>
          Select a map to switch the simulation environment
        </div>
      </div>
      
      {/* Toggle Button */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'absolute',
            top: 80,
            left: 10,
            padding: '12px 16px',
            background: 'rgba(52, 152, 219, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 'bold',
            fontFamily: 'Arial, sans-serif',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 50
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
        >
          🗺️ Maps
        </button>
      )}
    </>
  );
}

// =============================================================================
//  MAP OPTION COMPONENT
// =============================================================================

function MapOption({ map, isActive, isLoading, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '15px',
        marginBottom: '12px',
        background: isActive 
          ? 'linear-gradient(135deg, rgba(52, 152, 219, 0.3), rgba(46, 204, 113, 0.3))'
          : 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        border: isActive 
          ? '2px solid rgba(52, 152, 219, 0.8)'
          : '2px solid transparent',
        transition: 'all 0.2s ease',
        opacity: isLoading ? 0.5 : 1
      }}
      onMouseEnter={(e) => {
        if (!isActive && !isLoading) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          e.currentTarget.style.transform = 'translateX(5px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          e.currentTarget.style.transform = 'translateX(0)';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 50,
          height: 50,
          background: map.preview,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24
        }}>
          {map.icon}
        </div>
        <div>
          <div style={{
            color: 'white',
            fontWeight: 'bold',
            fontSize: 16,
            marginBottom: 4
          }}>
            {map.name}
            {isActive && (
              <span style={{
                marginLeft: 8,
                fontSize: 12,
                background: '#2ecc71',
                padding: '2px 8px',
                borderRadius: 4
              }}>
                Active
              </span>
            )}
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12
          }}>
            {map.description}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapSidebar;
