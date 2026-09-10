import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { bookingApi, sessionApi } from '../services/api';
import { connectSocket, joinStaff, onSessionStarted, onSessionEnded, onSessionOvertime, disconnectSocket } from '../services/socket';
import PortalLayout from '../components/layout/PortalLayout';

const HOUR_START = 8;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

const STATUT_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
};

// Palette de couleurs distinctes par salle — bg, border, text
const SPACE_PALETTE = [
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e3a5f', badge: '#3b82f6' },  // bleu
  { bg: '#dcfce7', border: '#22c55e', text: '#14532d', badge: '#22c55e' },  // vert
  { bg: '#fef9c3', border: '#eab308', text: '#713f12', badge: '#ca8a04' },  // jaune
  { bg: '#fce7f3', border: '#ec4899', text: '#831843', badge: '#ec4899' },  // rose
  { bg: '#ede9fe', border: '#8b5cf6', text: '#3b0764', badge: '#8b5cf6' },  // violet
  { bg: '#ffedd5', border: '#f97316', text: '#7c2d12', badge: '#ea580c' },  // orange
  { bg: '#cffafe', border: '#06b6d4', text: '#164e63', badge: '#0891b2' },  // cyan
  { bg: '#fef2f2', border: '#ef4444', text: '#7f1d1d', badge: '#dc2626' },  // rouge
  { bg: '#ecfdf5', border: '#10b981', text: '#064e3b', badge: '#059669' },  // émeraude
  { bg: '#f5f3ff', border: '#a78bfa', text: '#2e1065', badge: '#7c3aed' },  // indigo
];

// Associer un index de couleur stable à chaque espace_id
const spaceColorCache = {};
let spaceColorIndex = 0;

function getSpaceColor(espaceId) {
  if (!espaceId) return SPACE_PALETTE[0];
  if (spaceColorCache[espaceId] === undefined) {
    spaceColorCache[espaceId] = spaceColorIndex % SPACE_PALETTE.length;
    spaceColorIndex++;
  }
  return SPACE_PALETTE[spaceColorCache[espaceId]];
}

