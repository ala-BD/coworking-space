-- ============================================================
-- cleanup_before_delete_users.sql
-- À exécuter dans Supabase → SQL Editor AVANT de relancer le script Node.js
-- Supprime toutes les données liées aux utilisateurs (dans le bon ordre)
-- ============================================================

-- 1. Tables qui bloquent la suppression des profils
TRUNCATE TABLE public.super_admin_audit_log    CASCADE;
TRUNCATE TABLE public.conversations            CASCADE;

-- 2. Autres tables dépendantes (nettoyage complet)
TRUNCATE TABLE public.notifications            CASCADE;
TRUNCATE TABLE public.paiements                CASCADE;
TRUNCATE TABLE public.reservations             CASCADE;
TRUNCATE TABLE public.sessions                 CASCADE;
TRUNCATE TABLE public.abonnements              CASCADE;
TRUNCATE TABLE public.messages                 CASCADE;

-- 3. Vérification : toutes ces tables doivent être vides
SELECT 'super_admin_audit_log' AS table_name, COUNT(*) AS lignes FROM public.super_admin_audit_log
UNION ALL
SELECT 'conversations',   COUNT(*) FROM public.conversations
UNION ALL
SELECT 'notifications',   COUNT(*) FROM public.notifications
UNION ALL
SELECT 'paiements',       COUNT(*) FROM public.paiements
UNION ALL
SELECT 'reservations',    COUNT(*) FROM public.reservations
UNION ALL
SELECT 'sessions',        COUNT(*) FROM public.sessions
UNION ALL
SELECT 'abonnements',     COUNT(*) FROM public.abonnements;
