# Modèle de données

Le modèle est reconstruit depuis les requêtes de `index.js`. Il n’existe pas
encore de schéma SQL versionné ni d’outil de migration dédié. Les types exacts
doivent être confirmés directement dans PostgreSQL avant une migration
importante.

## Relations

```text
foods ──┬── stock
        ├── courses
        ├── courses_preset
        ├── journal_repas
        ├── recette_ingredients
        └── libelles ·· achats (par le texte du libellé) ── tickets

recettes ── recette_ingredients ── foods
users ── session (identifiant sérialisé, sans clé étrangère)
```

## Tables

### `users`

| Colonne | Rôle |
|---|---|
| `id` | Clé primaire |
| `email` | Identifiant unique |
| `password` | Hash bcrypt |

### `foods`

Référentiel central. `id` est un slug texte utilisé dans les URL et comme
clé étrangère.

| Groupe | Colonnes |
|---|---|
| Identité | `id`, `nom`, `emoji`, `image`, `categorie` |
| Détail | `description`, `origine` |
| Stock | `tracking_type`, `emplacement`, `unite` |
| Nutrition pour 100 g | `calories`, `glucides`, `proteines`, `lipides`, `fibres`, `sucres`, `graisses_saturees`, `sel` |
| Conversions | `grammes_par_cuil_a_cafe`, `grammes_par_cuil_a_soupe`, `poids_unite_g` |

`tracking_type` vaut `unite`, `pack` ou `cl`. Toutes les valeurs
nutritionnelles sont interprétées pour 100 g, indépendamment de ce type.

### `stock`

| Colonne | Rôle |
|---|---|
| `id` | Clé primaire |
| `food_id` | Référence vers `foods.id` |
| `quantite` | Nombre ou état textuel pour certains liquides |
| `unite` | Libellé d’unité dénormalisé |
| `date_maj` | Dernière mise à jour |

### `courses`

| Colonne | Rôle |
|---|---|
| `id` | Clé primaire |
| `food_id` | Aliment connu, nullable |
| `nom_libre` | Article libre lorsque `food_id` est absent |
| `commentaire` | Note |
| `achete` | État d’achat |
| `photo` | Image compressée en `BYTEA` |
| `date_ajout` | Date d’ajout |

Une ligne utilise soit `food_id`, soit `nom_libre`. Les lignes achetées
sont conservées avec `achete = true`.

### `courses_preset`

Contient `id`, `food_id` et `nom_libre`. L’enregistrement du preset
remplace l’ensemble de ses lignes dans une opération, sans calcul de diff.

### `journal_repas`

| Colonne | Rôle |
|---|---|
| `id` | Clé primaire |
| `food_id` | Référence vers `foods.id` |
| `quantite_g` | Quantité consommée en grammes |
| `date_entree` | Journée de la Cuisine |
| `ordre` | Position manuelle dans la journée |
| `unite` | Unité affichée (`g`, `cafe`, `soupe`, `piece`, `ml`, `l`) ; `NULL` = grammes |
| `ajoute` | Déjà mis dans le plat (double-tap dans la Cuisine) |

Les calories et macros calculées ne sont pas stockées :
`valeur_food × quantite_g / 100`.

### `recettes` et `recette_ingredients`

`recettes` contient `id`, `nom`, `categorie` et `etapes`. `etapes` stocke une
étape de préparation par ligne ; l’interface les numérote à l’affichage.
`recette_ingredients` relie une recette à `food_id` avec
`quantite_g` et `unite` (unité affichée, reprise dans la Cuisine). Une
modification remplace les lignes ; leur ordre d’insertion (`id`) est l’ordre
de la recette.

### `tickets`, `achats` et `libelles`

Historique des tickets de caisse (Leclerc, Carrefour, Marché Frais), importé
une fois par `scripts/importer-tickets.js` depuis le dossier local `tickets/`.

- `tickets` : un passage en caisse, identifié par `date` et `magasin` ;
  `enseigne` regroupe les magasins d’une même chaîne, `total` est la somme
  des lignes. `date` est vide pour un ticket photographié sans sa date.
- `achats` : une ligne de ticket (`libelle`, `quantite` ou `poids`,
  `prix_unitaire`, `total`), rattachée à `ticket_id`. `contenance`, `unite`
  et `prix_ref` donnent le prix au kg ou au litre quand il est connu.
- `libelles` : association d’un libellé de ticket à un aliment Chow
  (`food_id`, statut `chow`) ou à un statut `hors-chow`, `non-alimentaire`,
  `non-detaille` (passage connu seulement par la banque) ou `a-classer`.
  Un nouveau libellé n’est associé qu’une fois.
- `achats.remise` : remise immédiate du ticket (section « BONS DE REDUCTION »
  de Leclerc) rattachée à la ligne ; `achats.total` est alors le prix réellement
  payé.
- `promos` : une ligne par remise (date, magasin, produit, `offre` telle
  qu’imprimée, `type` « 2e à prix réduit » / « 2+1 » / « remise immédiate »,
  `pourcentage`, `montant`), pour suivre les promos dans le temps.

`GET /api/courses/estimation` estime les Courses non achetées sans quantité
saisie : pour chaque aliment, médiane du coût payé lors des 8 derniers
passages en caisse des 12 derniers mois (fourchette = 1er et 3e quartiles).
Sans historique, il utilise `foods.prix_habituel` (coût d’un achat habituel,
±20 %) ; sinon l’article est compté dans `sansPrix`.

### `session`

Table standard créée par `connect-pg-simple`. Elle rend les sessions
indépendantes du cycle de vie de la machine Fly.io.

## Contraintes applicatives importantes

- aucun CRUD d’administration pour `foods` ;
- aucune suppression en cascade identifiée ;
- les migrations sont des `CREATE/ALTER ... IF NOT EXISTS` exécutés au
  démarrage ;
- modifier une structure en production exige de considérer le déploiement
  comme une migration ;
- `fibres`, `sucres`, `graisses_saturees` et `sel` existent dans `foods`
  mais ne sont lus par aucune route de `index.js` : les saisir ne change
  rien à l'affichage tant qu'aucune vue ne les consomme.
