// components/ui/Badge.jsx
import React from 'react';

export function Badge({ children, variant = 'secondary', className = '' }) {
  // variants match bootstrap colors: primary, secondary, success, danger, warning, info, light, dark
  return (
    <span className={`badge bg-${variant} ${className}`}>
      {children}
    </span>
  );
}
