# Revue de code — 2026-10-31

## Périmètre

Revue statique large du dépôt : routes Express et calculs métier, migrations SQL, pages React, composants, scripts et documentation produit, avec recherches transversales dans le code. Aucun fichier applicatif n’a été modifié. Aucun test ni parcours navigateur n’a été exécuté ; les constats décrivent le comportement lisible dans le code.

Le dossier `audits/` regroupe les revues ; les noms commencent par leur date pour les retrouver dans l’ordre chronologique.

## Anomalies observées

### Majeure — Création d’aliment accessible sans rôle administrateur

`POST /api/aliments` est déclaré après le contrôle de connexion, mais sans `exigerAdmin` ([index.js](../../index.js#L936)). La création d’un aliment crée aussi un article partagé dans le catalogue. Or le produit réserve les Paramètres à l’administrateur et ne prévoit pas la création d’aliments depuis l’interface ([product.md](../product.md#L18)). Un autre compte connecté peut donc modifier le catalogue en appelant directement cette API.

### Mineure — Quantité incohérente si un article est acheté au poids et à la pièce

La page Tickets regroupe les deux quantités dans une même valeur : dès qu’un article a au moins une quantité en pièces, elle affiche `pieces + kg` sous la forme `×N` ([tickets.js](../../tickets.js#L61), [tickets.js](../../tickets.js#L70)). Par exemple, 2 pièces et 0,5 kg deviennent `×2,5`, quantité qui n’a pas de sens.

### Mineure — Création de recette partielle en cas d’erreur

`POST /api/recettes/creer` insère la recette, puis ses ingrédients dans des requêtes séparées sans transaction ([index.js](../../index.js#L1590)). Si un ingrédient est invalide ou qu’une requête échoue, la recette et éventuellement certains ingrédients restent en base alors que l’API renvoie une erreur. La modification de recette, elle, utilise une transaction.

### Mineure — Pondération différente pour l’inflation sur une courte période

`inflationCourte` pondère chaque produit par le nombre de lignes achetées (`p.length`) ([stats.js](../../stats.js#L195)). L’indice mensuel pondère par la dépense du produit ([stats.js](../../stats.js#L149)). Pour la même période, un produit acheté souvent mais peu cher peut donc peser davantage dans la variation courte, malgré le commentaire qui annonce la même méthode.

## Documentation et améliorations produit

- `README.md` et `docs/quality.md` affirment qu’il n’existe pas de tests automatisés ([README.md](../../README.md#L41), [quality.md](../quality.md#L106)), alors que `frontend/` contient Jest, Testing Library et de nombreux fichiers `.test.jsx`. Le script `npm test` à la racine échoue volontairement faute de tests définis ; la commande de tests frontend n’est pas documentée.
- Ajouter une validation serveur des quantités calories (valeur numérique finie et positive). Aujourd’hui, `quantiteG = req.body.quantiteG || 100` remplace zéro par 100 et laisse passer une valeur négative ([index.js](../../index.js#L1355)).
- Rendre atomiques les autres créations multi-requêtes et vérifier les réponses d’update avant de répondre « succès », pour éviter des données partielles ou des succès sans modification.

## Vérification

Revue statique uniquement. Les constats n’ont pas été reproduits en base ni dans un navigateur ; ils restent à valider par une BFV avant fermeture d’un éventuel bug signalé par Olumide.

## Suites (2026-10-31)

- Quantités au poids et à la pièce : affichées côte à côte (« ×2 · 0,5 kg »).
- Création de recette : dans une transaction ; vérifié par `verifier-api.js`.
- Inflation courte : pondérée par la dépense, comme l'indice mensuel.
- Création d'aliment : laissée ouverte à tout compte connecté (décision d'Olumide) : RègleX (Calories) crée des aliments pour tout le foyer.
