// components/dashboard/PeriodFilter.jsx — Filtre global de période (Jour/Mois/Année/Tout)
import React, { useState, useEffect, useRef } from 'react';
import { PERIOD_OPTIONS, windowLabel } from '../../utils/dashboardPeriod';

export default function PeriodFilter({ value, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const select = (key) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <div className={`flex items-center gap-2 bg-white border border-outline-variant/10 rounded-2xl p-1.5 shadow-sm ${className}`}>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          title="Filtrer par période"
          aria-label="Filtrer par période"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 transition-colors ${
            open ? 'bg-secondary text-on-secondary' : 'bg-surface-container-low text-secondary hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>tune</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl border border-outline-variant/10 shadow-xl py-1.5 z-40 overflow-hidden">
            {PERIOD_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => select(o.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
                  value === o.key
                    ? 'text-primary bg-surface-container-low'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{o.icon}</span>
                {o.label}
                {value === o.key && (
                  <span className="ml-auto material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {PERIOD_OPTIONS.map((o) => {
          const active = value === o.key;
          return (
            <button
              type="button"
              key={o.key}
              onClick={() => onChange(o.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                active
                  ? 'text-white shadow-md'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
              style={active ? { background: 'linear-gradient(135deg, #f95d00, #ff7a2f)', boxShadow: '0 4px 12px rgba(249,93,0,.3)' } : undefined}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{o.icon}</span>
              {o.label}
            </button>
          );
        })}
      </div>
      <span className="hidden lg:flex items-center gap-1.5 pl-2 pr-1 text-[11px] font-semibold text-on-surface-variant/70 capitalize border-l border-outline-variant/10">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
        {windowLabel(value)}
      </span>
    </div>
  );
}