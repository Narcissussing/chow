# Plan — base Family Hub

Plan de restructuration de la base Neon en domaines, rédigé le 2026-10-30.
Une fois appliqué, les faits durables passent dans `data-model.md` et une ADR
005 ; ce fichier sera alors supprimé.

## Objectifs

- Une seule base pour toute la famille : achats, Chow, santé, bébés.
- Tout achat enregistré, alimentaire ou non, pour une liste de courses
  universelle.
- Dans deux ans : prévoir l'évolution des prix à partir des achats habituels.
- Lisible par une personne sans l'application : noms français clairs,
  documentation dans la base, export CSV.

## Principes

- **Un schéma Postgres par domaine.** Les requêtes nomment toujours le schéma
  (`achats.lignes`), jamais de `search_path` implicite.
- **Les tables gardent des faits, les vues font les calculs.** Prix au kg,
  total payé, remise d'une ligne : calculés dans des vues, jamais recopiés.
- **Un fait à un seul endroit.** Une remise vit dans `achats.promos`, pas aussi
  dans la ligne.
- **L'historique ne se réécrit pas.** Un ticket garde son libellé imprimé ; une
  correction change le rangement du produit, pas la ligne.
- **Noms** : français, `snake_case`, tables au pluriel, clé étrangère
  `<entité>_id`. Référentiels avec un identifiant lisible (`leclerc-meaux`,
  `tomate`) ; tables qui grossissent avec un entier.
- **Unités** : `kg`, `l` ou `piece`, rien d'autre. Montants en euros
  `NUMERIC(10, 2)`. Dates `DATE`, instants `TIMESTAMPTZ`.
- **Chaque table et colonne a un `COMMENT`** : l'export en tire le
  dictionnaire des données.
- **Une colonne ne change jamais de sens.** On ajoute, on ne détourne pas.

## Schémas

### `famille` — le cœur

- `personnes` : `id` (texte, `olumide`), `prenom`, `role`
  (`parent` / `enfant`), `date_naissance`, `sexe`, `cree_le`.
- `comptes` : ancien `users`, plus `personne_id`.

### `achats` — tout ce que le foyer achète

- `enseignes` : `id` (`leclerc`, `carrefour`, `marche-frais`), `nom`.
- `magasins` : `id` (`leclerc-meaux`), `enseigne_id`, `nom`, `ville`.
- `categories` : arbre unique du foyer. `id` (`alimentation-legumes`), `nom`,
  `parent_id`. Premier niveau : Alimentation, Boissons, Hygiène et beauté,
  Entretien, Maison et cuisine, Bébé, Santé, Animaux, Loisirs et papeterie,
  Vêtements, Autre.
- `articles` : ce qu'on écrit sur une liste de courses. `id` (`tomate`,
  `papier-toilette`), `nom`, `categorie_id`, `unite_ref` (`kg` / `l` /
  `piece`). Une marque ou un format différent reste le même article.
