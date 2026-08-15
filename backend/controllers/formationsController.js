// controllers/formationsController.js — MODULE G : Formations catalogue & creation
const { supabaseAdmin } = require('../config/supabase');
const { hasBookingOverlap } = require('../models/helpers');
const { applyTenantFilter } = require('../middleware/guards');

async function listFormations(req, res) {
  try {
    const { statut, formateur_id, from, to } = req.query;
    let query = supabaseAdmin
      .from('formations')
      .select(`
        *,
        profiles!formateur_id (id, nom, prenom, specialite),
        espaces (id, nom, type),
        inscriptions_formations (count)
      `)
      .order('date_debut', { ascending: true });

    if (statut) query = query.eq('statut', statut);
    if (formateur_id) query = query.eq('formateur_id', formateur_id);
    if (from) query = query.gte('date_debut', from);
    if (to) query = query.lte('date_debut', to);
    query = applyTenantFilter(query, req);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const formatted = await Promise.all((data || []).map(async (f) => {
      const { count } = await supabaseAdmin
        .from('inscriptions_formations')
        .select('*', { count: 'exact', head: true })
        .eq('formation_id', f.id)
        .neq('statut', 'annulee');
      return { ...f, nb_inscrits: count || 0, places_restantes: f.capacite_max - (count || 0) };
    }));

    res.json({ formations: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getFormation(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('formations')
      .select(`*, profiles!formateur_id (id, nom, prenom, email, specialite, biographie), espaces (id, nom, type, capacite)`)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Formation introuvable.' });

    const { data: inscrits, count } = await supabaseAdmin
      .from('inscriptions_formations')
      .select('*, profiles!user_id (id, nom, prenom, email, telephone)', { count: 'exact' })
      .eq('formation_id', req.params.id)
      .neq('statut', 'annulee');

    const isStaff = ['super_admin', 'admin', 'staff'].includes(req.profile.role);
    const isFormateur = req.profile.role === 'formateur' && data.formateur_id === req.user.id;

    res.json({
      formation: { ...data, nb_inscrits: count || 0, places_restantes: data.capacite_max - (count || 0) },
      participants: (isStaff || isFormateur) ? (inscrits || []) : [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createFormation(req, res) {
  try {
    const { titre, description, formateur_id, espace_id, date_debut, date_fin, capacite_max, prix_inscription, programme, prerequis, materiel } = req.body;

    if (!titre || !formateur_id || !date_debut || !date_fin || !capacite_max) {
      return res.status(400).json({ error: 'titre, formateur_id, date_debut, date_fin et capacite_max sont requis.' });
    }
    if (new Date(date_debut) >= new Date(date_fin)) {
      return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
    }

    if (formateur_id !== req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez créer des formations que pour votre propre compte.' });
    }

    const { data: formateur, error: fErr } = await supabaseAdmin
      .from('profiles').select('id').eq('id', formateur_id).eq('role', 'formateur').single();
    if (fErr || !formateur) return res.status(404).json({ error: 'Formateur introuvable.' });

    if (espace_id) {
      const overlap = await hasBookingOverlap(espace_id, date_debut, date_fin);
      if (overlap) return res.status(409).json({ error: 'La salle est déjà réservée sur ce créneau.' });
    }

    const { data, error } = await supabaseAdmin
      .from('formations')
      .insert({
        titre, description: description || null, formateur_id, espace_id: espace_id || null,
        date_debut, date_fin, capacite_max: parseInt(capacite_max), prix_inscription: parseFloat(prix_inscription || 0),
        programme: programme || null, prerequis: prerequis || null, materiel: materiel || null,
        statut: 'planifiee', tenant_id: req.tenantId
      })
      .select(`*, profiles!formateur_id (id, nom, prenom), espaces (id, nom, type)`)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ formation: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateFormation(req, res) {
  try {
    const isStaff = ['admin', 'staff'].includes(req.profile.role);
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('formations').select('*').eq('id', req.params.id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Formation introuvable.' });

    const isFormateur = req.profile.role === 'formateur' && existing.formateur_id === req.user.id;
    if (!isStaff && !isFormateur) return res.status(403).json({ error: 'Droits insuffisants.' });

    const allowed = ['titre', 'description', 'espace_id', 'date_debut', 'date_fin', 'capacite_max', 'prix_inscription', 'statut', 'programme', 'prerequis', 'materiel'];
    const updates = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.date_debut || updates.date_fin) {
      const debut = updates.date_debut || existing.date_debut;
      const fin = updates.date_fin || existing.date_fin;
      if (new Date(debut) >= new Date(fin)) return res.status(400).json({ error: 'date_fin doit être postérieure à date_debut.' });
    }

    const { data, error } = await supabaseAdmin
      .from('formations').update(updates).eq('id', req.params.id)
      .select(`*, profiles!formateur_id (id, nom, prenom), espaces (id, nom, type)`).single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ formation: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteFormation(req, res) {
  try {
    const isAdmin = ['admin'].includes(req.profile.role);
    const isFormateur = req.profile.role === 'formateur';

    if (!isAdmin && !isFormateur) {
      return res.status(403).json({ error: 'Droits insuffisants pour cette action.' });
    }

    const { data: formation, error: fetchErr } = await supabaseAdmin
      .from('formations').select('id, statut, titre, formateur_id').eq('id', req.params.id).single();
    if (fetchErr || !formation) return res.status(404).json({ error: 'Formation introuvable.' });

    if (isFormateur && formation.formateur_id !== req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres formations.' });
    }

    const { count } = await supabaseAdmin
      .from('inscriptions_formations').select('*', { count: 'exact', head: true })
      .eq('formation_id', req.params.id).neq('statut', 'annulee');

    if ((count || 0) > 0) {
      const { error } = await supabaseAdmin
        .from('formations').update({ statut: 'annulee', updated_at: new Date().toISOString() }).eq('id', req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ message: `Formation "${formation.titre}" marquée comme annulée (${count} inscrit(s) concerné(s)).` });
    }

    const { error } = await supabaseAdmin.from('formations').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Formation supprimée.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listFormations,
  getFormation,
  createFormation,
  updateFormation,
  deleteFormation,
};
