-- Noms génériques demandés le 2026-11-09 : Deli'UP (Chow) et huile fine Tech9 (hors Chow).
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES
    ('yaourt-a-boire', 'Yaourt à boire', 'alimentation-cremerie', 'l')
ON CONFLICT (id) DO NOTHING;

-- Valeurs pour 100 g, moyennes d'un yaourt à boire fraise (à remplacer par l'étiquette de la bouteille).
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, origine, description, article_id, image)
VALUES
    ('yaourt-a-boire', 'Yaourt à boire', 'Laitiers', '🥛', 'bouteille', 93, 75, 2.7, 11.5, 1.6, 0, 11, 1.1, 0.1, 'fg', 'unite', NULL,
        'Petite bouteille de yaourt à boire aromatisé.', 'yaourt-a-boire', 'images/foods/yaourt-a-boire.webp')
ON CONFLICT (id) DO NOTHING;

UPDATE achats.produits SET article_id = 'yaourt-a-boire'
WHERE enseigne_id = 'leclerc' AND libelle = 'DELI''UP, GOUT FRAISE, 10X93ML' AND article_id = 'alimentation-a-detailler';

-- Le lubrifiant n'est plus seulement le WD-40 : l'huile fine multiusage y entre aussi.
UPDATE achats.articles SET nom = 'Lubrifiant' WHERE id = 'lubrifiant' AND nom = 'Lubrifiant (WD-40)';
