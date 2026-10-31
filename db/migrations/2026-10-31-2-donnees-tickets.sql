-- Données des tickets corrigées (audit du 2026-10-31) : contenances mal lues, trois rangements faux, remises Carrefour non notées.
-- Les montants payés ne changent pas : contrôle en fin de migration.

CREATE TEMP TABLE controle_paye ON COMMIT DROP AS SELECT sum(paye) AS avant FROM achats.v_lignes;

-- 1. Contenances : virgule ou point lus comme décimale (« X2,300G » = 300 g, pas 2,3 g), numéro de pâtes (« N 5.1KG » = 1 kg).
UPDATE achats.produits p
SET contenance = v.nouvelle, unite = v.unite
FROM (VALUES
    ('leclerc', 'SPAGHETTI N 5 KG', 5, 1, 'kg'),
    ('leclerc', 'KINDER BUENO T2,215G', 0.002, 0.215, 'kg'),
    ('leclerc', 'HERTA, KNACKI CSN X10,350G', 0.01, 0.35, 'kg'),
    ('leclerc', 'F.DOREE, VIENN.BRIOCH.X4,340G', 0.004, 0.34, 'kg'),
    ('leclerc', 'DUPLO, LAIT T10 X28,182G', 0.282, 0.182, 'kg'),
    ('leclerc', 'DUO DE MACHE ET ROQUETTE 1.125G', 0.001, 0.125, 'kg'),
    ('leclerc', 'SNICKERS,BARRE GLACEEX12,547G', 0.013, 0.547, 'kg'),
    ('leclerc', 'EPI D''OR, PAINS WRAPS X6,370G', 0.006, 0.37, 'kg'),
    ('leclerc', '<M&M''S, PEANUT X5,180G', 0.005, 0.18, 'kg'),
    ('leclerc', 'N.JARDIN, P.CHICHES 1/2,265G', 0.002, 0.265, 'kg'),
    ('leclerc', 'FAIRY,LV TT1+ORIGIN.X35,473G', 0.035, 0.473, 'kg'),
    ('leclerc', 'ODP, TORTILLAS BLE NAT 8+2,407G', 0.002, 0.407, 'kg'),
    ('leclerc', 'PATES SPAGHETTI N 5.1KG', 5.1, 1, 'kg'),
    ('leclerc', 'N.JARDIN, MAIS CROQ.1/2,285G', 0.002, 0.285, 'kg'),
    ('leclerc', 'SNICKERS, BARRE X7,350G', 0.007, 0.35, 'kg'),
    ('leclerc', 'FAIRY,LV TT1+ CITR.X35,473G', 0.035, 0.473, 'kg'),
    ('leclerc', 'NETTOY.CONTACTS, 3 EN 1,250ML', 0.001, 0.25, 'l'),
    ('leclerc', '<LUSTUCRU,QUINOA FACILE X2,300G', 0.002, 0.3, 'kg'),
    ('leclerc', 'SUN,TAB.LV.DEGRAISX42,735G', 0.043, 0.735, 'kg'),
    ('leclerc', 'ESSUIE TOUT RENOVA 6+2 G', 0.002, 8, 'piece'),
    ('leclerc', '6 BAGUETTES VIENNOISES 510.510G', 0.511, 0.51, 'kg')
) AS v (enseigne_id, libelle, ancienne, nouvelle, unite)
WHERE p.enseigne_id = v.enseigne_id AND p.libelle = v.libelle AND p.contenance = v.ancienne;

-- 2. Rangements : jus d'orange rangé en orange, sauce poivron en poivron, steak végétal en soupe.
UPDATE achats.produits SET article_id = 'jus-orange' WHERE enseigne_id = 'carrefour' AND libelle = 'BRK 2L PJ ORANGE S' AND article_id = 'orange';
UPDATE achats.produits SET article_id = 'alimentation-a-detailler'
WHERE enseigne_id = 'leclerc' AND libelle IN ('SAUCE POIVRON AUBERG 190G TUR', 'STEAK VEGETAL & GOURMAND') AND article_id IN ('poivron', 'soupe-deshydratee');

