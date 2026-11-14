-- Actimel, épices fajitas, sauce chipotle et coton-tiges, demandés le 2026-11-14.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES
    ('actimel', 'Actimel', 'alimentation-cremerie', 'piece'),
    ('epices-fajitas', 'Épices fajitas', 'alimentation-epices', 'piece'),
    ('sauce-chipotle', 'Sauce chipotle', 'alimentation-sauces', 'piece'),
    ('coton-tiges', 'Coton-tiges', 'hygiene-soins', 'piece')
ON CONFLICT (id) DO NOTHING;

-- Valeurs pour 100 g : étiquette d'Actimel nature ; moyennes de sachets d'épices fajitas et de sauces chipotle
-- (au moins 200 kcal demandé pour la sauce), à remplacer par l'étiquette du produit acheté.
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, origine, description, article_id)
VALUES
    ('actimel', 'Actimel', 'Laitiers', '🥛', 'bouteille', 100, 73, 2.8, 11.2, 1.6, 0, 10.8, 1, 0.1, 'fg', 'unite', NULL,
        'Petite bouteille de lait fermenté.', 'actimel'),
    ('epices-fajitas', 'Épices fajitas', 'Épices', '🌶️', 'sachet', 30, 290, 8, 50, 4, 11, 14, 0.6, 15, 'st', 'pack', 'Mexique',
        'Sachet de mélange d''épices pour fajitas.', 'epices-fajitas'),
    ('sauce-chipotle', 'Sauce chipotle', 'Sauces', '🌶️', 'tbs', 15, 330, 1, 10, 32, 0.5, 6, 2.5, 1.8, 'fg', 'cl', 'Mexique',
        'Sauce crémeuse au piment chipotle fumé.', 'sauce-chipotle')
ON CONFLICT (id) DO NOTHING;

-- Lignes de tickets restées « à détailler » : épices fajitas (Leclerc 2024) et coton-tiges Lotus (0,77 € la boîte de 160,
-- comptée comme une pièce : au bâtonnet, le prix s'arrondit à 0 €).
UPDATE achats.produits SET article_id = 'epices-fajitas'
WHERE enseigne_id = 'leclerc' AND libelle IN ('MELANGE AUX EPICES POUR FAJITAS', 'MELANGE D''EPICES POUR FAJITAS')
    AND article_id = 'alimentation-a-detailler';
UPDATE achats.produits SET article_id = 'coton-tiges', contenance = 1, unite = 'piece'
WHERE enseigne_id = 'leclerc' AND libelle = 'BATONNETS BIO,LOTUS,160P' AND article_id = 'alimentation-a-detailler';

-- Lignes de Courses saisies en texte libre (badge New) rattachées au nouvel aliment ou article.
UPDATE chow.courses SET food_id = 'sauce-chipotle', nom_libre = NULL WHERE NOT achete AND nom_libre ~* 'chipotle';
UPDATE chow.courses SET food_id = 'epices-fajitas', nom_libre = NULL WHERE NOT achete AND nom_libre ~* 'pices?.*fajita|fajita.*pices?';
UPDATE chow.courses SET food_id = 'actimel', nom_libre = NULL WHERE NOT achete AND nom_libre ~* 'actimel';
UPDATE chow.courses SET article_id = 'coton-tiges', nom_libre = NULL WHERE NOT achete AND nom_libre ~* 'coton.?tige';

DO $$
BEGIN
    IF (SELECT count(*) FROM chow.aliments WHERE id IN ('actimel', 'epices-fajitas', 'sauce-chipotle')) <> 3
        THEN RAISE EXCEPTION 'Aliments manquants'; END IF;
    IF NOT EXISTS (SELECT 1 FROM achats.articles WHERE id = 'coton-tiges') THEN RAISE EXCEPTION 'Coton-tiges manquants'; END IF;
END $$;
