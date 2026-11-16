-- Prix habituels sans ticket, demandés le 2026-11-14 ; remplacés par l'estimation dès qu'un ticket arrive.
-- Actimel : pack de 8 ; café moulu : environ 8 € selon Olumide ; sauce chipotle : prix courant d'une bouteille.
UPDATE chow.aliments SET prix_habituel = 3.60 WHERE id = 'actimel' AND prix_habituel IS NULL;
UPDATE chow.aliments SET prix_habituel = 8.00 WHERE id = 'cafe-moulu' AND prix_habituel IS NULL;
UPDATE chow.aliments SET prix_habituel = 2.80 WHERE id = 'sauce-chipotle' AND prix_habituel IS NULL;