-- 3. Remises immédiates Carrefour : déjà déduites du montant, jamais notées en promo. La ligne reprend son montant avant
-- remise et la remise passe dans achats.promos (même payé, mais le prix habituel n'est plus faussé par la promo).
CREATE TEMP TABLE remises_carrefour ON COMMIT DROP AS
WITH v (date, libelle, paye, remise, rang) AS (VALUES
    (DATE '2023-11-21', '50CL CF EP LEG 15%', 1.29, 0.56, 1),
    (DATE '2023-11-21', '50CL CF EP LEG 15%', 1.3, 0.55, 1),
    (DATE '2023-12-31', 'XX190G SCE PESTO A', 1.39, 0.6, 1),
    (DATE '2023-12-31', 'XX190G SCE PESTO A', 1.4, 0.59, 1),
    (DATE '2024-01-06', 'CONCOMBRE PIECE', 2.5, 0.28, 1),
    (DATE '2024-01-11', 'COLGATE FRCH 75ML', 1.99, 0.3, 1),
    (DATE '2024-01-12', '150G CHEDDAR RAPE', 2.37, 0.42, 1),
    (DATE '2024-01-12', '150G CHEDDAR RAPE', 2.37, 0.42, 2),
    (DATE '2024-05-10', '2X250ML SH DOUCEUR', 2.38, 1.22, 1),
    (DATE '2024-06-29', '150G RAPE SPECIAL', 1.82, 0.33, 1),
    (DATE '2024-06-29', '150G RAPE SPECIAL', 1.83, 0.32, 1),
    (DATE '2024-07-05', 'BIERE LEFFE RUBY', 1.77, 0.88, 1),
    (DATE '2024-07-05', 'BIERE LEFFE RUBY', 1.77, 0.88, 2),
    (DATE '2024-07-05', 'BIERE LEFFE RUBY', 1.76, 0.89, 1),
    (DATE '2024-07-19', 'BIERE LEFFE RUBY', 1.39, 0.7, 1),
    (DATE '2024-07-19', 'BIERE LEFFE RUBY', 1.39, 0.7, 2),
    (DATE '2024-07-19', 'BIERE LEFFE RUBY', 1.4, 0.69, 1),
    (DATE '2024-07-27', '25 CL RED BULL RED', 0.54, 0.55, 1),
    (DATE '2024-09-04', 'KG SPAGHETTI BARRI', 1.33, 0.66, 1),
    (DATE '2024-09-04', 'KG SPAGHETTI BARRI', 1.33, 0.66, 2),
    (DATE '2024-09-04', 'KG SPAGHETTI BARRI', 1.32, 0.67, 1),
    (DATE '2024-09-07', 'MANGUE PIECE', 6.97, 2.06, 1),
    (DATE '2024-09-07', 'MANGUE PIECE', 1.03, 0.26, 1),
    (DATE '2025-01-30', '304G NUTELLA BISCU', 2.31, 0.78, 1),
    (DATE '2025-01-30', '304G NUTELLA BISCU', 2.32, 0.77, 1),
    (DATE '2025-02-22', '500G EXTRA PEPITES', 0, 3.19, 1),
    (DATE '2025-03-18', 'MENNEN DEO YUZU BA', 2.12, 3.17, 1),
    (DATE '2025-03-18', 'CONCOMBRE PIECE', 4, 0.76, 1),
    (DATE '2025-04-10', '450G MIX SMOOTHIE', 2.96, 0.53, 1),
    (DATE '2025-04-10', '450G MIX SMOOTHIE', 2.97, 0.52, 1),
    (DATE '2025-04-20', '75 IGP OC SAUV.BL', 2.73, 0.92, 1),
    (DATE '2025-04-20', '75 IGP OC SAUV.BL', 2.74, 0.91, 1),
    (DATE '2025-05-17', '250G GRIGNOTTE PLE', 2.07, 0.52, 1),
    (DATE '2025-05-17', '250G GRIGNOTTE PLE', 2.07, 0.52, 2),
    (DATE '2025-05-17', 'MANGUE PIECE', 7, 0.96, 1),
    (DATE '2025-07-01', 'SNICKERS GLACE X6', 2.95, 0.8, 1),
    (DATE '2025-07-01', '260G MAGNUM CONE M', 3.67, 1.22, 1),
    (DATE '2025-08-09', 'DORITOS X CHEESE 2', 2.32, 0.77, 1),
    (DATE '2025-09-06', '150G RAPE SPECIAL', 1.86, 0.29, 1),
    (DATE '2025-09-06', '150G RAPE SPECIAL', 1.86, 0.29, 2),
    (DATE '2025-09-06', '150G RAPE SPECIAL', 1.87, 0.28, 1),
    (DATE '2025-09-16', '550G PDM GT CPLT S', 1.07, 0.12, 1),
    (DATE '2025-09-16', '550G PDM GT CPLT S', 1.07, 0.12, 2),
    (DATE '2025-10-01', 'COL DENT TOTAL PRE', 4.74, 3.16, 1),
    (DATE '2026-01-08', 'KAKI PIECE', 1.5, 0.28, 1),
    (DATE '2026-01-13', 'CHIPS CRUNCHY FAJI', 1.71, 0.74, 1),
    (DATE '2026-01-13', 'CHIPS CRUNCHY FAJI', 1.72, 0.73, 1),
    (DATE '2026-01-21', '250G AERO VANI 29%', 2.09, 0.9, 1),
    (DATE '2026-01-21', '250G AERO VANI 29%', 2.1, 0.89, 1),
    (DATE '2026-03-10', 'CONCOMBRE MOYEN PC', 0.94, 0.25, 1),
    (DATE '2026-03-10', 'CONCOMBRE MOYEN PC', 1.06, 0.13, 1),
    (DATE '2026-03-10', 'AVOCAT GROS PIECE', 1.44, 0.25, 1),
    (DATE '2026-03-10', 'AVOCAT GROS PIECE', 1.56, 0.13, 1),
    (DATE '2026-03-13', '175G SABLE NORMAND', 3.02, 0.76, 1),
    (DATE '2026-03-13', '225G CHORIZO FORT', 3.69, 0.29, 1),
    (DATE '2026-04-14', 'BENS ORIGINAL RIZ', 2.23, 1.12, 1),
    (DATE '2026-04-14', 'BENS ORIGINAL RIZ', 2.23, 1.12, 2),
    (DATE '2026-04-14', 'BENS ORIGINAL RIZ', 2.24, 1.11, 1),
    (DATE '2026-05-05', '850ML COCA COLA OR', 1.34, 0.15, 1),
    (DATE '2026-06-25', 'MENNEN DEO YUZU BA', 16.17, 6.93, 1),
    (DATE '2026-07-23', '1/4 THON LISTAO NA', 1.48, 0.27, 1),
    (DATE '2026-07-23', '1/4 THON LISTAO NA', 1.49, 0.26, 1),
    (DATE '2026-07-23', 'MORCEAUX TH.NAT.D.', 4.19, 1.8, 1),
    (DATE '2026-07-23', 'MORCEAUX TH.NAT.D.', 4.2, 1.79, 1),
    (DATE '2026-09-21', 'ULTRAFR CRISTAUX B', 4.48, 2.99, 1)
),
l AS (
    SELECT l.id, l.ticket_id, t.date, p.libelle, l.montant,
           row_number() OVER (PARTITION BY t.date, p.libelle, l.montant ORDER BY l.id) AS rang
    FROM achats.lignes l
    JOIN achats.tickets t ON t.id = l.ticket_id
    JOIN achats.produits p ON p.id = l.produit_id
    WHERE p.enseigne_id = 'carrefour' AND NOT EXISTS (SELECT 1 FROM achats.promos pr WHERE pr.ligne_id = l.id)
)
SELECT l.id AS ligne_id, l.ticket_id, v.remise
FROM v JOIN l ON l.date = v.date AND l.libelle = v.libelle AND l.montant = v.paye AND l.rang = v.rang;

INSERT INTO achats.promos (ligne_id, offre, type, pourcentage, montant)
SELECT ligne_id, 'Remise immédiate', 'remise immédiate', NULL, remise FROM remises_carrefour;
UPDATE achats.lignes l SET montant = l.montant + r.remise FROM remises_carrefour r WHERE r.ligne_id = l.id;
UPDATE achats.tickets t SET total_articles = t.total_articles + s.remise
FROM (SELECT ticket_id, sum(remise) AS remise FROM remises_carrefour GROUP BY ticket_id) s
WHERE s.ticket_id = t.id AND t.total_articles IS NOT NULL;

DO $$
DECLARE n INTEGER; ecart NUMERIC;
BEGIN
    SELECT count(*) INTO n FROM remises_carrefour;
    IF n <> 65 THEN RAISE EXCEPTION 'Remises Carrefour rattachées : % au lieu de 65', n; END IF;
    SELECT abs((SELECT avant FROM controle_paye) - (SELECT sum(paye) FROM achats.v_lignes)) INTO ecart;
    IF ecart > 0.001 THEN RAISE EXCEPTION 'Le total payé a changé de % €', ecart; END IF;
END $$;
