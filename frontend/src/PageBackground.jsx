import React from 'react';
import bgUrl from './assets/dan-congdon-gJeusCuFyYA-unsplash.jpg';

export default function PageBackground({ children, hideFooter }) {
  // Use local Unsplash image for background
  return (
    <div
      className="relative min-h-screen bg-cover bg-center flex flex-col"
      style={{
        backgroundImage: `url(${bgUrl})`,
        backgroundColor: "#222"
      }}
    >
      <div className="absolute inset-0 bg-black" style={{ opacity: 0.3 }}></div>
      <div className="relative z-10 flex flex-col flex-grow min-h-screen items-center">
        <div className="w-full container">
          {children}
        </div>
      </div>
      {!hideFooter && (
        <footer className="relative z-10 text-center text-white py-4 text-sm mt-auto">
          &copy; 2025 Devon Martindale
        </footer>
      )}
    </div>
  );
}
