-- Magasins des aliments remplis d'après l'historique d'achat : enseignes des tickets dans les magasins fréquentés
-- aujourd'hui (Meaux, Trilport ; pas Clermont-Ferrand, Paris ni Bordeaux) et des articles cochés en mode magasin.
-- Les aliments déjà réglés à la main gardent leur choix ; ceux jamais achetés ici restent vides (devinés).
UPDATE chow.aliments a
SET magasins = h.magasins
FROM (
    SELECT id, array_agg(DISTINCT enseigne_id ORDER BY enseigne_id) AS magasins
    FROM (
        SELECT al.id, v.enseigne_id
        FROM achats.v_lignes v
        JOIN chow.aliments al ON al.article_id = v.article_id
        JOIN achats.magasins m ON m.id = v.magasin_id
        WHERE m.ville IN ('Meaux', 'Trilport')
        UNION
        SELECT c.food_id, e.id
        FROM chow.courses c JOIN achats.enseignes e ON e.nom = c.enseigne
        WHERE c.food_id IS NOT NULL AND c.achete
    ) achats_ici
    GROUP BY id
) h
WHERE h.id = a.id AND cardinality(a.magasins) = 0;

-- Choix d'Olumide (2026-11-19), prioritaires sur l'historique.
UPDATE chow.aliments SET magasins = '{leclerc}' WHERE id IN ('yaourt', 'yaourt-grec', 'yaourt-a-boire', 'yaourt-soja', 'surimi');
UPDATE chow.aliments SET magasins = '{leclerc,marche-frais}' WHERE id = 'wrap';
UPDATE chow.aliments SET magasins = '{leclerc,marche-frais,tiger-market}' WHERE id = 'mangue';

-- Contrôle : les choix demandés sont bien posés.
DO $$
BEGIN
    IF (SELECT count(*) FROM chow.aliments WHERE id IN ('yaourt', 'yaourt-grec', 'yaourt-a-boire', 'yaourt-soja', 'surimi') AND magasins = '{leclerc}') <> 5
       OR NOT EXISTS (SELECT 1 FROM chow.aliments WHERE id = 'wrap' AND magasins = '{leclerc,marche-frais}') THEN
        RAISE EXCEPTION 'Magasins des aliments : choix demandés non appliqués';
    END IF;
END $$;
