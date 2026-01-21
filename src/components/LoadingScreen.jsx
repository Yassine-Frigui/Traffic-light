import React from 'react';
import { MAP_CONFIGS } from '../utils/Constants';
import { useLanguage } from '../contexts/LanguageContext';

// =============================================================================
//  LOADING SCREEN
// =============================================================================

export function LoadingScreen({ isLoading, currentMap, loadingProgress }) {
  const { t } = useLanguage();
  
  if (!isLoading) return null;
  
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.95)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        fontSize: 48,
        marginBottom: 30,
        animation: 'spin 2s linear infinite'
      }}>
        {MAP_CONFIGS[currentMap]?.icon || '🚗'}
      </div>
      <h2 style={{
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        fontSize: 28,
        marginBottom: 20
      }}>
        {t('loadingScreen.loading')} {t(`maps.${currentMap}.name`) || MAP_CONFIGS[currentMap]?.name || 'Map'}...
      </h2>
      <div style={{
        width: 300,
        height: 8,
        background: 'rgba(255,255,255,0.2)',
        borderRadius: 4,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${loadingProgress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #3498db, #2ecc71)',
          borderRadius: 4,
          transition: 'width 0.2s ease'
        }} />
      </div>
      <div style={{
        color: 'rgba(255,255,255,0.6)',
        marginTop: 15,
        fontFamily: 'Arial, sans-serif',
        fontSize: 14
      }}>
        {loadingProgress}% {t('loadingScreen.complete')}
      </div>
    </div>
  );
}

export default LoadingScreen;
