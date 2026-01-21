import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];

export function LanguageSelector() {
  const { currentLanguage, switchLanguage } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
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
          gap: 8
        }}
        onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
      >
        {languages.find(lang => lang.code === currentLanguage)?.flag || '🌐'}
        <span>{languages.find(lang => lang.code === currentLanguage)?.name || 'Language'}</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '100%',
          marginTop: 8,
          marginRight: 8,
          background: 'rgba(20, 20, 30, 0.98)',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          zIndex: 1000,
          minWidth: 180,
          transformOrigin: 'top right'
        }}>
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                switchLanguage(lang.code);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: currentLanguage === lang.code 
                  ? 'rgba(52, 152, 219, 0.3)' 
                  : 'transparent',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                fontFamily: 'Arial, sans-serif',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (currentLanguage !== lang.code) {
                  e.target.style.background = 'rgba(255,255,255,0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentLanguage !== lang.code) {
                  e.target.style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: 20 }}>{lang.flag}</span>
              <span>{lang.name}</span>
              {currentLanguage === lang.code && (
                <span style={{ marginLeft: 'auto', color: '#2ecc71' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
