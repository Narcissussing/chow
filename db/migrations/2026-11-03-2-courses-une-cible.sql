-- Le modèle « Courses de la semaine » garde aussi les articles de la maison (il les enregistrait en ligne vide,
-- qui faisait échouer son application). Chaque ligne des Courses et du modèle vise une seule chose : un aliment,
-- un article de la maison ou un texte libre. Les lignes impossibles sont nettoyées avant d'ajouter la règle.
ALTER TABLE chow.courses_modeles ADD COLUMN IF NOT EXISTS article_id TEXT REFERENCES achats.articles (id);

DELETE FROM chow.courses_modeles WHERE food_id IS NULL AND article_id IS NULL AND COALESCE(btrim(nom_libre), '') = '';
UPDATE chow.courses_modeles SET nom_libre = NULL WHERE food_id IS NOT NULL AND nom_libre IS NOT NULL;
ALTER TABLE chow.courses_modeles ADD CONSTRAINT courses_modeles_une_cible CHECK (num_nonnulls(food_id, article_id, nom_libre) = 1);

UPDATE chow.courses SET nom_libre = NULL WHERE (food_id IS NOT NULL OR article_id IS NOT NULL) AND nom_libre IS NOT NULL;
DELETE FROM chow.courses WHERE food_id IS NULL AND article_id IS NULL AND COALESCE(btrim(nom_libre), '') = '';
ALTER TABLE chow.courses DROP CONSTRAINT IF EXISTS courses_aliment_ou_article;
ALTER TABLE chow.courses ADD CONSTRAINT courses_une_cible CHECK (num_nonnulls(food_id, article_id, nom_libre) = 1);
