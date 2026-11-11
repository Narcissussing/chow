-- Tickets du 10 novembre : galettes de poisson (Tiger Market) et recette Tteokbokki, demandées le 2026-11-11.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES
    ('galettes-poisson', 'Galettes de poisson (eomuk)', 'alimentation-poissons', 'piece')
ON CONFLICT (id) DO NOTHING;

-- Valeurs pour 100 g : moyenne d'étiquettes d'eomuk du commerce, à remplacer par celle du paquet.
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, origine, description, article_id)
VALUES ('galettes-poisson', 'Galettes de poisson (eomuk)', 'Poissons', '🍥', 'feuille', 30, 140, 10, 15, 4.5, 0, 4, 1, 2, 'fz', 'pack',
    'Corée', 'Feuilles de pâte de poisson du tteokbokki.', 'galettes-poisson')
ON CONFLICT (id) DO NOTHING;

-- Gochujang et gochugaru : pots suivis au niveau, au placard.
UPDATE chow.aliments SET tracking_type = 'cl', emplacement = 'st' WHERE id IN ('gochujang', 'gochugaru');

-- Gâteaux de riz : 3 portions par sachet, 2 pour un repas à deux ; ajout au Stock par +3, +6, +9.
UPDATE chow.aliments SET tracking_type = 'unite', unite = 'portion', poids_unite_g = 225, pas_achat = '{3,6,9}' WHERE id = 'tteok';
UPDATE achats.produits SET contenance = 3 WHERE article_id = 'tteok' AND unite = 'piece';

-- Tteokbokki pour deux : moyenne de trois recettes, sauce soja sucrée faute de sauce soja nature.
INSERT INTO chow.recettes (nom, categorie, etapes)
SELECT 'Tteokbokki', 'plat', E'Boil eggs and peel\nSoak rice cakes in warm water\nBoil 2 cups of water and stir in gochujang, gochugaru, soy sauce, sugar and garlic\nAdd rice cakes and let cook till soft\nAdd fish cake and green onion\nAdd eggs and serve'
WHERE NOT EXISTS (SELECT 1 FROM chow.recettes WHERE nom = 'Tteokbokki');

INSERT INTO chow.recette_ingredients (recette_id, food_id, quantite_g, unite)
SELECT r.id, i.food_id, i.quantite_g, i.unite
FROM chow.recettes r
CROSS JOIN (VALUES
    ('tteok', 450, 'piece'),
    ('galettes-poisson', 90, 'piece'),
    ('gochujang', 36, 'soupe'),
    ('gochugaru', 7, 'soupe'),
    ('sauce-soja-sucree', 17, 'soupe'),
    ('sucre-brun', 28, 'soupe'),
    ('ail', 12, 'piece'),
    ('oignon-printemps', 40, 'piece'),
    ('oeuf-moyen', 110, 'piece')
) AS i (food_id, quantite_g, unite)
WHERE r.nom = 'Tteokbokki' AND NOT EXISTS (SELECT 1 FROM chow.recette_ingredients x WHERE x.recette_id = r.id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM chow.aliments WHERE id = 'galettes-poisson') THEN RAISE EXCEPTION 'Galettes de poisson manquantes'; END IF;
    IF (SELECT count(*) FROM chow.recette_ingredients i JOIN chow.recettes r ON r.id = i.recette_id WHERE r.nom = 'Tteokbokki') <> 9
        THEN RAISE EXCEPTION 'Recette Tteokbokki incomplète'; END IF;
END $$;
