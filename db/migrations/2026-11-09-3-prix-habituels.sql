-- Prix d'un achat habituel donnés par Olumide le 2026-11-09, pour les articles jamais vus sur un ticket.
UPDATE chow.aliments SET prix_habituel = v.prix
FROM (VALUES ('indomie', 15.00), ('milo', 7.00), ('poundo-yam', 5.00)) AS v (id, prix)
WHERE aliments.id = v.id;

-- Articles de la maison : même repli que les aliments (chow.aliments.prix_habituel) quand aucun ticket ne les connaît.
ALTER TABLE achats.articles ADD COLUMN IF NOT EXISTS prix_habituel NUMERIC(10, 2);
UPDATE achats.articles SET prix_habituel = 4.00 WHERE id = 'tampons';

DO $$
BEGIN
    IF (SELECT count(*) FROM chow.aliments WHERE id IN ('indomie', 'milo', 'poundo-yam') AND prix_habituel IS NOT NULL) <> 3
        OR (SELECT prix_habituel FROM achats.articles WHERE id = 'tampons') IS NULL
        THEN RAISE EXCEPTION 'Prix habituels manquants'; END IF;
END $$;