// Calcule les groupes de chevauchement et retourne pour chaque réservation
// sa colonne (col) et le nombre total de colonnes (total) dans son groupe.
function computeOverlapLayout(bookingsForDay) {
  const sorted = [...bookingsForDay].sort(
    (a, b) => new Date(a.date_debut) - new Date(b.date_debut)
  );

  // Algorithme de colonnes : on place chaque réservation dans la première
  // colonne libre (sans chevauchement).
  const columns = []; // columns[i] = date_fin de la dernière réservation dans la col i
  const layout = {}; // booking.id → { col, total }

  sorted.forEach((b) => {
    const start = new Date(b.date_debut).getTime();
    const end = new Date(b.date_fin).getTime();
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c] <= start) {
        columns[c] = end;
        layout[b.id] = { col: c };
        placed = true;
        break;
      }
    }
    if (!placed) {
      layout[b.id] = { col: columns.length };
      columns.push(end);
    }
  });

  const totalCols = columns.length;

  // Deuxième passe : pour chaque réservation, on calcule combien de colonnes
  // son groupe occupe réellement (les réservations qui se chevauchent avec elle).
  sorted.forEach((b) => {
    const start = new Date(b.date_debut).getTime();
    const end = new Date(b.date_fin).getTime();
    // Trouver toutes les réservations qui chevauchent b
    const overlapping = sorted.filter((o) => {
      if (o.id === b.id) return false;
      const os = new Date(o.date_debut).getTime();
      const oe = new Date(o.date_fin).getTime();
      return os < end && oe > start;
    });
    const maxCol = overlapping.reduce(
      (max, o) => Math.max(max, layout[o.id]?.col ?? 0),
      layout[b.id].col
    );
    layout[b.id].total = maxCol + 1;
  });

  // Si une réservation n'a pas de voisins, total = 1
  sorted.forEach((b) => {
    if (!layout[b.id].total) layout[b.id].total = 1;
  });

  return layout;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDayLabel(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function bookingPosition(booking, dayDate) {
  const dayStart = new Date(dayDate);
  dayStart.setHours(HOUR_START, 0, 0, 0);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(HOUR_END, 0, 0, 0);

  const start = new Date(booking.date_debut);
  const end = new Date(booking.date_fin);

  const visibleStart = start < dayStart ? dayStart : start;
  const visibleEnd = end > dayEnd ? dayEnd : end;

  if (visibleEnd <= dayStart || visibleStart >= dayEnd) return null;

  const totalMinutes = (HOUR_END - HOUR_START) * 60;
  const topMinutes = (visibleStart.getHours() - HOUR_START) * 60 + visibleStart.getMinutes();
  const durationMinutes = (visibleEnd - visibleStart) / 60000;

  return {
    top: `${(topMinutes / totalMinutes) * 100}%`,
    height: `${Math.max((durationMinutes / totalMinutes) * 100, 4)}%`,
  };
}

export default function AdminAgenda({ session }) {
  const [profile, setProfile] = useState(null);
  const [espaces, setEspaces] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedEspace, setSelectedEspace] = useState('');
  const [viewMode, setViewMode] = useState('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [qrInput, setQrInput] = useState('');
  const qrScannerRef = useRef(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') return [weekStart];
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [viewMode, weekStart]);

  useEffect(() => {
    loadInitial();
    connectSocket();
    joinStaff();

    const unsubs = [
      onSessionStarted(() => loadCalendar().catch(() => {})),
      onSessionEnded(() => loadCalendar().catch(() => {})),
      onSessionOvertime(() => loadCalendar().catch(() => {})),
    ];

    return () => {
      clearQrScanner();
      unsubs.forEach((fn) => fn());
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (profile) loadCalendar();
  }, [profile, weekStart, viewMode, selectedEspace]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (profErr) throw profErr;
      setProfile(prof);

      const { espaces: spaceList } = await bookingApi.getEspaces();
      setEspaces(spaceList || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    try {
      setError('');
      const from = visibleDays[0];
      const to = addDays(visibleDays[visibleDays.length - 1], 1);
      to.setHours(0, 0, 0, 0);

      const params = {
        from: from.toISOString(),
        to: to.toISOString(),
      };
      if (selectedEspace) params.espace_id = selectedEspace;

      const [calendarData, sessionsData] = await Promise.all([
        bookingApi.getCalendar(params),
        sessionApi.getAll({ statut: 'active' }),
      ]);

      setBookings(calendarData.reservations || []);
      setActiveSessions(sessionsData.sessions || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const shiftPeriod = (delta) => {
    setWeekStart((prev) => addDays(prev, viewMode === 'day' ? delta : delta * 7));
  };

  const handleConfirm = async (id) => {
    setActionId(id);
    setError('');
    try {
      await bookingApi.update(id, { statut: 'confirmed' });
      setSuccess('Réservation confirmée.');
      setSelectedBooking(null);
      await loadCalendar();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Annuler cette réservation ?')) return;
    setActionId(id);
    try {
      await bookingApi.cancel(id);
      setSuccess('Réservation annulée.');
      setSelectedBooking(null);
      await loadCalendar();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleCheckIn = async (reservationId) => {
    setActionId(reservationId);
    try {
      const result = await sessionApi.checkIn({ reservation_id: reservationId, force: true });
      setSuccess(result.warning || 'Check-in enregistré.');
      await loadCalendar();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleCheckOut = async (reservationId) => {
    setActionId(reservationId);
    try {
      const result = await sessionApi.checkOut({ reservation_id: reservationId });
      setSuccess(result.message || 'Check-out enregistré.');
      await loadCalendar();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  const extractQrToken = (raw) => {
    let token = (raw || '').trim();
    if (!token) return null;
    try {
      const parsed = JSON.parse(token);
      token = parsed.qr_token || parsed.token || token;
    } catch {
      // token brut
    }
    return token;
  };

  const runQrCheckIn = async (token, source) => {
    if (actionId === 'qr') return;
    setActionId('qr');
    try {
      const result = await sessionApi.checkIn({ qr_token: token, force: true });
      const memberLabel = result.member
        ? `${result.member.prenom || ''} ${result.member.nom || ''}`.trim()
        : '';
      const prefix = source === 'camera' ? 'Check-in QR (caméra) effectué.' : 'Check-in QR effectué.';
      setSuccess(`${prefix}${memberLabel ? ` Entrée vérifiée : ${memberLabel}.` : ''}${result.warning ? ` ${result.warning}` : ''}`);
      setQrInput('');
      await loadCalendar();
    } catch (e) {
      setError(e.message);
      const member = e.body?.member;
      if (member) setSuccess(`Membre identifié : ${member.prenom} ${member.nom}`);
    } finally {
      setActionId(null);
    }
  };

  const handleQrCheckIn = (e) => {
    e.preventDefault();
    const token = extractQrToken(qrInput);
    if (!token) return;
    runQrCheckIn(token, 'manual');
  };

  const clearQrScanner = () => {
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop();
      } catch {
        /* déjà arrêté */
      }
      try {
        qrScannerRef.current.clear();
      } catch {
        /* déjà nettoyé */
      }
      qrScannerRef.current = null;
    }
    const el = document.getElementById('qr-reader');
    if (el) el.innerHTML = '';
  };

  const startCameraScan = async () => {
    setScannerError('');
    setShowScanner(true);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      const el = document.getElementById('qr-reader');
      if (!el) return;
      el.innerHTML = '';
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        },
        false
      );
      qrScannerRef.current = scanner;
      scanner.render(
        (decodedText) => {
          const token = extractQrToken(decodedText);
          if (!token) return;
          clearQrScanner();
          setShowScanner(false);
          runQrCheckIn(token, 'camera');
        },
        () => {
          /* erreurs de décodage ignorées (scanne en continu) */
        }
      );
    } catch (err) {
      setScannerError(`Caméra inaccessible : ${err.message}`);
      setShowScanner(false);
    }
  };

  const toggleCameraScan = () => {
    if (qrScannerRef.current) {
      clearQrScanner();
      setShowScanner(false);
    } else {
      startCameraScan();
    }
  };

  const isSessionActive = (reservationId) =>
    activeSessions.some((s) => s.reservation_id === reservationId && s.statut === 'active');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary" />
      </div>
    );
  }

  return (
    <PortalLayout profile={profile} onLogout={handleLogout}>
      <header className="mb-lg flex flex-col lg:flex-row lg:items-end justify-between gap-md">
        <div>
          <h1 className="font-sora text-headline-lg text-primary">Agenda admin</h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Calendrier interactif avec check-in/check-out en temps réel
          </p>

        </div>
        <div className="flex flex-wrap gap-sm items-center">
          <select
            value={selectedEspace}
            onChange={(e) => setSelectedEspace(e.target.value)}
            className="border rounded-xl px-sm py-xs text-body-sm"
          >
            <option value="">Tous les espaces</option>
            {espaces.map((es) => (
              <option key={es.id} value={es.id}>{es.nom}</option>
            ))}
          </select>
          <div className="flex rounded-xl overflow-hidden border border-outline-variant/20">
            {['day', 'week'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-md py-xs text-label-sm font-semibold ${
                  viewMode === mode ? 'bg-primary text-white' : 'bg-white'
                }`}
              >
                {mode === 'day' ? 'Jour' : 'Semaine'}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => shiftPeriod(-1)} className="px-sm py-xs border rounded-xl">←</button>
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-sm py-xs border rounded-xl text-label-sm">Aujourd&apos;hui</button>
          <button type="button" onClick={() => shiftPeriod(1)} className="px-sm py-xs border rounded-xl">→</button>
        </div>
      </header>

      {error && (
        <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl">{error}</div>
      )}
      {success && (
        <div className="mb-md p-sm bg-secondary-fixed text-on-secondary-fixed text-body-sm rounded-xl">{success}</div>
      )}

      <form onSubmit={handleQrCheckIn} className="mb-md bg-surface-container-lowest rounded-xl p-md border border-outline-variant/10 flex flex-col sm:flex-row gap-sm items-end">
        <div className="flex-grow">
          <label className="block text-label-sm mb-xs">Check-in rapide par QR (staff)</label>
          <div className="flex gap-xs">
            <input
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="Coller le token QR ou scanner le payload JSON"
              className="w-full border rounded-xl px-sm py-xs font-mono text-body-sm"
            />
            <button
              type="button"
              onClick={toggleCameraScan}
              className={`shrink-0 px-md py-xs rounded-xl font-semibold border ${
                showScanner
                  ? 'bg-error-container text-on-error-container border-error/20'
                  : 'bg-white border-outline-variant/30 text-primary hover:bg-surface-container-low'
              }`}
            >
              <span className="flex items-center gap-xs">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {showScanner ? 'videocam_off' : 'qr_code_scanner'}
                </span>
                {showScanner ? 'Arrêter' : 'Scanner caméra'}
              </span>
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={actionId === 'qr'}
          className="bg-secondary text-white px-md py-xs rounded-xl font-semibold disabled:opacity-50"
        >
          Check-in QR
        </button>
      </form>

      <div
        id="qr-reader"
        className="mx-auto max-w-sm mb-md"
        style={{ display: showScanner ? 'block' : 'none' }}
      />
      {scannerError && (
        <div className="mb-md p-sm bg-error-container text-on-error-container text-body-sm rounded-xl">
          {scannerError}
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-x-auto custom-shadow">
        <div className="min-w-[800px]">
          <div className="grid border-b border-outline-variant/10" style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)` }}>
            <div className="p-sm bg-surface-container-low" />
            {visibleDays.map((day) => (
              <div key={day.toISOString()} className="p-sm text-center bg-surface-container-low border-l border-outline-variant/10">
                <p className="font-semibold text-primary capitalize">{formatDayLabel(day)}</p>
              </div>
            ))}
          </div>

          <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)` }}>
            <div>
              {HOURS.map((hour) => (
                <div key={hour} className="h-16 border-b border-outline-variant/10 pr-sm text-right text-label-sm text-on-surface-variant flex items-start justify-end pt-1">
                  {`${hour}:00`}
                </div>
              ))}
            </div>

            {visibleDays.map((day) => {
              const dayBookings = bookings.filter((b) => {
                const bDay = new Date(b.date_debut);
                return bDay.toDateString() === day.toDateString()
                  || (new Date(b.date_debut) <= day && new Date(b.date_fin) > day);
              });
              const overlapLayout = computeOverlapLayout(dayBookings);

              return (
                <div key={`col-${day.toISOString()}`} className="relative border-l border-outline-variant/10">
                  {HOURS.map((hour) => (
                    <div key={hour} className="h-16 border-b border-outline-variant/5" />
                  ))}

                  {dayBookings.map((booking) => {
                    const pos = bookingPosition(booking, day);
                    if (!pos) return null;

                    const active = isSessionActive(booking.id);
                    const cancelled = booking.statut === 'cancelled';
                    const color = getSpaceColor(booking.espace_id);
                    const { col, total } = overlapLayout[booking.id] || { col: 0, total: 1 };

                    // Largeur et position horizontale pour l'affichage côte à côte
                    const GAP = 2; // px entre colonnes
                    const widthPct = (100 / total);
                    const leftPct = col * widthPct;

                    return (
                      <button
                        key={`${booking.id}-${day.toISOString()}`}
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        style={{
                          position: 'absolute',
                          top: pos.top,
                          height: pos.height,
                          minHeight: '32px',
                          left: `calc(${leftPct}% + ${GAP}px)`,
                          width: `calc(${widthPct}% - ${GAP * 2}px)`,
                          backgroundColor: cancelled ? '#f1f5f9' : color.bg,
                          borderLeft: `4px solid ${cancelled ? '#94a3b8' : color.border}`,
                          borderRadius: '8px',
                          opacity: cancelled ? 0.55 : 1,
                          boxShadow: cancelled ? 'none' : '0 1px 4px rgba(0,0,0,0.10)',
                          padding: '3px 5px',
                          textAlign: 'left',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          transition: 'opacity 0.15s, box-shadow 0.15s',
                          zIndex: active ? 2 : 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = cancelled ? '0.7' : '0.88'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = cancelled ? '0.55' : '1'; e.currentTarget.style.boxShadow = cancelled ? 'none' : '0 1px 4px rgba(0,0,0,0.10)'; }}
                      >
                        {/* Nom de l'espace */}
                        <p
                          className="font-bold truncate leading-tight"
                          style={{
                            fontSize: '11px',
                            color: cancelled ? '#64748b' : color.text,
                            textDecoration: cancelled ? 'line-through' : 'none',
                          }}
                        >
                          {booking.espaces?.nom || '—'}
                        </p>

                        {/* Membre */}
                        <p
                          className="truncate leading-tight"
                          style={{ fontSize: '10px', color: cancelled ? '#94a3b8' : color.text, opacity: 0.8 }}
                        >
                          {booking.profiles?.prenom} {booking.profiles?.nom}
                        </p>

                        {/* Heure */}
                        <p
                          className="truncate leading-tight"
                          style={{ fontSize: '10px', color: cancelled ? '#94a3b8' : color.text, opacity: 0.65 }}
                        >
                          {new Date(booking.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {' → '}
                          {new Date(booking.date_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>

                        {/* Badges statut + live */}
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {active && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold"
                              style={{ fontSize: '9px', background: '#dcfce7', color: '#15803d' }}
                            >
                              <span style={{ fontSize: '7px' }}>●</span> Live
                            </span>
                          )}
                          <span
                            className="inline-flex items-center rounded-full px-1.5 py-0.5 font-semibold truncate"
                            style={{
                              fontSize: '9px',
                              background: cancelled ? '#e2e8f0' : color.border + '22',
                              color: cancelled ? '#64748b' : color.border,
                            }}
                          >
                            {STATUT_LABELS[booking.statut] || booking.statut}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-md">
          <div className="bg-surface-container-lowest rounded-3xl p-lg max-w-md w-full shadow-xl space-y-md">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {/* Pastille couleur de la salle */}
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: getSpaceColor(selectedBooking.espace_id).border }}
                />
                <h2 className="font-sora text-headline-sm text-primary">Détail réservation</h2>
              </div>
              <button type="button" onClick={() => setSelectedBooking(null)} className="text-on-surface-variant hover:text-primary transition-colors">✕</button>
            </div>
            {/* Bandeau salle */}
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-2"
              style={{
                background: getSpaceColor(selectedBooking.espace_id).bg,
                borderLeft: `4px solid ${getSpaceColor(selectedBooking.espace_id).border}`,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: getSpaceColor(selectedBooking.espace_id).border }}>meeting_room</span>
              <span className="font-bold text-sm" style={{ color: getSpaceColor(selectedBooking.espace_id).text }}>
                {selectedBooking.espaces?.nom}
              </span>
            </div>
            <div className="space-y-xs text-body-sm">
              <p><strong>Membre :</strong> {selectedBooking.profiles?.prenom} {selectedBooking.profiles?.nom}</p>
              <p><strong>Email :</strong> {selectedBooking.profiles?.email}</p>
              <p>
                <strong>Créneau :</strong>{' '}
                {new Date(selectedBooking.date_debut).toLocaleString('fr-FR')}
                {' → '}
                {new Date(selectedBooking.date_fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
              </p>
              <p>
                <strong>Statut :</strong>{' '}
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: selectedBooking.statut === 'confirmed' ? '#dcfce7' : selectedBooking.statut === 'pending' ? '#fef9c3' : '#f1f5f9',
                    color: selectedBooking.statut === 'confirmed' ? '#15803d' : selectedBooking.statut === 'pending' ? '#92400e' : '#64748b',
                  }}
                >
                  {STATUT_LABELS[selectedBooking.statut] || selectedBooking.statut}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-sm">
              {selectedBooking.statut === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleConfirm(selectedBooking.id)}
                  disabled={actionId === selectedBooking.id}
                  className="bg-secondary text-white px-md py-xs rounded-xl font-semibold text-label-sm"
                >
                  Confirmer
                </button>
              )}
              {['pending', 'confirmed'].includes(selectedBooking.statut) && (
                <>
                  <button
                    type="button"
                    onClick={() => handleCheckIn(selectedBooking.id)}
                    disabled={actionId === selectedBooking.id}
                    className="border border-secondary text-secondary px-md py-xs rounded-xl font-semibold text-label-sm"
                  >
                    Check-in
                  </button>
                  {isSessionActive(selectedBooking.id) && (
                    <button
                      type="button"
                      onClick={() => handleCheckOut(selectedBooking.id)}
                      disabled={actionId === selectedBooking.id}
                      className="border border-primary text-primary px-md py-xs rounded-xl font-semibold text-label-sm"
                    >
                      Check-out
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCancel(selectedBooking.id)}
                    disabled={actionId === selectedBooking.id}
                    className="text-error font-semibold text-label-sm hover:underline"
                  >
                    Annuler
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
