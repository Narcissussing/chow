# Audit des données et comportements — 2026-11-03

## Vérification exécutée — 2026-11-03

- `npm test -- --runInBand` dans `frontend/` : 18 suites, 161 tests réussis.
- `npm run build` dans `frontend/` : réussi ; avertissements sur les images résolues à l'exécution et un bundle supérieur à 500 ko.
- Endpoint contrôlé avant écriture : Neon dev `ep-spring-truth-b9vjj7sz`.
- `node scripts/verifier-api.js` : tous les contrôles réussis, serveur de test arrêté et nettoyage déclaré terminé par le script.
- Routes vérifiées : authentification, Courses et estimation, modèle hebdomadaire avec article maison, inventaire, Stock, quantités Calories, Stats, plan, aliments jetés et recettes transactionnelles.
- Courses présentes sur dev : 17 lignes, 16 estimées ; seul le texte libre « Pain burger » reste sans prix. L'aliment « Pain (burger) » est estimé depuis les achats.
- Aucun contrôle navigateur ou appareil réel effectué ; BFV utilisateur toujours en attente.
- Aucune migration ni correction de données ajoutée pendant cette vérification ; aucune opération de production exécutée.

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

## Interface et cohérence d’affichage — audit statique du 2026-11-03

### Mineure — Une erreur réseau peut laisser Calories différent de la base

Le changement d’unité et le réordonnancement modifient l’état visible avant la réponse serveur ; en cas d’échec réseau, les erreurs sont ignorées et l’état local n’est pas restauré ([Cuisine.jsx](../../frontend/src/pages/calories/cuisine/Cuisine.jsx#L111), [Cuisine.jsx](../../frontend/src/pages/calories/cuisine/Cuisine.jsx#L116)). Après navigation ou rechargement, l’unité ou l’ordre enregistré réapparaît. Afficher l’échec et restaurer l’état serveur/local précédent.

### Mineure — L’ajout rapide au Stock peut échouer sans retour visible

L’envoi d’un article du Stock vers Courses et sa suppression ignorent l’échec réseau ([StockPage.jsx](../../frontend/src/pages/stock/StockPage.jsx#L166), [StockPage.jsx](../../frontend/src/pages/stock/StockPage.jsx#L203)). L’interface ne confirme alors pas si l’action a abouti et ne propose pas de nouvel essai explicite.

### Mineure — Le libellé « New » reste en anglais dans l’ajout Courses

Le champ d’ajout affiche « New » alors que l’interface est en français ([PanneauAjout.jsx](../../frontend/src/pages/courses/PanneauAjout.jsx#L78)). Le badge paraît conditionnel au texte saisi ; employer un libellé français ou une icône comprise et accessible.

### À vérifier visuellement — Des noms restent tronqués malgré la règle de défilement

La règle personnelle demande de faire défiler les noms longs dans les lignes. Plusieurs vues utilisent encore `text-overflow: ellipsis` (ex. [StockItem.css](../../frontend/src/pages/stock/StockItem.css#L69), [CuisineItem.css](../../frontend/src/pages/calories/cuisine/CuisineItem.css#L43), [Recettes.css](../../frontend/src/pages/calories/recettes/Recettes.css#L223)). Certains champs compacts (sélecteurs et filtres) peuvent légitimement rester ellipsés ; il faut vérifier les éléments concernés sur téléphone avant de traiter chaque occurrence comme un défaut.

### Couverture de recherche à confirmer — Les suggestions Calories ne sont pas limitées à cinq

La recherche Calories filtre toutes les suggestions, mais rend une entrée `<li>` par aliment et masque seulement les non-correspondances ([Cuisine.jsx](../../frontend/src/pages/calories/cuisine/Cuisine.jsx#L208)). Avec une recherche large ou vide, le menu peut donc contenir tout le catalogue au lieu d’un maximum de cinq résultats. À confirmer sur l’interface et à limiter côté rendu si le comportement est visible.

### Cohérence des titres

Les tokens globaux utilisent actuellement DM Sans pour `--font-display` et `--font-body` ([base.css](../../frontend/src/styles/base.css#L10)). Les pages qui consomment `--font-display` suivent donc la préférence actuelle ; les anciennes mentions de Playfair dans le nom du token ne chargent pas cette police.

## État des constats — 2026-11-03

Tous les constats ci-dessus sont corrigés (détail dans `docs/bugs.md`), sauf deux :

- estimation, articles maison, nombre d'articles, prix de promo : CHOW-111 ;
- quantité négative Calories : CHOW-112 ; scripts sur la production : CHOW-113 ;
- écriture « succès » sans ligne modifiée : CHOW-114 ; mois d'« Aliments jetés » : CHOW-115 ; ordre Calories : CHOW-116 ;
- reçus du même jour et reçus en double : CHOW-117 ; modèle de la semaine : CHOW-118 ; une cible par ligne de Courses : CHOW-119 ;
- Calories après une erreur réseau : CHOW-120 ; Stock sans retour : CHOW-121 ; noms coupés : CHOW-122 ; recherche à 5 résultats : CHOW-123 ;
- aliments sans prix de référence : l'estimation prend le dernier vrai prix payé, même ancien, puis le prix moyen en magasin ; les autres restent visibles « aucun prix connu » ;
- **non retenu** : le badge « New » des Courses reste en anglais, voulu par Olumide ;
- sans objet : titres (DM Sans partout).

## État des constats du 2026-10-31

La revue précédente relevait le mélange des quantités au poids et à la pièce, la création partielle de recettes et la pondération de l’inflation courte. Le code actuel contient les corrections correspondantes. La création d’aliments accessible à tout compte connecté est une décision produit pour RègleX, pas un défaut.
