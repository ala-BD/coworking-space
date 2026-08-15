// models/helpers.js — Fonctions utilitaires partagées entre tous les controllers
const { supabaseAdmin } = require('../config/supabase');

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function isDateInRange(dateStr, startStr, endStr) {
  const d = dateStr || todayISO();
  if (startStr && d < startStr) return false;
  if (endStr && d > endStr) return false;
  return true;
}

function applyPromoDiscount(prix, promo) {
  if (!promo) return { prixFinal: prix, reduction: 0 };
  let reduction = promo.type_reduction === 'percent'
    ? (prix * promo.valeur) / 100
    : promo.valeur;
  reduction = Math.min(reduction, prix);
  return { prixFinal: Math.max(0, prix - reduction), reduction };
}

async function findActiveTarif(typeAbonnement, planTarifaire, tenantId) {
  const today = todayISO();
  let q = supabaseAdmin
    .from('tarifs_abonnements')
    .select('*')
    .eq('type_abonnement', typeAbonnement)
    .eq('plan_tarifaire', planTarifaire)
    .eq('actif', true)
    .lte('date_debut', today);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q.order('date_debut', { ascending: false });
  if (error) throw error;
  const tarif = (data || []).find((t) => !t.date_fin || t.date_fin >= today);
  return tarif || null;
}

async function findValidPromoCode(code, tenantId) {
  const today = todayISO();
  let q = supabaseAdmin
    .from('codes_promo')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('actif', true);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q.single();
  if (error || !data) return null;
  if (!isDateInRange(today, data.date_debut, data.date_fin)) return null;
  if (data.utilisations_max != null && data.utilisations_count >= data.utilisations_max) return null;
  return data;
}

function sanitizeProfileForClient(profile, isStaff) {
  const copy = { ...profile };
  if (!isStaff) {
    delete copy.notes_admin;
  }
  return copy;
}

async function getCancellationPolicy(tenantId) {
  let q = supabaseAdmin.from('politique_annulation').select('*');
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
  return data || {
    delai_heures: 24,
    penalite_pct: 0,
    annulation_membre_autorisee: true,
    remboursement_auto: false,
    message_membre: "Annulation gratuite jusqu'à 24 h avant le début du créneau.",
  };
}

function evaluateCancellation(reservation, policy, isStaff) {
  if (isStaff) return { allowed: true, penalite_pct: 0 };
  if (!policy.annulation_membre_autorisee) {
    return { allowed: false, reason: "Les annulations en ligne sont désactivées. Contactez l'accueil." };
  }
  const hoursUntilStart = (new Date(reservation.date_debut).getTime() - Date.now()) / 3600000;
  if (hoursUntilStart < policy.delai_heures) {
    return {
      allowed: false,
      reason: `Annulation impossible moins de ${policy.delai_heures} h avant le début.`,
      hoursUntilStart: Number(hoursUntilStart.toFixed(1)),
    };
  }
  return { allowed: true, penalite_pct: Number(policy.penalite_pct || 0) };
}

async function hasActiveSubscription(userId) {
  const today = todayISO();
  const { data, error } = await supabaseAdmin
    .from('abonnements')
    .select('id')
    .eq('user_id', userId)
    .eq('statut', 'active')
    .lte('date_debut', today)
    .gte('date_fin', today)
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

async function ensureQrToken(userId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('qr_token')
    .eq('id', userId)
    .single();
  if (profile?.qr_token) return profile.qr_token;
  const crypto = require('crypto');
  const token = crypto.randomUUID();
  await supabaseAdmin.from('profiles').update({ qr_token: token }).eq('id', userId);
  return token;
}

function computeRemainingMinutes(dateFin) {
  return Math.max(0, Math.round((new Date(dateFin).getTime() - Date.now()) / 60000));
}

async function hasBookingOverlap(espaceId, dateDebut, dateFin, excludeId = null) {
  let query = supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('espace_id', espaceId)
    .in('statut', ['confirmed', 'pending'])
    .lt('date_debut', dateFin)
    .gt('date_fin', dateDebut);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).length > 0;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

module.exports = {
  todayISO,
  isDateInRange,
  applyPromoDiscount,
  findActiveTarif,
  findValidPromoCode,
  sanitizeProfileForClient,
  getCancellationPolicy,
  evaluateCancellation,
  hasActiveSubscription,
  ensureQrToken,
  computeRemainingMinutes,
  hasBookingOverlap,
  addDays,
};
