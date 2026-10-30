-- Serviettes hygiéniques : un seul article (jour et nuit se remplacent) ; tampons ajoutés, jamais vus sur un ticket.
-- Deux articles seulement dans le type Protections : ils passent directement dans Hygiène.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref, suivi, fourre_tout, achat_en_promo) VALUES
    ('serviettes-hygieniques', 'Serviettes hygiéniques', 'hygiene', 'piece', 'nombre', false, true),
    ('tampons', 'Tampons', 'hygiene', 'piece', 'nombre', false, false);
UPDATE achats.produits SET article_id = 'serviettes-hygieniques' WHERE article_id IN ('serviettes-jour', 'serviettes-nuit');
UPDATE chow.courses SET article_id = 'serviettes-hygieniques' WHERE article_id IN ('serviettes-jour', 'serviettes-nuit');
UPDATE maison.inventaire SET article_id = 'serviettes-hygieniques' WHERE article_id IN ('serviettes-jour', 'serviettes-nuit');
DELETE FROM achats.articles WHERE id IN ('serviettes-jour', 'serviettes-nuit');
DELETE FROM achats.categories WHERE id = 'hygiene-protections';
