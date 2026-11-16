-- Trains supprimés pendant un épisode de retard à Trilport.
ALTER TABLE trafic.retards ADD COLUMN IF NOT EXISTS trains_supprimes INTEGER NOT NULL DEFAULT 0;
