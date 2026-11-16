-- Épisodes de retard des trains à Trilport et estimations de retour à la normale annoncées par IDFM.
CREATE TABLE IF NOT EXISTS trafic.annonces (
    id SERIAL PRIMARY KEY,
    idfm_id TEXT NOT NULL,
    vue_le TIMESTAMPTZ NOT NULL,
    fin_annoncee TIMESTAMPTZ NOT NULL,
    titre TEXT,
    message TEXT NOT NULL DEFAULT '',
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS annonces_unicite ON trafic.annonces (idfm_id, fin_annoncee, md5(message));

CREATE TABLE IF NOT EXISTS trafic.retards (
    id SERIAL PRIMARY KEY,
    arret TEXT NOT NULL DEFAULT 'trilport' CHECK (arret IN ('trilport')),
    debut TIMESTAMPTZ NOT NULL,
    fin TIMESTAMPTZ,
    retard_max_min INTEGER NOT NULL,
    trains_retardes INTEGER NOT NULL,
    perturbations TEXT[] NOT NULL DEFAULT '{}',
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (arret, debut)
);
