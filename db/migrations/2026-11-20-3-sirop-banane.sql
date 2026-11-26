-- Sirop Monin banane jaune (70 cl) pour les boissons, étiquette fournie le 2026-11-20.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES
    ('sirop-banane', 'Sirop banane', 'boissons', 'l')
ON CONFLICT (id) DO NOTHING;

-- Valeurs pour 100 ml ; bouteille suivie au niveau, au placard.
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, origine, description, article_id)
VALUES
    ('sirop-banane', 'Sirop banane', 'Boissons', '🍌', 'ml', 100, 331, 0, 82.3, 0, 0, 82.3, 0, 0.03, 'st', 'cl', 'France',
        'Sirop Monin banane jaune (10 % de jus) pour les boissons, bouteille de 70 cl.', 'sirop-banane')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM chow.aliments WHERE id = 'sirop-banane') THEN RAISE EXCEPTION 'Sirop banane manquant'; END IF;
END $$;
