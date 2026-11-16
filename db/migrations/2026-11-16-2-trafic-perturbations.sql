-- Perturbations Ligne P relevées par Check.Da.Train, enregistrées brutes pour les classer plus tard.
CREATE SCHEMA IF NOT EXISTS trafic;

CREATE TABLE IF NOT EXISTS trafic.perturbations (
    id SERIAL PRIMARY KEY,
    idfm_id TEXT NOT NULL UNIQUE,
    ligne TEXT NOT NULL DEFAULT 'P' CHECK (ligne IN ('P')),
    titre TEXT,
    message TEXT,
    cause TEXT,
    severite TEXT,
    arrets TEXT[] NOT NULL DEFAULT '{}',
    vue_premiere TIMESTAMPTZ NOT NULL,
    vue_derniere TIMESTAMPTZ NOT NULL,
    brut JSONB NOT NULL,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
