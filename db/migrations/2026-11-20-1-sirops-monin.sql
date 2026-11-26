-- Sirops Monin pour les boissons (caramel salé 70 cl, chocolat blanc 25 cl), demandés le 2026-11-20.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES
    ('sirop-caramel-sale', 'Sirop caramel salé', 'boissons', 'l'),
    ('sirop-chocolat-blanc', 'Sirop chocolat blanc', 'boissons', 'l')
ON CONFLICT (id) DO NOTHING;

-- Valeurs pour 100 ml, étiquettes Monin ; bouteilles suivies au niveau, au placard.
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, origine, description, article_id)
VALUES
    ('sirop-caramel-sale', 'Sirop caramel salé', 'Boissons', '🍮', 'ml', 100, 326, 0, 80.3, 0, 0, 80.3, 0, 1.01, 'st', 'cl', 'France',
        'Sirop Monin pour les boissons, bouteille de 70 cl.', 'sirop-caramel-sale'),
    ('sirop-chocolat-blanc', 'Sirop chocolat blanc', 'Boissons', '🍫', 'ml', 100, 322, 0, 80, 0, 0, 80, 0, 0.03, 'st', 'cl', 'France',
        'Sirop Monin pour les boissons, bouteille de 25 cl.', 'sirop-chocolat-blanc')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF (SELECT count(*) FROM chow.aliments WHERE id IN ('sirop-caramel-sale', 'sirop-chocolat-blanc')) <> 2
        THEN RAISE EXCEPTION 'Sirops manquants'; END IF;
END $$;
