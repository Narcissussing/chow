-- Magasins d'un aliment en texte simple, tel qu'on le tape dans la vue table de Neon : « leclerc,marche-frais »,
-- vide = devinés. Les accolades d'une liste Postgres n'étaient pas évidentes à taper.
CREATE TEMP TABLE avant_texte ON COMMIT DROP AS
SELECT COALESCE(sum(cardinality(magasins)), 0) AS choix FROM chow.aliments;

-- La vue lit la colonne : retirée ici, recréée au démarrage depuis db/vues.sql.
DROP VIEW chow.v_magasins_habituels;

ALTER TABLE chow.aliments DROP CONSTRAINT aliments_magasins_check;
ALTER TABLE chow.aliments ALTER COLUMN magasins DROP DEFAULT;
ALTER TABLE chow.aliments ALTER COLUMN magasins TYPE TEXT USING array_to_string(magasins, ',');
ALTER TABLE chow.aliments ALTER COLUMN magasins SET DEFAULT '';
-- Seulement des magasins connus, séparés par des virgules (espaces tolérés) ; vide permis.
ALTER TABLE chow.aliments ADD CONSTRAINT aliments_magasins_check
    CHECK (magasins ~ '^\s*((leclerc|carrefour|marche-frais|tiger-market|action)\s*(,\s*(leclerc|carrefour|marche-frais|tiger-market|action)\s*)*)?$');

DO $$
BEGIN
    IF (SELECT count(*) FROM chow.aliments a, regexp_split_to_table(NULLIF(a.magasins, ''), '\s*,\s*') m) <> (SELECT choix FROM avant_texte) THEN
        RAISE EXCEPTION 'Magasins des aliments : conversion en texte incomplète';
    END IF;
END $$;
