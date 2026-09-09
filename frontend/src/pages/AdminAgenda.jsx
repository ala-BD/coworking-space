import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { bookingApi, sessionApi } from '../services/api';
import { connectSocket, joinStaff, onSessionStarted, onSessionEnded, onSessionOvertime, disconnectSocket } from '../services/socket';
import PortalLayout from '../components/layout/PortalLayout';

const HOUR_START = 8;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

const STATUT_COLORS = {
  pending: 'bg-amber-100 border-amber-400 text-amber-900',
  confirmed: 'bg-emerald-100 border-emerald-500 text-emerald-900',
  cancelled: 'bg-surface-container-high border-outline-variant text-on-surface-variant line-through opacity-60',
};

const STATUT_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
};

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

            {visibleDays.map((day) => (
              <div key={`col-${day.toISOString()}`} className="relative border-l border-outline-variant/10">
                {HOURS.map((hour) => (
                  <div key={hour} className="h-16 border-b border-outline-variant/5" />
                ))}

                {bookings
                  .filter((b) => {
                    const bDay = new Date(b.date_debut);
                    return bDay.toDateString() === day.toDateString()
                      || (new Date(b.date_debut) <= day && new Date(b.date_fin) > day);
                  })
                  .map((booking) => {
                    const pos = bookingPosition(booking, day);
                    if (!pos) return null;
                    const active = isSessionActive(booking.id);
                    return (
                      <button
                        key={`${booking.id}-${day.toISOString()}`}
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        className={`absolute left-1 right-1 rounded-lg border-l-4 px-1 py-0.5 text-left overflow-hidden text-label-sm shadow-sm hover:opacity-90 ${STATUT_COLORS[booking.statut] || STATUT_COLORS.pending}`}
                        style={{ top: pos.top, height: pos.height, minHeight: '28px' }}
                      >
                        <p className="font-semibold truncate">{booking.espaces?.nom}</p>
                        <p className="truncate opacity-80">
                          {booking.profiles?.prenom} {booking.profiles?.nom}
                        </p>
                        {active && (
                          <span className="text-label-sm font-bold text-secondary">● Live</span>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-md">
          <div className="bg-surface-container-lowest rounded-3xl p-lg max-w-md w-full shadow-xl space-y-md">
            <div className="flex justify-between items-start">
              <h2 className="font-sora text-headline-sm text-primary">Détail réservation</h2>
              <button type="button" onClick={() => setSelectedBooking(null)} className="text-on-surface-variant">✕</button>
            </div>
            <div className="space-y-xs text-body-sm">
              <p><strong>Espace :</strong> {selectedBooking.espaces?.nom}</p>
              <p><strong>Membre :</strong> {selectedBooking.profiles?.prenom} {selectedBooking.profiles?.nom}</p>
              <p><strong>Email :</strong> {selectedBooking.profiles?.email}</p>
              <p>
                <strong>Créneau :</strong>{' '}
                {new Date(selectedBooking.date_debut).toLocaleString('fr-FR')}
                {' → '}
                {new Date(selectedBooking.date_fin).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
              </p>
              <p><strong>Statut :</strong> {STATUT_LABELS[selectedBooking.statut] || selectedBooking.statut}</p>
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
