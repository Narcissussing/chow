-- Vues de calcul et description de la base, relancées à chaque démarrage (idempotent).
-- Les tables gardent les faits ; ces vues font les calculs (prix au kg, remises, panier habituel).

CREATE OR REPLACE VIEW achats.v_lignes AS
SELECT l.id AS ligne_id,
       t.id AS ticket_id,
       t.code AS ticket,
       t.date,
       m.id AS magasin_id,
       m.nom AS magasin,
       e.id AS enseigne_id,
       e.nom AS enseigne,
       l.rayon,
       p.id AS produit_id,
       p.libelle,
       a.id AS article_id,
       a.nom AS article,
       COALESCE(a.fourre_tout, false) AS fourre_tout,
       c.id AS categorie_id,
       c.nom AS categorie,
       COALESCE(c.parent_id, c.id) AS categorie_racine_id,
       al.id AS aliment_id,
       l.quantite,
       l.unite_vente,
       p.contenance,
       p.unite AS unite_contenance,
       l.prix_unitaire,
       l.montant,
       COALESCE(pr.remise, 0)::numeric(10, 2) AS remise,
       (l.montant - COALESCE(pr.remise, 0))::numeric(10, 2) AS paye,
       COALESCE(pr.remise, 0) > 0 AS en_promo,
       q.quantite_ref,
       q.unite_ref,
       q.unite_ref IS NOT DISTINCT FROM a.unite_ref AS comparable,
       round(l.montant / NULLIF(q.quantite_ref, 0), 2) AS prix_ref_normal,
       round((l.montant - COALESCE(pr.remise, 0)) / NULLIF(q.quantite_ref, 0), 2) AS prix_ref_paye
FROM achats.lignes l
JOIN achats.tickets t ON t.id = l.ticket_id
JOIN achats.magasins m ON m.id = t.magasin_id
JOIN achats.enseignes e ON e.id = m.enseigne_id
JOIN achats.produits p ON p.id = l.produit_id
LEFT JOIN achats.articles a ON a.id = p.article_id
LEFT JOIN achats.categories c ON c.id = a.categorie_id
LEFT JOIN chow.aliments al ON al.article_id = a.id
LEFT JOIN (SELECT ligne_id, sum(montant) AS remise FROM achats.promos GROUP BY ligne_id) pr ON pr.ligne_id = l.id
CROSS JOIN LATERAL (
    SELECT CASE WHEN l.unite_vente = 'kg' THEN l.quantite WHEN p.contenance IS NOT NULL THEN l.quantite * p.contenance END AS quantite_ref,
           CASE WHEN l.unite_vente = 'kg' THEN 'kg' ELSE p.unite END AS unite_ref
) q;

CREATE OR REPLACE VIEW achats.v_prix AS
SELECT article_id,
       article,
       enseigne_id,
       to_char(date, 'YYYY-MM') AS mois,
       unite_ref,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY prix_ref_normal)::numeric, 2) AS prix_median,
       count(*) AS achats
FROM achats.v_lignes
WHERE comparable AND NOT fourre_tout AND prix_ref_normal IS NOT NULL
GROUP BY article_id, article, enseigne_id, to_char(date, 'YYYY-MM'), unite_ref;

CREATE OR REPLACE VIEW achats.v_panier_habituel AS
SELECT article_id,
       article,
       unite_ref,
       count(DISTINCT to_char(date, 'YYYY-MM')) AS mois_achetes,
       round(sum(quantite_ref) / 12, 3) AS quantite_par_mois,
       round(sum(paye) / 12, 2) AS depense_par_mois
FROM achats.v_lignes
WHERE date >= current_date - INTERVAL '12 months' AND comparable AND NOT fourre_tout
GROUP BY article_id, article, unite_ref
HAVING count(DISTINCT to_char(date, 'YYYY-MM')) >= 6;

