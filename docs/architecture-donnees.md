# Architecture des données

Règles et méthode pour toute modification de la base Family Hub. À lire avant
de créer ou changer une table, une colonne, une vue, un import ou un export.
Ce qui existe aujourd'hui est décrit dans [Modèle de données](data-model.md) ;
le pourquoi dans l'[ADR 005](adr/005-base-family-hub-par-domaines.md).

## Objectifs qui guident chaque choix

- Une base pour toute la famille, gardée des années : achats, Chow, santé,
  bébés.
- Tout achat enregistré, alimentaire ou non.
- Prévoir les prix à partir des achats habituels (séries propres et longues).
- Lisible par une personne sans l'application.

## Règles

1. **Un schéma par domaine** : `famille` (personnes, comptes), `achats`, `chow`,
   `reference` (données extérieures), `app` (technique), plus tard `sante` et
   `bebe`. Une table appartient au domaine qui possède le fait.
2. **Toujours nommer le schéma** dans le SQL du code : `chow.aliments`,
   `achats.tickets`. Jamais de `search_path`.
3. **Les tables gardent des faits, les vues font les calculs.** Prix au kg,
   payé, remise d'une ligne, statut : dans une vue (`db/vues.sql`), jamais
   recopiés dans une colonne.
4. **Un fait à un seul endroit.** Une remise vit dans `achats.promos`, le format
   d'un paquet dans `achats.produits`, une personne dans `famille.personnes`.
5. **L'historique ne se réécrit pas.** Une ligne de ticket garde son libellé
   imprimé ; une correction change le rangement (produit → article), pas la
   ligne.
6. **Noms** : français sans accent, `snake_case`, tables au pluriel, clé
   étrangère `<entité>_id`, date de création `cree_le`. Référentiels avec un
   identifiant lisible (`leclerc-meaux`, `tomate`) ; tables qui grossissent
   avec un entier.
7. **Unités** : `kg`, `l` ou `piece` pour les quantités d'achat ; mesures de
   santé avec leur unité explicite. Montants en euros `NUMERIC(10, 2)`. Dates
   `DATE`, instants `TIMESTAMPTZ`.
8. **Valeurs fermées par `CHECK`** (`source`, `unite`, `role`…), jamais du
   texte libre pour une catégorie.
9. **Chaque table, colonne non évidente et vue a un `COMMENT`** dans
   `db/vues.sql` : l'export en tire le dictionnaire des données.
10. **Une colonne ne change jamais de sens.** On ajoute une colonne ; on ne
    détourne pas une colonne existante.
11. **Une personne est toujours `famille.personnes.id`**, quel que soit le
    domaine (qui a mangé, qui est mesuré, qui a acheté).
12. **Fourre-tout explicites** : ce qui n'est pas encore classé va dans un
    article marqué `fourre_tout`, exclu des prix ; un produit acheté souvent
    reçoit son propre article.

## Où vit quoi

- Migration ponctuelle (déplacer, convertir) :
  `db/migrations/AAAA-MM-JJ-<sujet>.sql`, lancée une fois au démarrage par
  `index.js`, dans une transaction, avec des contrôles qui l'annulent si un
  total change.
- Vues et descriptions : `db/vues.sql`, relancé à chaque démarrage
  (`CREATE OR REPLACE`, `COMMENT ON`).
- Imports : `scripts/importer-*.js` ; ils écrivent dans les tables de faits
  et s'arrêtent sur une incohérence (magasin inconnu, remise sans promo).
- Export : `scripts/exporter-donnees.js` vers `family-hub-data`.
- Doc : structure dans `data-model.md`, règles ici, décisions dans `adr/`.

## Ajouter une table ou une colonne

1. Choisir le domaine (règle 1) et vérifier que le fait n'existe pas déjà
   (règle 4).
2. Nommer selon la règle 6, typer selon la règle 7, fermer les valeurs
   (règle 8).
3. Écrire la création dans `index.js` (`CREATE TABLE IF NOT EXISTS`,
   `ADD COLUMN IF NOT EXISTS`) ou une migration datée si des données bougent.
4. Ajouter les `COMMENT` dans `db/vues.sql`.
5. Mettre à jour `data-model.md`.
6. Vérifier sur dev : redémarrer, `node scripts/verifier-api.js`, totaux
   inchangés.
7. Donner à Olumide la même opération pour la production (le déploiement
   applique les migrations).

## Changer la structure de données existantes

1. Sauvegarde locale avant tout : `pg_dump` de dev (et branche Neon de
   sauvegarde pour la production).
2. Capturer ce que lit l'application avant (lignes des Stats, totaux).
3. Essai de la migration dans une transaction annulée (`BEGIN … ROLLBACK`).
4. Comparer avant/après ligne à ligne ; expliquer chaque écart.
5. Appliquer sur dev, `verifier-api.js`, tests frontend.
6. Production : sauvegarde Neon, puis `fly deploy -a ch-ow` par Olumide.

## Contrôles à chaque import de tickets

- Somme des lignes = total imprimé du ticket.
- Somme des promos = remises imprimées.
- Aucun produit sans article (sinon : liste « À classer » à traiter).
- Magasin connu dans `achats.magasins`.

## Ce que la prévision des prix exige

- Tous les passages enregistrés ; un passage connu seulement par la banque
  reste un ticket `releve-bancaire` sans lignes.
- Un format par produit, une unité par article ; un nouveau format crée un
  nouveau produit.
- Le prix normal séparé de la promo (`prix_ref_normal`).
- L'enseigne gardée sur chaque ticket.
