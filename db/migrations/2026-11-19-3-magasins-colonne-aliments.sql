-- Magasins d'un aliment : une colonne de la table aliments elle-même, lisible et modifiable sur sa ligne
-- (ex. {leclerc,marche-frais}) ; vide = magasins de ses achats des 3 derniers mois. Remplace chow.aliments_enseignes.
ALTER TABLE chow.aliments ADD COLUMN magasins TEXT[] NOT NULL DEFAULT '{}'
    CHECK (magasins <@ ARRAY['leclerc', 'carrefour', 'marche-frais', 'tiger-market', 'action']);

CREATE TEMP TABLE avant_colonne ON COMMIT DROP AS
SELECT count(*) AS choix FROM chow.aliments_enseignes;

UPDATE chow.aliments a
SET magasins = c.magasins
FROM (SELECT aliment_id, array_agg(enseigne_id ORDER BY enseigne_id) AS magasins FROM chow.aliments_enseignes GROUP BY aliment_id) c
WHERE c.aliment_id = a.id;

-- Contrôle : autant de choix sur les aliments que dans l'ancienne table.
DO $$
BEGIN
    IF (SELECT COALESCE(sum(cardinality(magasins)), 0) FROM chow.aliments) <> (SELECT choix FROM avant_colonne) THEN
        RAISE EXCEPTION 'Magasins des aliments : report incomplet dans la colonne';
    END IF;
END $$;

-- La vue lit encore l'ancienne table : retirée ici, recréée au démarrage depuis db/vues.sql.
DROP VIEW chow.v_magasins_habituels;
DROP TABLE chow.aliments_enseignes;