-- Lignes au format lu par les pages Stats et Courses (stats.js), passages bancaires compris.
CREATE OR REPLACE VIEW chow.v_lignes_stats AS
SELECT to_char(v.date, 'YYYY-MM-DD') AS jour,
       v.date,
       v.ticket_id,
       v.enseigne,
       v.libelle,
       v.paye AS total,
       CASE WHEN v.unite_vente = 'piece' THEN v.quantite END AS quantite,
       CASE WHEN v.unite_vente = 'kg' THEN v.quantite END AS poids,
       CASE WHEN v.unite_ref IN ('kg', 'l') THEN v.quantite_ref / CASE WHEN v.unite_vente = 'kg' THEN 1 ELSE v.quantite END END AS contenance,
       CASE WHEN v.unite_ref IN ('kg', 'l') THEN v.quantite_ref END AS quantite_ref,
       CASE WHEN v.unite_ref IN ('kg', 'l') THEN v.prix_ref_paye END AS prix_ref,
       CASE WHEN v.unite_ref IN ('kg', 'l') THEN v.unite_ref END AS unite,
       v.remise,
       CASE WHEN v.article_id IS NULL THEN 'a-classer'
            WHEN v.aliment_id IS NOT NULL THEN 'chow'
            WHEN v.categorie_racine_id IN ('alimentation', 'boissons') THEN 'hors-chow'
            ELSE 'non-alimentaire' END AS statut,
       v.aliment_id AS food_id
FROM achats.v_lignes v
UNION ALL
SELECT to_char(t.date, 'YYYY-MM-DD'), t.date, t.id, e.nom, 'PASSAGE NON DÉTAILLÉ (relevé bancaire)', t.paye,
       1, NULL, NULL, NULL, NULL, NULL, 0, 'non-detaille', NULL
FROM achats.tickets t
JOIN achats.magasins m ON m.id = t.magasin_id
JOIN achats.enseignes e ON e.id = m.enseigne_id
WHERE t.source = 'releve-bancaire';

-- Description : l'export en tire le dictionnaire des données (README.md).
COMMENT ON SCHEMA famille IS 'Les personnes du foyer et leurs comptes.';
COMMENT ON SCHEMA achats IS 'Tout ce que le foyer achète, alimentaire ou non : tickets, lignes, produits, articles.';
COMMENT ON SCHEMA chow IS 'L''alimentation à la maison : aliments, stock, courses, recettes, journal.';
COMMENT ON SCHEMA reference IS 'Données extérieures (indices INSEE).';
COMMENT ON SCHEMA app IS 'Technique de l''application, aucune donnée de famille.';
COMMENT ON SCHEMA ancien IS 'Anciennes tables d''achats, gardées jusqu''à la vérification de novembre 2026.';

COMMENT ON TABLE famille.personnes IS 'Une personne du foyer, parent ou enfant.';
COMMENT ON COLUMN famille.personnes.id IS 'Identifiant lisible (prénom en minuscules).';
COMMENT ON COLUMN famille.personnes.role IS 'parent ou enfant.';
COMMENT ON COLUMN famille.personnes.sexe IS 'F ou M.';
COMMENT ON TABLE famille.comptes IS 'Connexion à l''application, reliée à une personne.';
COMMENT ON COLUMN famille.comptes.mot_de_passe IS 'Empreinte bcrypt, jamais le mot de passe.';
COMMENT ON COLUMN famille.comptes.admin IS 'Accès aux Paramètres.';

