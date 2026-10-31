-- Boîte de gros œufs Marché Frais : le ticket coupe le nombre après « X », c'est une boîte de 12 (dit par Olumide le 2026-10-31).
UPDATE achats.produits
SET contenance = 12
WHERE enseigne_id = 'marche-frais' AND libelle = 'OEUFS.GROS.DJP.SOL X' AND unite = 'piece' AND contenance = 1;
