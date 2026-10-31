-- Bonbons : article à part (28 produits rangés jusque-là dans « Alimentation (à détailler) »), niveau 1 « À arrêter ».
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref, a_reduire) VALUES ('bonbons', 'Bonbons', 'alimentation-divers', 'kg', 1);

UPDATE achats.produits SET article_id = 'bonbons'
WHERE article_id = 'alimentation-a-detailler'
  AND libelle ~* 'BONBON|HARIBO|MAOAM|CARAMBAR|KREMA|LUTTI|ARLEQUIN|DAIM';

DO $$
DECLARE n INTEGER;
BEGIN
    SELECT count(*) INTO n FROM achats.produits WHERE article_id = 'bonbons';
    IF n < 25 THEN RAISE EXCEPTION 'Bonbons : % produits rangés, au moins 25 attendus', n; END IF;
END $$;
