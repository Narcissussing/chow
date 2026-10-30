-- Tournées de courses : du choix du magasin jusqu'à « Terminer », sur un ou plusieurs magasins et jours.
-- Chaque article coché garde la quantité prise et l'enseigne, pour remplir le panier de la tournée.
CREATE TABLE chow.tournees (
    id SERIAL PRIMARY KEY,
    debut TIMESTAMPTZ NOT NULL DEFAULT now(),
    fin TIMESTAMPTZ,
    CHECK (fin IS NULL OR fin >= debut)
);
CREATE UNIQUE INDEX tournees_une_seule_ouverte ON chow.tournees ((true)) WHERE fin IS NULL;

ALTER TABLE chow.courses ADD COLUMN quantite_achetee NUMERIC CHECK (quantite_achetee > 0);
ALTER TABLE chow.courses ADD COLUMN enseigne TEXT CHECK (enseigne IN ('Leclerc', 'Carrefour', 'Marché Frais'));
