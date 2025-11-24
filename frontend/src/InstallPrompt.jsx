import React, { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState('');

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem('dth-install-prompt-dismissed');
    if (dismissed) return;

    // Check if already installed (running in standalone mode)
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone === true;
    if (isInstalled) return;

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isMobile = isIOS || isAndroid;

    if (!isMobile) return; // Only show on mobile

    // Show prompt after 3 seconds
    setTimeout(() => {
      if (isIOS) {
        setPlatform('ios');
        setShowPrompt(true);
      } else if (isAndroid) {
        setPlatform('android');
        setShowPrompt(true);
      }
    }, 3000);
  }, []);

  const handleDismiss = (dontShowAgain) => {
    if (dontShowAgain) {
      localStorage.setItem('dth-install-prompt-dismissed', 'true');
    }
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#0e3764',
      color: '#FFD700',
      padding: '16px',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
      zIndex: 9999,
      fontFamily: 'Lato, Arial, sans-serif'
    }}>
      <button
        onClick={() => handleDismiss(false)}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'transparent',
          border: 'none',
          color: '#FFD700',
          fontSize: '24px',
          cursor: 'pointer',
          padding: '0',
          width: '30px',
          height: '30px',
          lineHeight: '30px'
        }}
      >
        ×
      </button>

      <div style={{ marginBottom: '12px' }}>
        <strong style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>
          📱 Install DTH Score
        </strong>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#ffffff' }}>
          Add to your home screen for quick access!
        </p>
      </div>

      {platform === 'ios' && (
        <div style={{ 
          backgroundColor: 'rgba(255,255,255,0.1)', 
          padding: '12px', 
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '14px',
          color: '#ffffff'
        }}>
          <strong>How to install on iPhone:</strong>
          <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Tap the <strong>Share</strong> icon <span style={{ fontSize: '20px' }}>⎙</span> in the address bar (top right)</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong></li>
          </ol>
        </div>
      )}

      {platform === 'android' && (
        <div style={{ 
          backgroundColor: 'rgba(255,255,255,0.1)', 
          padding: '12px', 
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '14px',
          color: '#ffffff'
        }}>
          <strong>How to install on Android:</strong>
          <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Tap the <strong>menu</strong> button <span style={{ fontSize: '18px' }}>⋮</span> (top right)</li>
            <li>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></li>
            <li>Tap <strong>"Install"</strong></li>
          </ol>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
        <input
          type="checkbox"
          id="dontShowAgain"
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          onChange={(e) => {
            if (e.target.checked) {
              handleDismiss(true);
            }
          }}
        />
        <label 
          htmlFor="dontShowAgain" 
          style={{ fontSize: '13px', cursor: 'pointer', color: '#ffffff' }}
        >
          Don't show this again
        </label>
      </div>
    </div>
  );
}
