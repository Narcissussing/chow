-- Aliments de production restés sans article (créés avant leur article) : chacun rejoint l'article de même identifiant,
-- sinon il apparaît en double comme article de la maison et ses achats ne comptent pas dans Chow (CHOW-129).
UPDATE chow.aliments a SET article_id = a.id
WHERE a.article_id IS NULL AND EXISTS (SELECT 1 FROM achats.articles ar WHERE ar.id = a.id);
