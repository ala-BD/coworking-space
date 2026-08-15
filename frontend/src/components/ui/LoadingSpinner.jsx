// components/ui/LoadingSpinner.jsx
import React from 'react';

export function LoadingSpinner({ size = 'md', color = 'primary', className = '' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div className={`spinner-border text-${color} ${sizeClass}`} role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  );
}
