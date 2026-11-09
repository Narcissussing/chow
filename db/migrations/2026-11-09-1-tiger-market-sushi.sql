-- Tickets du 7 novembre : Tiger Market et Action à Meaux, articles coréens et japonais, recette Sushi sur 800 g de riz.
INSERT INTO achats.enseignes (id, nom) VALUES ('tiger-market', 'Tiger Market'), ('action', 'Action')
ON CONFLICT (id) DO NOTHING;
INSERT INTO achats.magasins (id, enseigne_id, nom, ville) VALUES
    ('tiger-market-meaux', 'tiger-market', 'Tiger Market Meaux', 'Meaux'),
    ('action-meaux', 'action', 'Action Meaux', 'Meaux')
ON CONFLICT (id) DO NOTHING;

-- Un article par produit qu'on ne remplace pas par un autre (riz japonais ≠ riz long, saumon fumé ≠ pavé).
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES
    ('riz-japonais', 'Riz japonais', 'alimentation-feculents', 'kg'),
    ('tteok', 'Gâteaux de riz (tteok)', 'alimentation-feculents', 'kg'),
    ('gochujang', 'Gochujang', 'alimentation-sauces', 'kg'),
    ('gochugaru', 'Gochugaru', 'alimentation-epices', 'kg'),
    ('sauce-tteokbokki', 'Sauce tteokbokki', 'alimentation-sauces', 'piece'),
    ('algues-nori', 'Algues nori', 'alimentation-epicerie', 'piece'),
    ('wasabi', 'Wasabi', 'alimentation-sauces', 'piece'),
    ('gingembre-marine', 'Gingembre mariné', 'alimentation-epicerie', 'piece'),
    ('vinaigre-riz', 'Vinaigre de riz', 'alimentation-sauces', 'l'),
    ('surimi', 'Surimi', 'alimentation-poissons', 'piece'),
    ('saumon-fume', 'Saumon fumé', 'alimentation-poissons', 'kg')
ON CONFLICT (id) DO NOTHING;
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref, suivi) VALUES
    ('sacs-poubelle-35', 'Sacs poubelle (35 L)', 'entretien-dechets', 'piece', 'nombre')
ON CONFLICT (id) DO NOTHING;

-- Aliments Chow : valeurs pour 100 g, moyennes d'étiquettes du commerce (à remplacer par les étiquettes des paquets).
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, origine, description, grammes_par_cuil_a_cafe, grammes_par_cuil_a_soupe, article_id)
VALUES
    ('riz-japonais', 'Riz japonais', 'Féculents', '🍚', 'g', 100, 358, 6.5, 79, 0.6, 1, 0.1, 0.2, 0, 'st', 'cl', 'Japon',
        'Riz rond à sushi.', NULL, NULL, 'riz-japonais'),
    ('tteok', 'Gâteaux de riz (tteok)', 'Féculents', '🍡', 'g', 100, 225, 4, 50, 0.5, 0.5, 0, 0.1, 0.3, 'fg', 'pack', 'Corée',
        'Bâtonnets de riz du tteokbokki.', NULL, NULL, 'tteok'),
    ('gochujang', 'Gochujang', 'Sauces', '🌶️', 'tbs', 15, 210, 4.5, 45, 1.5, 2, 22, 0.2, 7, 'fg', 'cl', 'Corée',
        'Pâte de piment rouge fermentée.', 6, 18, 'gochujang'),
    ('gochugaru', 'Gochugaru', 'Épices', '🌶️', 'g', 100, 300, 12, 50, 13, 30, 10, 2, 0.1, 'st', 'cl', 'Corée',
        'Piment coréen en poudre.', 2.5, 7, 'gochugaru'),
    ('sauce-tteokbokki', 'Sauce tteokbokki', 'Sauces', '🌶️', 'sachet', 50, 200, 3, 45, 1, 2, 25, 0.2, 6, 'st', 'pack', 'Corée',
        'Sauce prête pour le tteokbokki.', NULL, 18, 'sauce-tteokbokki'),
    ('algues-nori', 'Algues nori', 'Épicerie', '🌊', 'feuille', 3, 188, 31, 6, 3, 36, 0.5, 0.6, 1.5, 'st', 'pack', 'Japon',
        'Feuilles grillées pour les makis.', NULL, NULL, 'algues-nori'),
    ('wasabi', 'Wasabi', 'Sauces', '🟢', 'g', 100, 290, 3, 45, 10, 5, 30, 1, 6, 'fg', 'cl', 'Japon',
        'Pâte de wasabi en tube.', 5, NULL, 'wasabi'),
    ('gingembre-marine', 'Gingembre mariné', 'Épicerie', '🫚', 'g', 100, 50, 0.3, 11, 0.2, 1, 9, 0, 2.5, 'fg', 'cl', 'Japon',
        'Gingembre au vinaigre, servi avec les sushis.', NULL, NULL, 'gingembre-marine'),
    ('vinaigre-riz', 'Vinaigre de riz', 'Sauces', '🍶', 'ml', 100, 18, 0.3, 0.8, 0, 0, 0, 0, 0, 'st', 'cl', 'Japon',
        'Assaisonne le riz à sushi.', 5, 15, 'vinaigre-riz'),
    ('surimi', 'Surimi', 'Poissons', '🦀', 'pcs', 15, 105, 7, 15, 1.5, 0, 5, 0.3, 1.8, 'fg', 'pack', NULL,
        'Bâtonnets de surimi.', NULL, NULL, 'surimi'),
    ('saumon-fume', 'Saumon fumé', 'Poissons', '🐟', 'tranche', 25, 180, 22, 0.5, 10, 0, 0.5, 2, 3, 'fg', 'pack', NULL,
        'Saumon fumé en tranches.', NULL, NULL, 'saumon-fume')
