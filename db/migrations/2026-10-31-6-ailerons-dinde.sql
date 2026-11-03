-- Ailerons de dinde : créés sur la dev seulement, absents de la production ; puis ajoutés aux Courses.
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, description, article_id)
VALUES ('ailerons-dinde', 'Ailerons de dinde', 'Viandes', '🦃', 'barquette', 1000, 196, 19, 0, 13, 0, 0, 3.7, 0.2, 'fz', 'pack',
    'Ailerons de dinde, à mijoter ou griller.', (SELECT id FROM achats.articles WHERE id = 'ailerons-dinde'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO chow.courses (food_id)
SELECT 'ailerons-dinde'
WHERE NOT EXISTS (SELECT 1 FROM chow.courses WHERE food_id = 'ailerons-dinde' AND achete = false);
