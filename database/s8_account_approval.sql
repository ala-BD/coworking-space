-- =========================================================================
-- S8 — Flux d'approbation des comptes (statut_compte = 'en_attente')
-- =========================================================================
-- Ce fichier modifie la table profiles pour :
-- 1. Ajouter 'en_attente' comme statut valide
-- 2. Changer le DEFAULT de 'actif' à 'en_attente' pour les nouveaux comptes
-- 3. Mettre à jour le trigger pour passer specialite & biographie
-- =========================================================================

-- 1. Supprimer l'ancienne contrainte CHECK sur statut_compte
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_statut_compte_check;

-- 2. Ajouter la nouvelle contrainte CHECK incluant 'en_attente'
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_statut_compte_check
    CHECK (statut_compte IN ('actif', 'suspendu', 'expire', 'en_attente'));

-- 3. Changer le DEFAULT pour que tout nouveau compte soit 'en_attente'
ALTER TABLE public.profiles
  ALTER COLUMN statut_compte SET DEFAULT 'en_attente';

-- 4. Mettre à jour le trigger handle_new_user pour inclure specialite & biographie, ainsi que la création de tenant si le rôle est 'admin'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_tenant_id UUID := NULL;
    coworking_name TEXT;
BEGIN
    coworking_name := new.raw_user_meta_data->>'coworking_name';

    -- Si c'est un nouvel admin et qu'un nom de coworking est fourni, créer le tenant (espace de coworking)
    IF COALESCE(new.raw_user_meta_data->>'role', 'member') = 'admin' AND coworking_name IS NOT NULL THEN
        INSERT INTO public.tenants (nom, slug, email, telephone, statut, settings)
        VALUES (
            coworking_name,
            lower(regexp_replace(coworking_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(new.id::text, 1, 8),
            new.email,
            COALESCE(new.raw_user_meta_data->>'telephone', ''),
            'suspendu', -- Le tenant commence suspendu jusqu'à l'approbation du Super Admin
            '{"onboarding_completed": false}'::jsonb
        )
        RETURNING id INTO new_tenant_id;
    END IF;

    INSERT INTO public.profiles (id, nom, prenom, email, role, telephone, type_membre, specialite, biographie, statut_compte, tenant_id)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'nom', ''),
        COALESCE(new.raw_user_meta_data->>'prenom', ''),
        new.email,
        COALESCE(new.raw_user_meta_data->>'role', 'member'),
        COALESCE(new.raw_user_meta_data->>'telephone', ''),
        COALESCE(new.raw_user_meta_data->>'type_membre', 'individuel'),
        COALESCE(new.raw_user_meta_data->>'specialite', NULL),
        COALESCE(new.raw_user_meta_data->>'biographie', NULL),
        'en_attente', -- Le compte commence en attente d'approbation
        new_tenant_id
    );

    -- Associer le contact_admin_id du tenant créé au profil de l'admin
    IF new_tenant_id IS NOT NULL THEN
        UPDATE public.tenants SET contact_admin_id = new.id WHERE id = new_tenant_id;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Les comptes admin/super_admin/staff existants sont déjà actifs — pas de changement nécessaire
-- Pour les nouveaux admins créés via l'interface, l'approbation se fait manuellement dans Supabase Studio
-- OU via le backend directement.
-- Note: les comptes Admin Coworking s'inscrivent via Register.jsx
-- et sont approuvés par le Super Admin. Après approbation, l'admin
-- complète la configuration (espaces, places) via /admin/onboarding.

-- (Optionnel) Si vous voulez approuver automatiquement les admins/staff existants :
-- UPDATE public.profiles SET statut_compte = 'actif' WHERE role IN ('admin', 'staff', 'super_admin') AND statut_compte = 'en_attente';
