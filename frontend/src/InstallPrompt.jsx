import React, { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showStandaloneMessage, setShowStandaloneMessage] = useState(false);
  const [platform, setPlatform] = useState('');

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone === true;
    
    if (isInstalled) {
      // Show message that they can close the browser tab if there is one
      const hasSeenStandaloneMessage = localStorage.getItem('dth-standalone-message-seen');
      if (!hasSeenStandaloneMessage) {
        setShowStandaloneMessage(true);
      }
      return;
    }

    // Check if already dismissed
    const dismissed = localStorage.getItem('dth-install-prompt-dismissed');
    if (dismissed) return;

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isMobile = isIOS || isAndroid;

    if (!isMobile) return; // Only show on mobile

    // Show prompt after 1 second
    setTimeout(() => {
      if (isIOS) {
        setPlatform('ios');
        setShowPrompt(true);
      } else if (isAndroid) {
        setPlatform('android');
        setShowPrompt(true);
      }
    }, 1000);
  }, []);

  const handleDismiss = (dontShowAgain) => {
    if (dontShowAgain) {
      localStorage.setItem('dth-install-prompt-dismissed', 'true');
    }
    setShowPrompt(false);
  };

  // Show standalone message if app is already installed
  if (showStandaloneMessage) {
    return (
      <>
        {/* Backdrop */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998
        }} onClick={() => setShowStandaloneMessage(false)} />

        {/* Message modal */}
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '350px',
          backgroundColor: '#0e3764',
          color: '#FFD700',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          zIndex: 9999,
          fontFamily: 'Lato, Arial, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <strong style={{ fontSize: '18px', display: 'block', marginBottom: '12px', color: '#FFD700' }}>
            You're all set!
          </strong>
          <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#ffffff', lineHeight: '1.5' }}>
            DTH Score is now installed as an app. If you have a browser tab open, you can close it and use the app from your home screen.
          </p>
          <button
            onClick={() => {
              localStorage.setItem('dth-standalone-message-seen', 'true');
              setShowStandaloneMessage(false);
            }}
            style={{
              backgroundColor: '#FFD700',
              color: '#0e3764',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'Lato, Arial, sans-serif'
            }}
          >
            Got it!
          </button>
        </div>
      </>
    );
  }

  if (!showPrompt) return null;

  return (
    <>
      {/* Backdrop blur overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 9998
      }} onClick={() => handleDismiss(false)} />

      {/* Prompt modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '400px',
        backgroundColor: '#0e3764',
        color: '#FFD700',
        padding: '20px',
        paddingTop: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
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
            fontSize: '32px',
            cursor: 'pointer',
            padding: '0',
            width: '36px',
            height: '36px',
            lineHeight: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>

      <div style={{ marginBottom: '16px' }}>
        <strong style={{ fontSize: '18px', display: 'block', marginBottom: '10px' }}>
          📱 Please follow these quick installation instructions first
        </strong>
        <p style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#ffffff', lineHeight: '1.5' }}>
          Follow these steps to add a shortcut to your home screen.
        </p>
        <p style={{ margin: '0', fontSize: '15px', color: '#FFD700', fontWeight: 'bold', lineHeight: '1.5' }}>
          It will work just like a mobile app!
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
          <strong>How to add shortcut on iPhone:</strong>
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
          <strong>How to add shortcut on Android:</strong>
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
    </>
  );
}
