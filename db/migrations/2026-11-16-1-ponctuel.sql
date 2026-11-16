-- Articles ponctuels (CHOW-136) : achat pour une recette ou un événement, hors habitudes du foyer.
ALTER TABLE chow.courses ADD COLUMN IF NOT EXISTS ponctuel BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chow.stock ADD COLUMN IF NOT EXISTS ponctuel BOOLEAN NOT NULL DEFAULT false;
