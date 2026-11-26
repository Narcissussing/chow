-- Lait concentré : valeurs pour 100 g de l'étiquette Régilait (entier non sucré, briquette de 200 g), fournie le 2026-11-20.
UPDATE chow.aliments SET calories = 133, lipides = 7.5, graisses_saturees = 5, glucides = 9.7, sucres = 9.7, fibres = 0,
    proteines = 6.7, sel = 0.2, origine = 'Union européenne',
    description = 'Lait concentré entier non sucré (Régilait), briquette de 200 g ; 3 jours au frigo après ouverture.'
WHERE id = 'lait-concentre';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM chow.aliments WHERE id = 'lait-concentre' AND calories = 133)
        THEN RAISE EXCEPTION 'Lait concentré non corrigé'; END IF;
END $$;
