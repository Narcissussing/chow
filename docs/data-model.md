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
- `categories` : arbre unique à deux niveaux. Alimentation et Boissons
  reprennent les catégories Chow ; le reste en neuf familles (Hygiène,
  Entretien, Cuisine, Électronique, Bébé, Santé, Maison, Animaux, Divers) et
  leurs types, `consommable` ou équipement.
- `articles` : besoin générique (`tomate`, `papier-toilette`, `piles-aaa`),
  `unite_ref` (`kg`, `l`, `piece`) pour comparer les prix, `suivi` (`nombre`,
  `niveau`, vide) pour l'inventaire, `achat_en_promo`, `a_reduire` (1 superflu,
  2 dessert : niveaux d'économie des Tickets). Un article par aliment
  Chow (même identifiant) ; les fourre-tout (`fourre_tout`) gardent ce qui
  n'est pas encore détaillé ou n'est acheté qu'une fois.
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
- `choix` : Mon plan, un choix par article (`decision` garder, moins, arrêter,
  changer ; `quantite_visee` par mois pour « moins » ; `preference` texte
  libre, ex. gros œufs à Marché Frais). Un article gardé avec une préférence ne
  reçoit plus de suggestion « moins cher ».

Vues :

- `v_lignes` : chaque ligne avec magasin, article, catégorie, `remise`,
  `paye`, `quantite_ref` / `unite_ref`, `comparable` (même unité que
  l'article), `prix_ref_normal` (hors promo) et `prix_ref_paye`.
- `v_prix` : prix médian attendu par article, enseigne et mois (hors promo,
  sauf articles achetés seulement en promo).
- Fonction `nombre_par_paquet(libelle)` : unités d'un paquet (2X6P, X35, 14P).
- `v_economies` (chaque achat remisé : prix affiché, payé, économie, achat en
  lot) et `v_economies_par_an` (par année et article).
- `v_bon_prix` : prix payé comparé au prix médian payé pour le même article
  sur les 12 mois d'avant.
- `v_panier_habituel` : articles achetés au moins 6 mois sur 12.

## `chow`

- `aliments` : référentiel Chow (`id` slug), nutrition pour 100 g ou 100 ml,
  `tracking_type` (`unite`, `pack`, `cl`), conversions (cuillères, poids à la
  pièce), `pas_achat`, `prix_habituel`, `magasin`, `article_id`.
  `fibres`, `sucres`, `graisses_saturees` et `sel` ne sont lus par aucune
  route.
- `stock` : `food_id`, `quantite` (nombre ou état textuel), `unite`,
  `date_maj`.
- `courses` : `food_id`, `article_id` (article non suivi par Chow : shampoing,
  javel) ou `nom_libre`, `commentaire`, `achete` (la ligne est gardée après
  achat), `photo` en `BYTEA`, `date_ajout`, `date_achat`, `quantite_achetee`
  et `enseigne` (pris en mode magasin).
- `tournees` : `debut`, `fin` ; une seule ouverte. Le panier
  (`GET /api/courses/panier`) = articles de la liste + cochés depuis `debut`,
  valorisés comme l'estimation.
- `courses_modeles` : articles ajoutés d'un coup chaque semaine ;
  l'enregistrement remplace toutes les lignes.
- `jetes` : aliments jetés, une quantité par article et par mois (`mois` = le
  1er, `unite` kg ou piece), saisis dans Paramètres ; Mon plan en tire une
  quantité à acheter en moins.
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

## `maison`

- `inventaire` : ce qu'il reste à la maison hors aliments, un article par
  ligne ; `quantite` (suivi au nombre) ou `niveau` (`plein`, `à moitié`,
  `presque vide`, `vide`), `emplacement`, `date_maj`.

## `reference`

- `indices_prix` : indices INSEE mensuels par série (`alimentation`,
  `ensemble`), `source`.

## `app`

- `sessions` (`connect-pg-simple`), `ip_bloquees`, `migrations` (migrations
  datées déjà appliquées).

## `ancien`

Tables d'achats d'avant le 2026-10-30 (`tickets`, `achats`, `libelles`,
`promos`), gardées pour comparaison ; à supprimer après la vérification de
novembre 2026.
