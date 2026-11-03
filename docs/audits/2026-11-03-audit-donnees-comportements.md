# Audit des données et comportements — 2026-11-03

## Périmètre et limites

Revue statique des parcours React, routes Express, calculs métier, vues SQL, migrations et scripts de données. Je n’ai pas interrogé Neon, exécuté de tests ni contrôlé l’interface dans un navigateur. Les constats portent sur les comportements déductibles du code ; l’état réel des lignes en base reste à vérifier séparément.

Les rapports sont rangés dans `docs/audits/` et nommés par date.

## Constats

### Mineure — La feuille « Aliments jetés » peut s’ouvrir sur le mauvais mois

`moisCourant()` utilise `toISOString()`, donc le mois UTC ([FeuilleJetes.jsx](../../frontend/src/pages/parametres/FeuilleJetes.jsx#L26)). Au début d’un mois en France, avant minuit UTC, elle choisit le mois précédent et charge ses données.

### Majeure — Une entrée Calories peut recevoir une quantité négative

L’ajout utilise `req.body.quantiteG || 100` sans valider le nombre ni son signe ; la modification vérifie seulement que la valeur est truthy ([index.js](../../index.js#L1372), [index.js](../../index.js#L1413)). Une quantité négative est enregistrée et produit des calories et macros négatives. Le champ UI a un minimum, mais cela ne remplace pas la validation serveur.

### Mineure — Deux ajouts simultanés dans la Cuisine peuvent partager le même ordre

L’ordre d’une nouvelle entrée est calculé par `MAX(ordre) + 1` dans la même insertion ([index.js](../../index.js#L1381)). Deux requêtes simultanées peuvent lire le même maximum et enregistrer le même `ordre`. La lecture trie uniquement par `ordre` ([index.js](../../index.js#L505)) ; l’ordre relatif de ces entrées devient alors indéterminé.

### Mineure — Certaines écritures répondent « succès » même si aucune ligne n’a changé

La modification du Stock et celle d’une entrée Calories ne vérifient pas le nombre de lignes modifiées ([index.js](../../index.js#L1064), [index.js](../../index.js#L1422)). Un identifiant absent ou devenu obsolète peut donc recevoir une réponse de succès sans mise à jour ; le client Calories attend pourtant un objet `item` dans la réponse.

### Majeure — Les scripts de données peuvent écrire sur la base de production sans garde

L’import des tickets, la correction des correspondances et l’exécution SQL utilisent `DATABASE_URL` telle quelle ([importer-tickets.js](../../scripts/importer-tickets.js#L18), [corriger-libelles.js](../../scripts/corriger-libelles.js#L6), [executer-sql.js](../../scripts/executer-sql.js#L3)). Ils affichent la base, puis continuent sans confirmation ni contrôle de branche. `docs/operations.md` demande de vérifier cette sortie avant de poursuivre, mais le code ne met pas l’exécution en pause.

### Majeure — L’estimation ignore les prix des articles maison

`GET /api/courses/estimation` ne charge que les lignes avec `food_id` ([index.js](../../index.js#L627)). Les articles maison ont un `article_id` et pas de `food_id` : ils sont comptés comme sans prix, sans recherche de leur historique de tickets ([index.js](../../index.js#L632), [index.js](../../index.js#L674)). Pourtant, le calcul du panier de tournée récupère déjà les prix médians de ces articles depuis `achats.v_lignes` ([index.js](../../index.js#L590)). Le montant et la fourchette affichés avant les courses omettent donc les articles maison même quand un prix est connu.

### Mineure — Le nombre d’articles ne correspond pas au détail affiché

Le serveur inclut articles maison et texte libre dans `articles` et `sansPrix`, mais ne les ajoute pas à `details` ([index.js](../../index.js#L632), [index.js](../../index.js#L674)). La bulle affiche le nombre total puis ne rend que les entrées de `details` ([EstimationCourses.jsx](../../frontend/src/pages/courses/EstimationCourses.jsx#L116), [EstimationCourses.jsx](../../frontend/src/pages/courses/EstimationCourses.jsx#L128)). L’utilisateur voit donc moins de lignes que d’articles comptés et ne peut pas repérer lesquels n’ont pas de prix.

### Couverture à confirmer — Aliments sans prix de référence

Pour un aliment sans historique exploitable, l’estimation utilise `prix_habituel` ; si cette valeur est nulle, l’article est exclu du montant, reçoit « aucun prix connu » et affiche `—` ([index.js](../../index.js#L659), [EstimationCourses.jsx](../../frontend/src/pages/courses/EstimationCourses.jsx#L50)). Le code ne permet pas de dire quels aliments de la base actuelle sont dans ce cas ; il faut comparer les lignes Courses avec leurs tickets et `prix_habituel` pour dresser la liste exacte.

## Organisation et enregistrement des données

### Majeure — Le preset hebdomadaire ne sait pas conserver les articles maison

`chow.courses_modeles` ne stocke que `food_id` ou `nom_libre` ([index.js](../../index.js#L106), [index.js](../../index.js#L108)). Lorsqu’on enregistre un preset contenant un article maison, son `food_id` et son `nom_libre` sont tous deux nuls ; la route écrit donc une ligne vide ([index.js](../../index.js#L1219)). À la réapplication, le code traite cette ligne comme du texte libre et appelle `toLowerCase()` sur `null` ([index.js](../../index.js#L1183)). Le modèle devrait conserver `article_id` et empêcher les lignes dont la cible est vide ou multiple.

### Mineure — La base n’impose pas une cible unique par ligne de Courses

La contrainte actuelle interdit seulement de renseigner simultanément `food_id` et `article_id` ([2026-10-30-4-courses-articles.sql](../../db/migrations/2026-10-30-4-courses-articles.sql#L2)). Elle ne garantit pas qu’une ligne représente exactement un aliment, un article maison ou un texte libre. Les routes respectent cette convention, mais les imports et futures écritures peuvent créer des lignes impossibles à classer.

### Mineure — Plusieurs passages au même magasin le même jour ne sont pas distingués

L’import regroupe les lignes par date et magasin et crée un code à partir de ces deux champs ([importer-tickets.js](../../scripts/importer-tickets.js#L38), [importer-tickets.js](../../scripts/importer-tickets.js#L49)). La table rend ce code unique ([2026-10-30-1-schemas-par-domaine.sql](../../db/migrations/2026-10-30-1-schemas-par-domaine.sql#L134)). Deux tickets du même magasin le même jour sont donc agrégés en un seul passage ; sans numéro ou identifiant de reçu dans la clé d’import, la séparation d’origine est perdue.

### Structure à préserver et à consolider

La séparation `achats.articles` (besoin générique), `achats.produits` (libellé et format vendu) et `achats.lignes` (achat réel) est une bonne base. `chow.aliments` peut rester l’extension nutritionnelle des articles alimentaires. Pour éviter les écarts, la relation entre les deux catalogues et les prix de référence devrait être contrôlée au niveau des données, et le prix de secours devrait être disponible pour tout `achats.article`, pas seulement les aliments Chow.

## Améliorations de fiabilité

- Valider côté serveur les quantités Calories comme nombres finis et strictement positifs, pour l’ajout et la modification.
- Rendre l’attribution de l’ordre atomique ou ajouter un second critère stable au tri.
- Vérifier `rowCount` après les mutations et renvoyer `404` si la cible n’existe plus.
- Ajouter une garde explicite de branche et une confirmation dédiée avant les scripts qui écrivent dans une base de production.
- Réutiliser l’estimation d’historique des articles maison dans la fourchette générale, et afficher explicitement les lignes sans prix.
- Pour les aliments dont le prix manque, permettre de renseigner un prix de référence ou afficher clairement qu’ils ne sont pas inclus dans le total estimé.
- Étendre le preset hebdomadaire au type d’article maison et ajouter une contrainte garantissant exactement une cible par ligne de Courses.
- Identifier chaque reçu par un numéro ou identifiant source lorsqu’il existe ; conserver date + magasin comme repli uniquement si l’import peut confirmer qu’il n’y a qu’un passage.
- Aligner `README.md` et `docs/quality.md` avec la réalité : le dépôt contient des tests Jest dans `frontend/`, même si le script `npm test` à la racine n’en lance pas.

## Vérification

Constats issus du code et des documents locaux. Aucun test, appel à la base ou contrôle navigateur n’a été effectué ; les comportements et l’état des données doivent être confirmés avant toute correction ou clôture de bug.

## État des constats du 2026-10-31

La revue précédente relevait le mélange des quantités au poids et à la pièce, la création partielle de recettes et la pondération de l’inflation courte. Le code actuel contient les corrections correspondantes. La création d’aliments accessible à tout compte connecté est une décision produit pour RègleX, pas un défaut.