COMMENT ON TABLE achats.enseignes IS 'Chaîne de magasins (Leclerc, Carrefour, Marché Frais).';
COMMENT ON TABLE achats.magasins IS 'Un magasin précis d''une enseigne.';
COMMENT ON TABLE achats.categories IS 'Arbre des catégories du foyer : premier niveau sans parent, sous-catégories avec parent_id.';
COMMENT ON COLUMN achats.categories.ordre IS 'Ordre d''affichage parmi les catégories de même parent.';
COMMENT ON TABLE achats.articles IS 'Ce qu''on écrit sur une liste de courses (tomate, papier toilette). Une marque ou un format différent reste le même article.';
COMMENT ON COLUMN achats.articles.unite_ref IS 'Unité de comparaison des prix : kg, l ou piece.';
COMMENT ON COLUMN achats.articles.fourre_tout IS 'Article d''attente pour des produits pas encore détaillés ; exclu des prix et du panier habituel.';
COMMENT ON TABLE achats.produits IS 'Un article tel que vendu dans une enseigne, avec le libellé imprimé sur le ticket et le format du paquet.';
COMMENT ON COLUMN achats.produits.libelle IS 'Texte imprimé sur le ticket, tel quel.';
COMMENT ON COLUMN achats.produits.article_id IS 'Article correspondant ; vide = à classer.';
COMMENT ON COLUMN achats.produits.contenance IS 'Contenu d''une unité vendue (0,85 pour 850 g) ; vide pour un produit vendu au poids.';
COMMENT ON COLUMN achats.produits.unite IS 'Unité de la contenance : kg, l ou piece.';
COMMENT ON TABLE achats.tickets IS 'Un passage en caisse ou une commande.';
COMMENT ON COLUMN achats.tickets.code IS 'Identifiant lisible : date, heure si connue, magasin.';
COMMENT ON COLUMN achats.tickets.numero IS 'Numéro imprimé par le magasin, si connu.';
COMMENT ON COLUMN achats.tickets.source IS 'ticket-papier, ticket-numerique, releve-bancaire (montant seul, sans lignes) ou saisie.';
COMMENT ON COLUMN achats.tickets.total_articles IS 'Somme des lignes avant remises, en euros.';
COMMENT ON COLUMN achats.tickets.bons IS 'Bons de réduction non rattachés à un produit, en euros.';
COMMENT ON COLUMN achats.tickets.paye IS 'Montant réellement payé, en euros.';
COMMENT ON COLUMN achats.tickets.cagnotte IS 'Fidélité gagnée sur ce passage, en euros.';
COMMENT ON TABLE achats.lignes IS 'Une ligne de ticket : un produit, sa quantité, son prix avant remise.';
COMMENT ON COLUMN achats.lignes.rayon IS 'Rayon imprimé sur le ticket.';
COMMENT ON COLUMN achats.lignes.quantite IS 'Nombre de pièces, ou poids en kg si unite_vente = kg.';
COMMENT ON COLUMN achats.lignes.unite_vente IS 'piece ou kg : comment le produit est vendu.';
COMMENT ON COLUMN achats.lignes.prix_unitaire IS 'Prix imprimé par pièce ou par kg, en euros.';
COMMENT ON COLUMN achats.lignes.montant IS 'Montant de la ligne avant remise, en euros.';
COMMENT ON TABLE achats.promos IS 'Une remise rattachée à sa ligne de ticket.';
COMMENT ON COLUMN achats.promos.offre IS 'Texte de l''offre tel qu''imprimé.';
COMMENT ON COLUMN achats.promos.type IS 'remise immédiate, 2e à prix réduit ou 2+1.';
COMMENT ON COLUMN achats.promos.montant IS 'Montant déduit, en euros.';
COMMENT ON VIEW achats.v_lignes IS 'Chaque ligne avec son contexte, la remise, le payé et les prix comparables (prix_ref en euros par unite_ref).';
COMMENT ON VIEW achats.v_prix IS 'Prix médian hors promo par article, enseigne et mois : série de base de la prévision.';
COMMENT ON VIEW chow.v_lignes_stats IS 'Achats au format lu par les pages Stats et Courses ; statut : chow, hors-chow, non-alimentaire, non-detaille ou a-classer.';
COMMENT ON VIEW achats.v_panier_habituel IS 'Articles achetés au moins 6 mois sur les 12 derniers, avec quantité et dépense moyennes par mois.';

COMMENT ON TABLE chow.aliments IS 'Aliment suivi par Chow (valeurs nutritionnelles pour 100 g ou 100 ml), relié à son article d''achat.';
COMMENT ON COLUMN chow.aliments.article_id IS 'Article d''achat correspondant.';
COMMENT ON TABLE chow.stock IS 'Ce qu''il reste à la maison, un aliment par ligne.';
COMMENT ON TABLE chow.courses IS 'Liste de courses alimentaire (aliment ou texte libre).';
COMMENT ON TABLE chow.courses_modeles IS 'Articles ajoutés d''un coup aux Courses chaque semaine.';
COMMENT ON TABLE chow.journal IS 'Ce qui a été mangé, par jour.';
COMMENT ON COLUMN chow.journal.personne_id IS 'Qui a mangé ; vide pour les entrées d''avant octobre 2026.';
COMMENT ON TABLE chow.recettes IS 'Recettes du foyer ; etapes : une étape par ligne.';
COMMENT ON TABLE chow.recette_ingredients IS 'Ingrédients d''une recette, dans l''ordre.';

COMMENT ON TABLE reference.indices_prix IS 'Indices mensuels des prix à la consommation, par série.';
COMMENT ON COLUMN reference.indices_prix.mois IS 'AAAA-MM.';

COMMENT ON TABLE app.sessions IS 'Sessions de connexion.';
COMMENT ON TABLE app.ip_bloquees IS 'Adresses IP bloquées après trop d''échecs de connexion.';
