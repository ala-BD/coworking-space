// utils/dashboardPeriod.js — Périodes globales de dashboard (PowerBI-style)
// Fenêtres alignées avec le backend : jour / mois / année / tout.

export const PERIOD_OPTIONS = [
  { key: 'jour', label: 'Jour', icon: 'today' },
  { key: 'mois', label: 'Mois', icon: 'calendar_month' },
  { key: 'annee', label: 'Année', icon: 'calendar_view_month' },
  { key: 'tout', label: 'Tout', icon: 'all_inclusive' },
];

export const DEFAULT_PERIOD = 'mois';

export function periodWindow(period, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  let fromJ, toJ, bucket;
  switch (period) {
    case 'jour':
      fromJ = new Date(y, m, now.getDate(), 0, 0, 0, 0);
      toJ = new Date(y, m, now.getDate(), 23, 59, 59, 999);
      bucket = 'hour';
      break;
    case 'annee':
      fromJ = new Date(y, 0, 1, 0, 0, 0, 0);
      toJ = new Date(y, 11, 31, 23, 59, 59, 999);
      bucket = 'month';
      break;
    case 'tout':
      fromJ = new Date(2020, 0, 1, 0, 0, 0, 0);
      toJ = new Date(y, m, now.getDate(), 23, 59, 59, 999);
      bucket = 'year';
      break;
    case 'mois':
    default:
      fromJ = new Date(y, m, 1, 0, 0, 0, 0);
      toJ = new Date(y, m + 1, 0, 23, 59, 59, 999);
      bucket = 'day';
      break;
  }
  return { key: period, from: fromJ.toISOString(), to: toJ.toISOString(), fromJ, toJ, bucket };
}

export function inWindow(dateStr, win) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= win.fromJ && d <= win.toJ;
}

export function windowLabel(period) {
  const now = new Date();
  switch (period) {
    case 'jour':
      return now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    case 'mois':
      return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    case 'annee':
      return String(now.getFullYear());
    default:
      return 'Toute la période';
  }
}

// Badge de tendance : "▲ +12% vs période préc."
export function trendBadge(cur, prev, unit = '') {
  const diff = cur - prev;
  if (diff > 0) return { text: `▲ +${diff.toLocaleString('fr-FR')}${unit} vs période préc.`, dir: 'up', value: diff };
  if (diff < 0) return { text: `▼ ${diff.toLocaleString('fr-FR')}${unit} vs période préc.`, dir: 'down', value: Math.abs(diff) };
  return { text: '→ Stable vs période préc.', dir: 'flat', value: 0 };
}

// Colonnes couleur cohérentes PowerBI
export const CHART_COLORS = ['#f95d00', '#2fbe8f', '#8b5cf6', '#f59e0b', '#0ea5e9', '#ec4899', '#14b8a6', '#6366f1'];