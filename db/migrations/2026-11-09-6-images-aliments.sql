-- Photos des aliments qui n'en avaient pas (Wikimedia Commons, recadrées en 450 × 450).
UPDATE chow.aliments SET image = 'images/foods/kaki.webp' WHERE id = 'kaki' AND image IS NULL;
