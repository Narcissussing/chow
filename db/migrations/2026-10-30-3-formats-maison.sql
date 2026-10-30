-- Formats des produits non alimentaires : nombre d'unités par paquet lu sur le libellé, et unité de comparaison
-- de chaque article prise sur la majorité de ses produits.

-- Nombre d'unités d'un paquet : « 2X6P » → 12, « X35 » → 35, « 14P » → 14, « 12 RLX », « 8 PILES » ; sinon 1.
CREATE OR REPLACE FUNCTION achats.nombre_par_paquet(libelle TEXT) RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(
        (SELECT (m[1]::numeric * m[2]::numeric) FROM regexp_match(libelle, '(\d+)\s*X\s*(\d+)\s*P\M') m),
        (SELECT m[1]::numeric FROM regexp_match(libelle, 'X\s*(\d+)') m),
        (SELECT m[1]::numeric FROM regexp_match(libelle, '(\d+)\s*(RLX|SACS|PILES|ROULEAUX|BOITES|PCS)\M') m),
        (SELECT m[1]::numeric FROM regexp_match(libelle, '(\d+)\s*P\M') m),
        1)
$$;
COMMENT ON FUNCTION achats.nombre_par_paquet(TEXT) IS 'Nombre d''unités d''un paquet lu sur le libellé (2X6P, X35, 14P, 12 RLX, 8 PILES), 1 par défaut.';

-- Produits non alimentaires vendus à la pièce sans format lu : nombre d'unités du paquet.
UPDATE achats.produits p
SET contenance = achats.nombre_par_paquet(p.libelle)
FROM achats.articles a JOIN achats.categories c ON c.id = a.categorie_id
WHERE a.id = p.article_id AND COALESCE(c.parent_id, c.id) NOT IN ('alimentation', 'boissons')
  AND p.unite = 'piece' AND p.contenance = 1;

-- Unité de comparaison des articles non alimentaires : celle de la majorité de leurs produits.
UPDATE achats.articles a
SET unite_ref = s.unite
FROM (SELECT p.article_id, mode() WITHIN GROUP (ORDER BY p.unite) AS unite
      FROM achats.produits p WHERE p.unite IS NOT NULL GROUP BY p.article_id) s,
     achats.categories c
WHERE s.article_id = a.id AND c.id = a.categorie_id AND COALESCE(c.parent_id, c.id) NOT IN ('alimentation', 'boissons');
