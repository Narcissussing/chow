-- Produits différents rangés sous un même article (comme les pains à burger dans le bœuf) : chacun à sa place.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES
    ('margarine', 'Margarine', 'alimentation-matieres-grasses', 'kg'),
    ('knacki-classique', 'Knacki (classique)', 'alimentation-viandes', 'kg'),
    ('frites-patate-douce', 'Frites de patate douce', 'alimentation-feculents', 'kg'),
    ('yaourt-aromatise', 'Yaourt aromatisé', 'alimentation-cremerie', 'kg'),
    ('creme-liquide', 'Crème liquide', 'alimentation-cremerie', 'l')
ON CONFLICT (id) DO NOTHING;

UPDATE achats.produits SET article_id = 'huile-olive' WHERE article_id = 'huile' AND libelle ~* 'VIERGE';
UPDATE achats.produits SET article_id = 'margarine' WHERE article_id = 'beurre' AND libelle ~* 'MARG|PRIMEVERE';
UPDATE achats.produits SET article_id = 'alimentation-a-detailler' WHERE article_id = 'knacki-poulet' AND libelle ~* 'VEGGIE';
UPDATE achats.produits SET article_id = 'knacki-classique' WHERE article_id = 'knacki-poulet' AND libelle !~* 'POUL|PLT';
UPDATE achats.produits SET article_id = 'frites-patate-douce' WHERE article_id = 'frites' AND libelle ~* 'PATATE';
UPDATE achats.produits SET article_id = 'yaourt-grec' WHERE article_id = 'yaourt' AND libelle ~* 'GRE';
UPDATE achats.produits SET article_id = 'yaourt-aromatise' WHERE article_id = 'yaourt' AND libelle ~* 'CIT|VAN';
UPDATE achats.produits SET article_id = 'creme-liquide' WHERE article_id = 'creme-fraiche' AND libelle ~* 'UHT|FLUID|FLEURETTE|3X20CL|2X25CL';
UPDATE achats.produits SET article_id = 'chocolat' WHERE article_id = 'bonbons' AND libelle ~* 'DAIM';
UPDATE achats.produits SET article_id = 'saucisson' WHERE article_id = 'saucisses' AND libelle ~* 'SAUC\.DINDE';
UPDATE achats.produits SET article_id = 'roquette' WHERE article_id = 'laitue' AND libelle ~* 'JEUNES POUSSES';
