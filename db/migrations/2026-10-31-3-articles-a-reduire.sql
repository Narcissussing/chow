-- Niveaux d'économie des Tickets (Stats) : 1 = superflu à arrêter, 2 = dessert qu'on peut enlever. Le niveau 3
-- (même article moins cher) se calcule à partir des prix, il n'est pas stocké.
ALTER TABLE achats.articles ADD COLUMN a_reduire SMALLINT CHECK (a_reduire IN (1, 2));

UPDATE achats.articles SET a_reduire = 1 WHERE id IN ('chips', 'chocolat', 'limonade-zero');
UPDATE achats.articles SET a_reduire = 2
WHERE id IN ('pot-creme-vanille', 'pot-creme-chocolat', 'nappage-caramel', 'creme-fouettee', 'chocolat-patissier', 'chocolat-pepites');
