// controllers/bookingsController.js — MODULE B : Réservations
const { supabaseAdmin } = require('../config/supabase');
const { hasBookingOverlap, getCancellationPolicy, evaluateCancellation } = require('../models/helpers');
const { applyTenantFilter } = require('../middleware/guards');
const { notifyConfirmationReservation, notifyAnnulationReservation } = require('../services/notificationService');

async function getBookingsCalendar(req, res) {
  try {
    const { espace_id, from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Paramètres from et to requis (ISO date).' });
    }

    let query = supabaseAdmin
      .from('reservations')
      .select('id, espace_id, user_id, date_debut, date_fin, statut, mode, espaces(nom, type), profiles(nom, prenom, email)')
      .in('statut', ['confirmed', 'pending'])
      .lt('date_debut', to)
      .gt('date_fin', from)
      .order('date_debut', { ascending: true });

    query = applyTenantFilter(query, req);

    if (espace_id) {
      query = query.eq('espace_id', espace_id);
    }

    const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
    if (!isStaff) {
      query = query.eq('user_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ reservations: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createBooking(req, res) {
  try {
    const { espace_id, date_debut, date_fin, mode } = req.body;

    if (!espace_id || !date_debut || !date_fin) {
      return res.status(400).json({ error: 'espace_id, date_debut et date_fin sont requis.' });
    }

    if (new Date(date_debut) >= new Date(date_fin)) {
      return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
    }

    const overlap = await hasBookingOverlap(espace_id, date_debut, date_fin);
    if (overlap) {
      return res.status(409).json({ error: 'Conflit : ce créneau est déjà réservé.' });
    }

    const { data, error } = await req.db
      .from('reservations')
      .insert({
        tenant_id: req.tenantId,
        user_id: req.user.id,
        espace_id,
        date_debut,
        date_fin,
        statut: 'pending',
        mode: mode || 'online',
      })
      .select('*, espaces(nom, type)')
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    try {
      await notifyConfirmationReservation(
        supabaseAdmin,
        {
          id: data.id,
          date_debut: data.date_debut,
          date_fin: data.date_fin,
          espaces: data.espaces
        },
        {
          id: req.user.id,
          nom: req.profile.nom,
          prenom: req.profile.prenom,
          email: req.user.email
        }
      );
    } catch (notifErr) {
      console.error('⚠️ Échec notification confirmation réservation:', notifErr.message);
    }

    res.status(201).json({ reservation: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteBooking(req, res) {
  const { id } = req.params;
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);

  try {
    const { data: reservation, error: fetchErr } = await supabaseAdmin
      .from('reservations')
      .select('*, espaces(nom, type)')
      .eq('id', id)
      .single();

    if (fetchErr || !reservation) {
      return res.status(404).json({ error: 'Réservation introuvable.' });
    }

    if (!isStaff && reservation.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez annuler que vos propres réservations.' });
    }

    const policy = await getCancellationPolicy(req.tenantId);
    const cancellation = evaluateCancellation(reservation, policy, isStaff);
    if (!cancellation.allowed) {
      return res.status(403).json({
        error: cancellation.reason,
        policy,
        hoursUntilStart: cancellation.hoursUntilStart,
      });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('reservations')
      .update({ statut: 'cancelled' })
      .eq('id', id);

    if (deleteErr) {
      return res.status(400).json({ error: deleteErr.message });
    }

    try {
      await notifyAnnulationReservation(
        supabaseAdmin,
        {
          id: reservation.id,
          date_debut: reservation.date_debut,
          date_fin: reservation.date_fin,
          espaces: reservation.espaces
        },
        {
          id: reservation.user_id,
          nom: req.profile.nom,
          prenom: req.profile.prenom,
          email: req.user.email
        }
      );
    } catch (notifErr) {
      console.error('⚠️ Échec notification annulation réservation:', notifErr.message);
    }

    res.json({
      message: 'Réservation annulée avec succès.',
      reservation,
      penalite_pct: cancellation.penalite_pct || 0,
    });
  } catch (err) {
    console.error('Erreur annulation réservation:', err);
    res.status(500).json({ error: err.message });
  }
}

async function checkAvailability(req, res) {
  const { espace_id, date_debut, date_fin, exclude_reservation_id } = req.body;

  if (!espace_id || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'espace_id, date_debut et date_fin sont requis.' });
  }

  if (new Date(date_debut) >= new Date(date_fin)) {
    return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
  }

  try {
    const overlap = await hasBookingOverlap(espace_id, date_debut, date_fin, exclude_reservation_id);
    res.json({
      isAvailable: !overlap,
      overlapsCount: overlap ? 1 : 0,
    });
  } catch (err) {
    console.error('Erreur disponibilité:', err);
    res.status(500).json({ error: err.message });
  }
}

async function listBookings(req, res) {
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
  const { statut, espace_id, from, to } = req.query;

  try {
    let query = supabaseAdmin
      .from('reservations')
      .select('*, espaces(nom, type, tarif_horaire), profiles(nom, prenom, email)')
      .order('date_debut', { ascending: false });

    if (!isStaff) {
      query = query.eq('user_id', req.user.id);
    }

    if (statut) query = query.eq('statut', statut);
    if (espace_id) query = query.eq('espace_id', espace_id);
    if (from) query = query.gte('date_debut', from);
    if (to) query = query.lte('date_debut', to);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ reservations: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getBookingsOccupation(req, res) {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Paramètres from et to requis (ISO date).' });
  }

  try {
    const { data: espaces, error: espErr } = await supabaseAdmin.from('espaces').select('id, nom, type, capacite');
    if (espErr) return res.status(500).json({ error: espErr.message });

    const { data: reservations, error: resErr } = await supabaseAdmin
      .from('reservations')
      .select('id, espace_id, date_debut, date_fin, statut')
      .in('statut', ['confirmed', 'pending'])
      .gte('date_debut', from)
      .lte('date_debut', to);

    if (resErr) return res.status(500).json({ error: resErr.message });

    const periodMs = new Date(to).getTime() - new Date(from).getTime();
    const report = (espaces || []).map((espace) => {
      const espaceReservations = (reservations || []).filter((r) => r.espace_id === espace.id);
      const reservedMs = espaceReservations.reduce((acc, r) => {
        return acc + (new Date(r.date_fin).getTime() - new Date(r.date_debut).getTime());
      }, 0);
      const taux = periodMs > 0 ? Math.min(100, (reservedMs / periodMs) * 100) : 0;

      return {
        espace_id: espace.id,
        nom: espace.nom,
        type: espace.type,
        capacite: espace.capacite,
        reservations_count: espaceReservations.length,
        taux_occupation_pct: Number(taux.toFixed(1)),
      };
    });

    res.json({ from, to, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateBooking(req, res) {
  const { id } = req.params;
  const { date_debut, date_fin, statut } = req.body;
  const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);

  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Réservation introuvable.' });
    }

    if (!isStaff && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Modification non autorisée.' });
    }

    const newDebut = date_debut || existing.date_debut;
    const newFin = date_fin || existing.date_fin;

    if (new Date(newDebut) >= new Date(newFin)) {
      return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
    }

    if (date_debut || date_fin) {
      const overlap = await hasBookingOverlap(existing.espace_id, newDebut, newFin, id);
      if (overlap) {
        return res.status(409).json({ error: 'Conflit : ce créneau est déjà réservé.' });
      }
    }

    const updates = {};
    if (date_debut) updates.date_debut = date_debut;
    if (date_fin) updates.date_fin = date_fin;
    if (statut && isStaff) {
      if (!['pending', 'confirmed', 'cancelled'].includes(statut)) {
        return res.status(400).json({ error: 'statut invalide.' });
      }
      updates.statut = statut;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie.' });
    }

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update(updates)
      .eq('id', id)
      .select('*, espaces(nom, type)')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ reservation: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getBookingsCalendar,
  createBooking,
  deleteBooking,
  checkAvailability,
  listBookings,
  getBookingsOccupation,
  updateBooking,
};
