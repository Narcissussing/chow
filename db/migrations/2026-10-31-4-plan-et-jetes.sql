-- Mon plan (Stats → Tickets) : ce que le foyer décide pour un article, et aliments jetés par mois (Paramètres).

-- Un choix par article : garder, en acheter moins (quantité visée par mois), arrêter, ou changer pour le moins cher.
CREATE TABLE achats.choix (
    article_id TEXT PRIMARY KEY REFERENCES achats.articles (id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('garder', 'moins', 'arreter', 'changer')),
    quantite_visee NUMERIC CHECK (quantite_visee >= 0),
    preference TEXT,
    modifie_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (decision = 'moins' OR quantite_visee IS NULL)
);

-- Gros œufs à Marché Frais : choix du foyer, même prix à l'œuf que la boîte de 20 (dit par Olumide le 2026-10-31).
INSERT INTO achats.choix (article_id, decision, preference) VALUES ('oeuf-moyen', 'garder', 'Gros œufs, Marché Frais');

-- Aliments jetés : quantité d'un article jetée dans un mois (le 1er du mois).
CREATE TABLE chow.jetes (
    article_id TEXT NOT NULL REFERENCES achats.articles (id) ON DELETE CASCADE,
    mois DATE NOT NULL CHECK (extract(day FROM mois) = 1),
    quantite NUMERIC NOT NULL CHECK (quantite > 0),
    unite TEXT NOT NULL CHECK (unite IN ('kg', 'piece')),
    modifie_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (article_id, mois)
);
