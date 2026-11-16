-- Café en grains, café moulu et Nescafé, demandés le 2026-11-14 (aucun café dans Chow jusque-là).
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES
    ('cafe-grains', 'Café en grains', 'boissons', 'kg'),
    ('cafe-moulu', 'Café moulu', 'boissons', 'kg'),
    ('nescafe', 'Nescafé', 'boissons', 'kg')
ON CONFLICT (id) DO NOTHING;

-- Valeurs pour 100 ml de café préparé, comme le Thé Vert ; paquets et pots suivis au niveau, au placard.
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, origine, description, article_id)
VALUES
    ('cafe-grains', 'Café en grains', 'Boissons', '☕', 'g', 0, 2, 0.1, 0, 0, 0, 0, 0, 0, 'st', 'cl', NULL,
        'Grains à moudre (Lavazza, Starbucks).', 'cafe-grains'),
    ('cafe-moulu', 'Café moulu', 'Boissons', '☕', 'g', 0, 2, 0.1, 0, 0, 0, 0, 0, 0, 'st', 'cl', NULL,
        'Café moulu pour cafetière.', 'cafe-moulu'),
    ('nescafe', 'Nescafé', 'Boissons', '☕', 'g', 0, 2, 0.1, 0.3, 0, 0, 0, 0, 0, 'st', 'cl', 'Suisse',
        'Café soluble.', 'nescafe')
ON CONFLICT (id) DO NOTHING;

-- Lignes de tickets restées « à détailler ». Lavazza Espresso Perfetto en grains : paquet de 1 kg (21,39 €).
UPDATE achats.produits SET article_id = 'cafe-grains', contenance = 1, unite = 'kg'
WHERE enseigne_id = 'marche-frais' AND libelle = 'LVZ GRAIN ESPR PERF' AND article_id = 'alimentation-a-detailler';
UPDATE achats.produits SET article_id = 'cafe-grains', contenance = 0.45, unite = 'kg'
WHERE enseigne_id = 'leclerc' AND libelle = 'STARBUCKS,GRAINS COLOMBIA,450G' AND article_id = 'alimentation-a-detailler';
UPDATE achats.produits SET article_id = 'nescafe', contenance = 0.2, unite = 'kg'
WHERE enseigne_id = 'leclerc' AND libelle = 'NESC SPE FILTRE FLAC.200G' AND article_id = 'alimentation-a-detailler';
-- Nescafé : seulement le pot acheté aujourd'hui ; sticks et soluble Leclerc restent à détailler pour ne pas tirer le prix vers 2,85 €.

DO $$
BEGIN
    IF (SELECT count(*) FROM chow.aliments WHERE id IN ('cafe-grains', 'cafe-moulu', 'nescafe')) <> 3
        THEN RAISE EXCEPTION 'Cafés manquants'; END IF;
END $$;
