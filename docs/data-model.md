# Modèle de données

Ce qui existe dans la base Family Hub. Les règles à suivre pour la modifier
sont dans [Architecture des données](architecture-donnees.md). Chaque table et
colonne est aussi décrite dans la base (`COMMENT`, voir `db/vues.sql`).

## Relations

```text
famille.personnes ── famille.comptes
                  └─ chow.journal (personne_id)

achats.enseignes ── achats.magasins ── achats.tickets ── achats.lignes ── achats.promos
                 └─ achats.produits ───────────────────────┘
achats.categories ── achats.articles ── achats.produits
                                     └─ chow.aliments (article_id)

chow.aliments ──┬── chow.stock
                ├── chow.courses
                ├── chow.courses_modeles
                ├── chow.journal
                └── chow.recette_ingredients ── chow.recettes
```

## `famille`

- `personnes` : `id` lisible, `prenom`, `role` (`parent` / `enfant`),
  `date_naissance`, `sexe`. Vide tant que les prénoms ne sont pas saisis.
- `comptes` : connexion (`email`, `mot_de_passe` = empreinte bcrypt, `admin`,
  `personne_id`). Deux comptes, sans inscription publique.

## `achats`

Tout ce que le foyer achète. Chaîne : ligne → produit → article → catégorie.

- `enseignes` : `leclerc`, `carrefour`, `marche-frais`.
- `magasins` : un magasin d'une enseigne (`leclerc-meaux`), avec sa ville.
- `categories` : arbre unique ; premier niveau Alimentation, Boissons, Hygiène
  et beauté, Entretien, Maison et cuisine, Bébé, Santé, Animaux, Loisirs et
  papeterie, Vêtements, Autre ; sous-catégories d'Alimentation reprises des
  catégories Chow.
- `articles` : besoin générique (`tomate`, `papier-toilette`), `unite_ref`
  (`kg`, `l`, `piece`) pour comparer les prix. Un article par aliment Chow
  (même identifiant) ; `alimentation-a-detailler` et
  `non-alimentaire-a-classer` sont des fourre-tout (`fourre_tout`) en
  attendant le catalogue.
- `produits` : un libellé imprimé dans une enseigne, son `article_id` (vide =
  à classer) et le format d'une unité vendue (`contenance` + `unite` ; vide
  pour un produit au poids, 1 `piece` par défaut).
- `tickets` : un passage ; `code` lisible (`2026-10-29-leclerc-meaux`),
  `source` (`ticket-papier`, `ticket-numerique`, `releve-bancaire`, `saisie`),
  `total_articles` (avant remises), `bons`, `paye`, `cagnotte`. Un ticket
  `releve-bancaire` n'a pas de lignes.
- `lignes` : `quantite` en pièces ou en kg selon `unite_vente`,
  `prix_unitaire`, `montant` avant remise.
- `promos` : une remise par ligne (`offre` imprimée, `type`, `pourcentage`,
  `montant`).

Vues :

- `v_lignes` : chaque ligne avec magasin, article, catégorie, `remise`,
  `paye`, `quantite_ref` / `unite_ref`, `comparable` (même unité que
  l'article), `prix_ref_normal` (hors promo) et `prix_ref_paye`.
- `v_prix` : prix médian hors promo par article, enseigne et mois.
- `v_panier_habituel` : articles achetés au moins 6 mois sur 12.

## `chow`

- `aliments` : référentiel Chow (`id` slug), nutrition pour 100 g ou 100 ml,
  `tracking_type` (`unite`, `pack`, `cl`), conversions (cuillères, poids à la
  pièce), `pas_achat`, `prix_habituel`, `magasin`, `article_id`.
  `fibres`, `sucres`, `graisses_saturees` et `sel` ne sont lus par aucune
  route.
- `stock` : `food_id`, `quantite` (nombre ou état textuel), `unite`,
  `date_maj`.
- `courses` : `food_id` ou `nom_libre`, `commentaire`, `achete` (la ligne est
  gardée après achat), `photo` en `BYTEA`, `date_ajout`, `date_achat`.
- `courses_modeles` : articles ajoutés d'un coup chaque semaine ;
  l'enregistrement remplace toutes les lignes.
- `journal` : `food_id`, `quantite_g`, `date_entree`, `ordre`, `unite`
  affichée (`NULL` = grammes), `ajoute` (déjà dans le plat), `personne_id`.
  Calories calculées, jamais stockées.
- `recettes` (`nom`, `categorie`, `etapes` une par ligne) et
  `recette_ingredients` (`food_id`, `quantite_g`, `unite`, ordre = `id`).
- Vue `v_lignes_stats` : achats au format lu par `stats.js` (Stats, Courses),
  passages bancaires compris.

Les colonnes `food_id` gardent leur nom anglais tant que l'API et le
frontend ne sont pas renommés ensemble.

`aliments.magasin` : magasin habituel choisi ; à défaut, `GET /api/courses` le
déduit des achats des 12 derniers mois. `GET /api/courses/estimation`
estime les Courses non achetées (`prevoirArticle` dans `stats.js`) : quantité
habituelle hors remise × dernier prix normal ; sans historique,
`prix_habituel` ±20 %.

## `reference`

- `indices_prix` : indices INSEE mensuels par série (`alimentation`,
  `ensemble`), `source`.

## `app`

- `sessions` (`connect-pg-simple`), `ip_bloquees`.

## `ancien`

Tables d'achats d'avant le 2026-10-30 (`tickets`, `achats`, `libelles`,
`promos`), gardées pour comparaison ; à supprimer après la vérification de
novembre 2026.