ON CONFLICT (id) DO NOTHING;

-- Le vinaigre de riz Mizkan acheté chez Leclerc rejoint son article.
UPDATE achats.produits SET article_id = 'vinaigre-riz'
WHERE enseigne_id = 'leclerc' AND libelle = 'MIZKAN, VINAIGRE DE RIZ, 15CL' AND article_id = 'alimentation-a-detailler';

-- Sushi : 800 g de riz japonais ; saumon et thon pour les prochaines fois.
INSERT INTO chow.recettes (nom, categorie, etapes)
SELECT 'Sushi', 'plat', E'Rincer le riz jusqu''à ce que l''eau soit claire, puis le cuire\nMélanger vinaigre de riz, sucre et sel, verser sur le riz chaud et laisser tiédir\nCouper concombre, carotte, avocat, surimi et poisson en bâtonnets\nÉtaler le riz sur une feuille de nori posée sur le rouleau en bambou\nGarnir d''un trait de fromage à tartiner et des bâtonnets\nRouler en serrant, couper en 8\nServir avec wasabi et gingembre mariné'
WHERE NOT EXISTS (SELECT 1 FROM chow.recettes WHERE nom = 'Sushi');

INSERT INTO chow.recette_ingredients (recette_id, food_id, quantite_g, unite)
SELECT r.id, i.food_id, i.quantite_g, i.unite
FROM chow.recettes r
CROSS JOIN (VALUES
    ('riz-japonais', 800, 'g'),
    ('vinaigre-riz', 120, 'soupe'),
    ('sucre', 50, 'g'),
    ('sel', 10, 'g'),
    ('algues-nori', 30, 'piece'),
    ('surimi', 240, 'piece'),
    ('concombre', 300, 'piece'),
    ('carotte', 160, 'piece'),
    ('avocat', 170, 'piece'),
    ('fromage-tartiner', 150, 'g'),
    ('saumon', 250, 'g'),
    ('thon', 150, 'g'),
    ('wasabi', 10, 'g'),
    ('gingembre-marine', 50, 'g')
) AS i (food_id, quantite_g, unite)
WHERE r.nom = 'Sushi' AND NOT EXISTS (SELECT 1 FROM chow.recette_ingredients x WHERE x.recette_id = r.id);

DO $$
BEGIN
    IF (SELECT count(*) FROM chow.aliments WHERE id IN ('riz-japonais', 'tteok', 'gochujang', 'gochugaru', 'algues-nori', 'surimi', 'saumon-fume')) <> 7
        THEN RAISE EXCEPTION 'Aliments coréens et japonais manquants'; END IF;
    IF (SELECT count(*) FROM chow.recette_ingredients i JOIN chow.recettes r ON r.id = i.recette_id WHERE r.nom = 'Sushi') <> 14
        THEN RAISE EXCEPTION 'Recette Sushi incomplète'; END IF;
END $$;
