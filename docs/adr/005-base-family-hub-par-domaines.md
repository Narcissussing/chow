# ADR 005 — Base Family Hub en schémas par domaine

- **Statut** : Accepté
- **Date** : 2026-10-30

## Contexte

Chow devient le hub de la famille : achats de tout le foyer, alimentation,
puis santé (grossesse, croissance, vaccins) et suivi des bébés. Les données
doivent rester exploitables des années, lisibles sans l'application, et
permettre de prévoir l'évolution des prix des achats habituels. Toutes les
tables vivaient dans `public`, avec un modèle d'achats centré sur les
aliments (`libelles` → `foods`).

## Décision

- Une seule base Neon (projet `family-hub`), un schéma Postgres par domaine :
  `famille`, `achats`, `chow`, `reference`, `app` ; `sante` et `bebe` viendront
  avec leurs fonctions.
- Achats en chaîne : ligne de ticket → produit (libellé et format dans une
  enseigne) → article (besoin générique) → catégorie. Chow relie ses aliments
  aux articles.
- Tables de faits, vues de calcul, `COMMENT` sur tout.
- Export CSV régulier et `pg_dump` dans `family-hub-data`, copie locale et
  dépôt GitHub privé.
- Règles détaillées dans `docs/architecture-donnees.md`.

## Conséquences

- Positives : une personne, un achat ou un aliment se relie à tout le reste ;
  prix comparables par article ; la base se comprend seule ; elle survit à
  l'application.
- Négatives : chaque requête nomme son schéma ; la colonne `food_id` reste en
  anglais tant que l'API et le frontend ne sont pas renommés ensemble ; les
  anciennes tables d'achats restent dans `ancien` jusqu'à leur suppression
  après la vérification de novembre 2026.
