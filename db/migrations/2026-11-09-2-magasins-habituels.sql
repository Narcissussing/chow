-- Magasins habituels : un article peut s'acheter dans plusieurs enseignes. Liste choisie par Olumide le 2026-11-09 ;
-- sans liste, les tickets des 3 derniers mois décident (vue chow.v_magasins_habituels).

-- Radis mariné (danmuji) : acheté chez Tiger Market pour les sushis, sort du fourre-tout.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES ('radis-marine', 'Radis mariné', 'alimentation-epicerie', 'piece')
ON CONFLICT (id) DO NOTHING;
INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides, fibres, sucres,
    graisses_saturees, sel, emplacement, tracking_type, origine, description, article_id)
VALUES ('radis-marine', 'Radis mariné', 'Épicerie', '🟡', 'g', 100, 30, 0.5, 6.5, 0.1, 1.5, 5, 0, 2.5, 'fg', 'pack', 'Corée',
    'Radis jaune au vinaigre (danmuji), pour sushis et kimbap.', 'radis-marine')
ON CONFLICT (id) DO NOTHING;
UPDATE achats.produits SET article_id = 'radis-marine'
WHERE enseigne_id = 'tiger-market' AND libelle = '3106 RADIS MARINE AIGR' AND article_id = 'alimentation-a-detailler';

-- Le prix attendu du paprika fumé vient désormais de Tiger Market (il venait de Leclerc, comme les autres épices).
UPDATE achats.articles SET enseigne_prix_id = 'tiger-market' WHERE id = 'paprika-fume';

CREATE TABLE IF NOT EXISTS achats.enseignes_habituelles (
    article_id TEXT NOT NULL REFERENCES achats.articles(id) ON DELETE CASCADE,
    enseigne_id TEXT NOT NULL REFERENCES achats.enseignes(id),
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (article_id, enseigne_id)
);

INSERT INTO achats.enseignes_habituelles (article_id, enseigne_id)
SELECT a.id, v.enseigne_id
FROM (VALUES
    ('oignon', 'marche-frais'), ('patate-douce', 'marche-frais'), ('pomme-de-terre', 'leclerc'),
    ('mangue', 'marche-frais'), ('mangue', 'leclerc'), ('mangue', 'tiger-market'),
    ('papier-toilette', 'leclerc'), ('papier-toilette', 'action'), ('essuie-tout', 'leclerc'), ('essuie-tout', 'action'),
    ('nouilles-instantanees', 'tiger-market'), ('sauce-soja-sucree', 'tiger-market'), ('paprika-fume', 'tiger-market'),
    ('radis-marine', 'tiger-market'), ('riz-japonais', 'tiger-market'), ('algues-nori', 'tiger-market'),
    ('wasabi', 'tiger-market'), ('gingembre-marine', 'tiger-market'), ('vinaigre-riz', 'tiger-market'),
    ('tteok', 'tiger-market'), ('gochujang', 'tiger-market'), ('gochugaru', 'tiger-market'), ('sauce-tteokbokki', 'tiger-market')
) AS v (article_id, enseigne_id)
JOIN achats.articles a ON a.id = v.article_id
ON CONFLICT DO NOTHING;

-- L'ancien magasin unique, appris en cochant en mode magasin, fait place aux tickets et aux cases cochées
-- (chow.courses.enseigne), qui gardent déjà ce fait.
ALTER TABLE chow.aliments DROP COLUMN IF EXISTS magasin;

DO $$
BEGIN
    IF (SELECT count(*) FROM achats.enseignes_habituelles) < 23 THEN RAISE EXCEPTION 'Magasins habituels incomplets'; END IF;
END $$;
