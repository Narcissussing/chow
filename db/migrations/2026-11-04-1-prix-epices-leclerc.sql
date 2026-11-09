-- Épices et herbes séchées : le prix attendu vient de Leclerc, les achats dépannage de Marché Frais n'y comptent pas.
ALTER TABLE achats.articles ADD COLUMN enseigne_prix_id TEXT REFERENCES achats.enseignes(id);

-- Le gingembre est la racine fraîche ; le persil, séché, est rangé dans les légumes.
UPDATE achats.articles SET enseigne_prix_id = 'leclerc'
WHERE (categorie_id = 'alimentation-epices' AND id <> 'gingembre') OR id = 'persil';
