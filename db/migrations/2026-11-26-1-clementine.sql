-- Clémentine séparée de la Mandarine, demandée le 2026-11-26 : achetée à chaque passage, pour 4 € à 6 €.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES
    ('clementine', 'Clémentine', 'alimentation-fruits', 'kg')
ON CONFLICT (id) DO NOTHING;

-- Valeurs pour 100 g (Ciqual, clémentine crue) ; une clémentine pèse environ 70 g.
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, origine, description, article_id, prix_habituel, magasins)
VALUES
    ('clementine', 'Clémentine', 'Fruits', '🍊', 'pcs', 70, 47, 0.9, 12, 0.2, 1.7, 9.2, 0, 0, 'st', 'unite', 'Espagne',
        'Petit agrume sans pépins, achetée en vrac avec ses feuilles.', 'clementine', 5, 'marche-frais,leclerc,carrefour')
ON CONFLICT (id) DO NOTHING;

-- Les tickets de clémentines étaient rangés en Mandarine.
UPDATE achats.produits SET article_id = 'clementine' WHERE libelle ~ 'CLEMENTINE' AND article_id = 'mandarine';
UPDATE chow.courses SET food_id = 'clementine', nom_libre = NULL WHERE NOT achete AND nom_libre ~* 'cl[eé]mentine';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM chow.aliments WHERE id = 'clementine') THEN RAISE EXCEPTION 'Clémentine manquante'; END IF;
    IF EXISTS (SELECT 1 FROM achats.produits WHERE libelle ~ 'CLEMENTINE' AND article_id = 'mandarine')
        THEN RAISE EXCEPTION 'Clémentines encore en Mandarine'; END IF;
END $$;