- `produits` : un article tel que vendu dans une enseigne (ancien
  `libelles`). `id`, `enseigne_id`, `libelle` (tel qu'imprimé), `article_id`,
  `contenance` et `unite` (format du paquet : 0,85 `kg`, 12 `piece`).
  Unique (`enseigne_id`, `libelle`). Le format est saisi une fois ici, plus
  deviné ligne par ligne.
- `tickets` : un passage en caisse ou une commande.
  - Identité : `id`, `code` lisible unique (`2026-10-29-1935-leclerc-meaux`),
    `magasin_id`, `date`, `heure`, `numero` (imprimé, si connu).
  - Origine : `source` (`ticket-papier`, `ticket-numerique`,
    `releve-bancaire`, `saisie`).
  - Montants imprimés : `total_articles` (avant remises), `bons`
    (bons hors produit), `paye`, `cagnotte` (fidélité gagnée).
- `lignes` : une ligne de ticket (ancien `achats`). `id`, `ticket_id`,
  `produit_id`, `rayon` (imprimé), `quantite`, `unite_vente` (`piece` / `kg`),
  `prix_unitaire`, `montant` (avant remise).
- `promos` : une remise rattachée à sa ligne. `id`, `ligne_id`, `offre`
  (texte imprimé), `type` (`remise immédiate`, `2e à prix réduit`, `2+1`),
  `pourcentage`, `montant`.

Vues de calcul :

- `achats.v_lignes` : chaque ligne avec date, magasin, enseigne, article,
  catégorie, `remise`, `paye`, `quantite_ref` (en unité de l'article),
  `prix_ref_normal` (hors promo) et `prix_ref_paye`, `en_promo`.
- `achats.v_prix` : par article, enseigne et mois, médiane du prix de
  référence normal. Série de base de la prévision.
- `achats.v_panier_habituel` : articles achetés au moins 6 mois sur 12, avec
  la quantité moyenne par mois. Sert de pondération.
- `achats.v_inflation_foyer` : indice mensuel du panier habituel, comparable
  à `reference.indices_prix`.

Le statut `chow` / `hors-chow` / `non-alimentaire` disparaît : la catégorie
dit si c'est alimentaire, le lien `chow.aliments.article_id` dit si Chow le
suit.

### `chow` — l'alimentation à la maison

Tables déplacées et renommées, données inchangées :

- `aliments` (ancien `foods`), plus `article_id` (unique).
- `stock`, `courses`, `courses_modeles` (ancien `courses_preset`).
- `journal` (ancien `journal_repas`), plus `personne_id` (vide pour
  l'existant).
- `recettes`, `recette_ingredients`.

Les colonnes `food_id` deviennent `aliment_id`. L'API garde `food_id`
(`aliment_id AS food_id`) : le frontend ne change pas dans cette étape.

### `reference` — données extérieures

- `indices_prix` (ancien `indices_france`) : `serie`, `mois`, `valeur`,
  `source` (`INSEE`).

### `app` — technique, aucune donnée de famille

- `sessions` (ancien `session`), `ip_bloquees`.

### Plus tard, sans rien refaire

- `achats.listes` et `achats.liste_articles` : liste de courses de tout
  article ; remplacera `chow.courses`. `prix_habituel` et `magasin` de
  `aliments` passeront sur `articles`.
- `sante` : `types_mesure` (`poids` en kg, `taille` en cm,
  `perimetre_cranien` en cm, `semaines_grossesse`…), `mesures`
  (`personne_id`, `date`, `type_id`, `valeur`), `vaccins`, `grossesses`,
  `rendez_vous`.
- `bebe` : `repas` (allaitement, biberon, solide → `chow.aliments`),
  `sommeil`, `etapes` (diversification, premiers pas, réaction à un aliment).

## Prévision des prix

Ce qu'il faut garantir dès maintenant pour qu'elle marche dans deux ans :

- **Tous les passages** : chaque ticket saisi ; un passage connu seulement
  par la banque reste un ticket `releve-bancaire` sans lignes, pour que les
  dépenses soient complètes.
- **Prix comparables** : un format par produit, une unité par article ;
  passer de 125 g à 100 g crée un nouveau produit, le prix au kg montre la
  hausse.
- **Promo séparée du prix normal** : la prévision lit `prix_ref_normal`.
- **Enseigne gardée** : le même article n'a pas le même prix partout.
- **Contrôle à chaque import** : somme des lignes = `total_articles`, aucun
  libellé sans article.

Méthode dans deux ans : série mensuelle par article (`v_prix`), tendance
sur 12 à 24 mois, pondérée par `v_panier_habituel`, comparée à l'INSEE.

## Export `family-hub-data`

- Copie locale sur le Mac : `~/Perso/House Projects/family-hub-data/`, dossier
  qui est aussi le dépôt GitHub privé (sauvegarde hors du Mac).
- `node scripts/exporter-donnees.js` y écrit un dossier par schéma, un CSV
  par table et par vue utile, `lignes` découpé par année.
- Le même script garde un `pg_dump` complet dans `sauvegardes/`
  (`AAAA-MM-JJ-family-hub.dump`, les 12 derniers), ignoré par Git : de quoi
  recréer toute la base sans Neon.
- Lancé après chaque import de tickets, et au moins une fois par semaine.
- `README.md` généré depuis les `COMMENT` : chaque table, chaque colonne,
  son unité.
- CSV : UTF-8, virgule, point décimal, dates ISO.
- `sante` et `bebe` chiffrés avant de sortir de Neon.
- Script court : se connecte, exporte, se déconnecte (calcul Neon limité).

## Étapes

1. **Validation de ce plan** par Olumide.
2. **Dev** : migration au démarrage, gardée par l'existence des anciennes
   tables (ADR 001). `ALTER TABLE … SET SCHEMA` puis `RENAME` : les données ne
   sont pas copiées, les clés suivent. Puis création des nouvelles tables et
   conversion des tickets (enseignes, magasins, produits avec format, lignes,
   promos par ligne).
3. **Code** : requêtes de `index.js`, `stats.js` et `scripts/` mises à jour
   (environ 180 références), import des tickets réécrit sur le nouveau modèle.
   Vérification : `npx jest`, `node scripts/verifier-api.js`, totaux des
   tickets identiques avant et après.
4. **Catalogue** : articles pour les libellés non alimentaires et hors Chow,
   à partir des règles existantes ; les cas douteux envoyés à Olumide.
5. **Export** : dépôt `family-hub-data`, premier export.
6. **Production** : branche Neon de sauvegarde, puis `fly deploy -a ch-ow` par
   Olumide ; la migration s'applique au démarrage.
7. **Début novembre** : `pg_dump` de `family-hub-backup`, `pg_restore` dans
   `family-hub`, nouveaux `DATABASE_URL` dans Fly et `.env`.

## Avancement

- 2026-10-30, dev : migration appliquée (`db/migrations/2026-10-30-schemas-par-domaine.sql`),
  vues et descriptions (`db/vues.sql`), code et scripts sur le nouveau modèle,
  `verifier-api.js` conforme, totaux identiques (15 397,04 € payés, 343,05 € de
  remises), premier export local. Règles : `architecture-donnees.md`, ADR 005.
- Reste : catalogue des articles (étape 4), dépôt GitHub `family-hub-data`,
  production (étape 6), novembre (étape 7), puis suppression du schéma `ancien`.
- Plus tard : renommer `food_id` en `aliment_id` avec l'API et le frontend ;
  `v_inflation_foyer` (le calcul reste dans `stats.js` pour l'instant) ;
  `heure`, `bons` et `cagnotte` des tickets à lire dans `tickets/extraire.cjs`.

## À fournir par Olumide

- Les personnes de la famille (prénom, date de naissance) pour
  `famille.personnes`.
- Validation de l'arbre des catégories.
