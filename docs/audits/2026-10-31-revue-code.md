# Revue de code — 2026-10-31

## Périmètre

Revue statique large du dépôt : routes Express et calculs métier, migrations SQL, pages React, composants, scripts et documentation produit, avec recherches transversales dans le code. Aucun fichier applicatif n’a été modifié. Aucun test ni parcours navigateur n’a été exécuté ; les constats décrivent le comportement lisible dans le code.

Le dossier `audits/` regroupe les revues ; les noms commencent par leur date pour les retrouver dans l’ordre chronologique.

## Constats initiaux — réexaminés

Les trois anomalies de calcul et d’écriture signalées dans la première lecture sont corrigées dans le code actuel :

- La quantité des tickets sépare désormais poids et pièces ([tickets.js](../../tickets.js#L61)).
- La création d’une recette utilise désormais une transaction ([index.js](../../index.js#L1618)).
- L’inflation courte est désormais pondérée par la dépense ([stats.js](../../stats.js#L208)).

La création d’aliments pour tout compte connecté est une décision produit pour RègleX ; ce n’est pas une anomalie ([index.js](../../index.js#L953)).

## Nouveaux constats

### Mineure — Le mois courant peut être décalé au changement de mois

La feuille Aliments jetés déduit le mois courant de `toISOString()`, qui exprime la date en UTC ([FeuilleJetes.jsx](../../frontend/src/pages/parametres/FeuilleJetes.jsx#L26)). En France, pendant la première heure ou les deux premières heures du premier jour du mois, l’UTC est encore au mois précédent : la feuille peut donc s’ouvrir sur le mois précédent et charger ses données.

### Majeure — Les commandes d’import n’attendent pas la vérification de la base

Les scripts d’import, de correction des libellés et d’exécution SQL se connectent à `DATABASE_URL` sans vérifier l’environnement ni attendre de confirmation ([importer-tickets.js](../../scripts/importer-tickets.js#L18), [corriger-libelles.js](../../scripts/corriger-libelles.js#L6), [executer-sql.js](../../scripts/executer-sql.js#L3)). Ils affichent le nom de la base puis continuent immédiatement. La procédure d’exploitation demande pourtant de vérifier la base avant de poursuivre ; l’affichage ne laisse pas à l’utilisateur le temps de confirmer et une mauvaise URL peut modifier la production.

## Documentation et améliorations produit

- `README.md` et `docs/quality.md` affirment qu’il n’existe pas de tests automatisés ([README.md](../../README.md#L41), [quality.md](../quality.md#L106)), alors que `frontend/` contient Jest, Testing Library et de nombreux fichiers `.test.jsx`. Le script `npm test` à la racine échoue faute de tests définis ; la commande frontend n’est pas documentée.
- Ajouter une validation serveur des quantités calories (valeur numérique finie et positive). Aujourd’hui, `quantiteG = req.body.quantiteG || 100` remplace zéro par 100 et laisse passer une valeur négative ([index.js](../../index.js#L1355)).
- Sécuriser les scripts qui écrivent en base par une vérification explicite de l’endpoint, avec une confirmation requise pour la production.

## Vérification

Revue statique uniquement. Je n’ai pas relancé `verifier-api.js` et je n’ai pas vérifié les comportements dans un navigateur. La correction des trois constats initiaux est vérifiée par lecture du code ; les nouveaux constats restent à reproduire.

