// components/ui/EmptyState.jsx
import React from 'react';

export function EmptyState({ title, description, icon: Icon, action, className = '' }) {
  return (
    <div className={`text-center py-5 px-3 border rounded bg-white shadow-sm d-flex flex-column align-items-center justify-content-center ${className}`}>
      {Icon && <Icon className="text-muted mb-3" size={48} />}
      <h3 className="h5 fw-bold text-dark">{title || 'Aucun élément trouvé'}</h3>
      <p className="text-muted small max-w-md mb-3">{description || "Il n'y a pas encore de données à afficher pour le moment."}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
