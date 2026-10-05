# Migration React — Chow

Plan d'exécution détaillé, rédigé le 1er octobre 2026 à partir du code de
`main` au commit `194104b` (CHOW-56 inclus). Il remplace la version du
16 septembre. Aucune phase n'est implémentée ni vérifiée par ce document.

Objectif unique : remplacer le rendu EJS et les scripts `public/js/*.js` par
une application React **visuellement et fonctionnellement identique**. Même
texte, même structure HTML, mêmes classes, mêmes animations, mêmes durées,
mêmes clés `localStorage`, mêmes règles métier. La migration ne corrige aucun
bug, n'ajoute aucune fonctionnalité et ne retouche aucun style. Tout écart est
listé en section 3 et doit être validé par Olumide avant d'être appliqué.

Document compagnon : [Concepts au-delà des cours](react-migration-non-course-concepts.md).
Les numéros de leçons renvoient à l'[annexe A](#annexe-a--les-49-leçons).
La décision d'architecture reste [ADR 004](adr/004-react-recriture-complete.md),
statut « proposé » ; CHOW-50 n'est pas modifié par ce plan.

## Avancement

| Phases | État au 2026-10-02 |
|---|---|
| T1–T3, 0–12 | Faites, non commitées (branche `feat/migration-react`). 81 tests Jest, parité HTML identique sur toutes les pages capturées. |
| 13 | ⏸ Olumide : vérification complète sur iPhone et Mac (annexe B) |
| 14–15 | À faire : build de production, Docker, bascule, renommage |

---

## 0. Mode d'emploi

- Suivre les phases dans l'ordre. Une phase n'est terminée que lorsque sa
  section **Terminé quand** est entièrement remplie.
- Chaque phase distingue trois niveaux de preuve, à nommer tels quels dans
  les comptes rendus :
  - **Vérifié agent** : commande exécutée (build, Jest, requête HTTP sur la
    branche Neon dev) avec sortie lue ;
  - **Code seulement** : relu, non exécuté ;
  - **Olumide** : vérifié par Olumide sur un vrai téléphone ou navigateur.
  Aucun navigateur headless n'existe dans cet environnement : tout ce qui
  touche au rendu, au toucher, au scroll, au clavier logiciel, à la caméra et
  aux animations est **Olumide**, jamais « vérifié » par l'agent.
- L'agent enchaîne les phases sans s'arrêter, sauf aux points marqués
  **⏸ Olumide** (validation appareil, décision, commit). Il ne s'arrête pas
  pour un simple « point d'étape » non demandé, et ne saute pas non plus un
  ⏸ pour aller plus vite.
- Fin de phase : l'agent fournit les commandes `gcm` (fichiers nommés, message
  en français, sans ligne d'attribution). Olumide les exécute. Une phase = un
  commit. Jamais de push, merge ou déploiement par l'agent.
- **Parité HTML automatique** (contre l'erreur R3) : `node scripts/capturer-parite.js`
  charge chaque page EJS dans jsdom avec ses scripts exécutés, sur la branche
  Neon dev, et enregistre son `<main>`, son footer, son titre et la réponse
  `/api` correspondante (`frontend/src/__parite__/*.generated.json`, ignorés par
  Git). `npm test` compare ensuite le rendu React élément par élément. Chaque
  phase de page ajoute sa page au script et passe ce test avant le ⏸ Olumide.
  Le test ne voit ni les styles calculés ni les animations : il complète la
  vérification sur appareil, il ne la remplace pas.
- Toute découverte qui contredit ce plan (code différent de ce qui est décrit
  ici) : s'arrêter, corriger le plan d'abord, puis coder. Le code actuel fait
  foi, pas ce document.
- Un bug découvert en route n'est pas corrigé : il est signalé à Olumide et
  ajouté à la section 3 comme comportement conservé.

---

## 1. Erreurs de Check.Da.Train à ne pas reproduire

Relevées dans l'historique Git de `check-da-train`, ses documents et la
session de migration du 16 au 23 septembre 2026. Chaque erreur a une règle
Chow correspondante, appliquée dans les phases indiquées.

### 1.1 Rédaction du plan

| # | Erreur CDT | Règle Chow | Phase |
|---|---|---|---|
| P1 | Plan écrit en partie de mémoire : sens de l'animation bus inversé, paramètre démo oublié (`service=actif`), état « pluie » supposé conservé au refresh alors que le code le réinitialise. Trois relectures externes ont été nécessaires. | Chaque comportement de la section 4 cite son fichier source. Avant chaque phase, relire le template et le script concernés en entier et comparer au plan. | Toutes |
| P2 | Incohérences internes : phase 9d inexistante, références de phases fausses, « 27 icônes » suivies de 31 noms. | Aucune référence croisée sans vérification ; listes comptées. | Rédaction |
| P3 | Le document compagnon est resté décrit « render → json » alors que le plan avait changé d'approche. | Toute modification de décision met à jour les deux documents dans le même commit. | Toutes |
| P4 | Une session collaboratrice a modifié le plan pendant une relecture, sans trace. | Les modifications du plan passent par un commit séparé, annoncé dans `docs/sync-log.md` si un autre agent doit agir. | Toutes |

### 1.2 Compatibilité navigateur et build

| # | Erreur CDT | Règle Chow | Phase |
|---|---|---|---|
| B1 | `Array.prototype.at()` recopié du code serveur (Node) vers le navigateur : page blanche sur l'appareil cible. | Cible Chow = dernières versions de Safari iOS et macOS (Q1). Pas de risque d'API trop récente, mais la règle reste : le build de production est vérifié sur iPhone et Mac avant la bascule (phase 14, point 4). | 0, 14 |
| B2 | `.flatMap()` réintroduit alors que le projet l'avait déjà retiré pour la même raison. | Lire l'historique (`git log -S`) avant d'utiliser une méthode récente déjà évitée par le code. | Toutes |
| B3 | La détection automatique des polyfills a manqué un `.flat()` venu de `react-router-dom`. | Cible moderne (Q1) : ni `@vitejs/plugin-legacy`, ni `core-js`, ni polyfills. Aucune dépendance ajoutée pour d'anciens navigateurs. | 0 |
| B4 | Olumide a testé l'appareil cible sur `vite dev`, qui n'applique aucune transformation de build. Erreur « Unexpected token '.' ». | Les tests sur téléphone se font **toujours** sur le build de production servi par Express, jamais sur `vite dev`. `vite dev` reste réservé au poste de développement. | 0, 13 |
| B5 | Tests Playwright Chromium avec user-agent iPad présentés comme une vérification de l'appareil. | Un navigateur émulé n'est pas l'appareil. De toute façon, aucun navigateur n'est disponible ici : seule la colonne **Olumide** vaut vérification visuelle. | Toutes |
| B6 | Versions mélangées : certaines exactes, d'autres en `^` ; `@types/react` 19 avec React 18. | Toutes les dépendances frontend en version exacte (`--save-exact`), cohérentes entre elles, lockfile commité, installation par `npm ci`. Pas de `@types/*` sans TypeScript. | 0 |

### 1.3 Implémentation React

| # | Erreur CDT | Règle Chow | Phase |
|---|---|---|---|
| R1 | Course de requêtes sous StrictMode : un booléen en ref survivait au démontage/remontage et bloquait la vraie requête. | Une lecture = un `AbortController` créé dans l'effet et annulé dans son nettoyage. Pas de booléen « déjà chargé ». | 3 |
| R2 | Ref périmée : `setState` suivi d'un appel qui relisait l'ancienne valeur de ref mise à jour dans un effet. | Les verrous anti-double-tap sont écrits dans la ref **au moment du clic**, pas dans un effet. Les valeurs nécessaires à un appel sont passées en argument. | 3 |
| R3 | Wrapper `.grille-principale` oublié : un sélecteur CSS descendant ne s'appliquait plus. | La structure DOM est reproduite élément par élément (section 4.8). Chaque phase compare l'arbre rendu au template EJS. | 4–8 |
| R4 | `.popup-boite` doublé par un composant générique qui ajoutait son propre conteneur. | Un composant partagé n'ajoute aucun élément que le template n'a pas. | 3 |
| R5 | Animation visible au premier rendu : mesure DOM et activation de transition dans deux effets séparés. | Mesure + application dans un seul `useLayoutEffect`. Aucun élément ne doit animer au chargement d'une page si l'EJS ne l'animait pas. | 6, 7 |
| R6 | États de chargement/erreur ajoutés sans style : « Chargement » en haut à gauche, puis trois itérations sur demande. | Aucun nouvel état visible n'est inventé. Les états qui n'existent pas en EJS sont tranchés en Q2 **avant** la phase 2. | 2 |
| R7 | Arborescence trop imbriquée (`features/transport/…`, dossiers d'un seul fichier) refaite après coup. | Arborescence fixée en section 5 dès la phase 0. Un dossier n'existe qu'à partir de deux fichiers. Aucun niveau prévu pour un futur « family hub ». | 0 |
| R8 | Commentaires trop nombreux, puis « please stop over commenting ». | Une ligne maximum, en français, seulement quand le *pourquoi* n'est pas évident. | Toutes |

### 1.4 Processus, Git et déploiement

| # | Erreur CDT | Règle Chow | Phase |
|---|---|---|---|
| G1 | Toute la migration dans un seul commit de 66 fichiers. | Un commit par phase, fournis par l'agent via `gcm`. | Toutes |
| G2 | Ligne `Co-Authored-By` ajoutée au commit malgré la règle, puis messages trop longs. | Message court, préfixe `feat/fix/refactor/…`, en français, sans attribution (AGENTS.md). | Toutes |
| G3 | Le motif `.gitignore` `Icon` excluait `frontend/src/components/Icon/` : build local OK, build Fly en échec. | Chow ignore `Icon?`, `build/`, `dist/`, `*.generated.*`, `*.sql`… À chaque phase : `git check-ignore -v` sur tous les nouveaux fichiers et `git status --ignored frontend/` lus avant `gcm`. Ne nommer aucun fichier ou dossier `Icon?`. | Toutes |
| G4 | PR fusionnée avant la poussée du correctif ; Fly (relié à GitHub) a construit `main` cassé. | Fly déploie automatiquement à chaque fusion sur `main` (Q5). Aucune fusion vers `main` avant que la branche contienne tout et que l'image ait été construite. | 14, 15 |
| G5 | Suppression de la branche proposée avant fusion du dernier correctif. | Supprimer la branche seulement après vérification que `main` contient son dernier commit. | 15 |
| G6 | Déploiement lancé depuis un terminal resté sur une ancienne branche. | Les commandes de déploiement commencent par `git status` et `git log -1` dans le bon dossier. | 15 |
| G7 | Dockerfile multi-étape jamais construit localement (démon Docker absent) ; Node 24 au build, Node 20 à l'exécution ; `npm ci --production`. | Même version de Node aux deux étapes (celle du Dockerfile actuel : 22.21.1). Construction de l'image obligatoire avant bascule ; si l'agent ne peut pas la lancer, c'est un ⏸ Olumide, pas « structurellement correct ». | 14 |
| G8 | Nouvelles fonctionnalités (train mobile, seuil de retard) ajoutées sur la branche de migration. | Aucune fonctionnalité sur la branche de migration. Toute demande nouvelle va dans Jira pour après la bascule. | Toutes |
| G9 | Arrêt sans blocage réel, puis enchaînement sans les validations prévues. | Voir section 0 : arrêts uniquement aux ⏸. | Toutes |
| G10 | Documentation non mise à jour après la bascule : `architecture.md` décrit encore EJS et les scripts vanilla. | La phase 15 inclut la mise à jour de `architecture.md`, `design-system.md`, `operations.md`, `quality.md`, `README.md`, `AGENTS.md` (contexte projet) et `changelog.md`. | 15 |

---

## 2. Décisions

### 2.1 Décisions fixées

**D1 — Express garde tout le métier.** SQL, arrondis (`ROUND(... , 1)`),
calculs nutritionnels, transactions, migrations au démarrage, sessions
PostgreSQL, Passport Local, bcrypt et `scripts/creer-utilisateur.js` restent
inchangés. Pas de JWT, pas d'ORM, pas de changement de schéma.

**D2 — EJS reste en place jusqu'à la bascule.** Les routes HTML actuelles
restent intactes pendant toute la migration et servent de référence visuelle.
Les nouvelles routes `/api/*` sont **ajoutées à côté**, en partageant les mêmes
fonctions (`chercherStock`, etc.). EJS, `views/` et `public/js/` ne sont
supprimés qu'en phase 15, après la validation de parité.

**D3 — `public/css/style.css` est servi tel quel.** Le fichier n'est ni importé
par Vite, ni découpé, ni réécrit. `frontend/index.html` le charge avec le même
`<link rel="stylesheet" href="/css/style.css">` qu'aujourd'hui. Raisons :
cascade identique, URLs absolues `url("/images/svg/…")` non réécrites,
utilitaires en fin de fichier qui doivent gagner. Express continue de servir
`public/css` et `public/images` aux mêmes URLs. Le sélecteur mort reste mort
(section 3.3).

**D4 — Le DOM rendu est celui du template.** Mêmes balises, mêmes `id`, mêmes
classes, même ordre des frères, mêmes attributs visibles (`title`,
`aria-label`, `placeholder`, `min`, `step`, `autocomplete`, `required`,
`disabled`, `hidden`). Les `data-*` qui ne servaient qu'au JavaScript vanilla
peuvent disparaître, **sauf** ceux que le CSS lit : `data-for-select`,
`data-vue`, `data-a-photo`. Le test de parité lit cette liste directement
dans les feuilles de style. Le CSS
dépend d'IDs et de sélecteurs de structure (section 4.8).

**D5 — Une page React par route EJS.** Recettes reste un onglet de Calories.
Aucune nouvelle page, aucun nouveau lien, aucune page 404 maison. Une URL
inconnue garde la réponse Express actuelle.

**D6 — Chaque navigation recrée la page.** Changer de page en EJS rechargeait
tout : filtres, recherche, onglet, panneaux et articles armés repartaient de
zéro, seules les préférences `localStorage` survivaient. La route React
remonte donc sa page à chaque navigation (clé = `location.key`), y compris un
clic sur le lien de la page déjà active, qui doit relire le serveur comme un
rechargement.

**D7 — Pas de cache entre pages.** Chaque page relit le serveur à son
montage. Aucun état global de données, pas de Redux, pas de bibliothèque de
cache. Context sert uniquement à la session.

**D8 — Dernière version stable de React et React DOM, exacte.** Tranché par
Olumide le 2026-10-01 (React 19 ou plus récent au moment de la phase 0).
React 19 ignore `propTypes` : pas de package `prop-types`, la leçon 35 est lue
mais pas appliquée (phase 10). Composants fonctions partout, sauf la frontière
d'erreur (classe, toujours nécessaire en React 19). Testing Library, Jest et
le plugin React de Vite sont pris dans des versions compatibles avec cette
version de React.

**D9 — Routeur déclaratif.** `BrowserRouter`, `Routes`, `Route`, `Link`,
`NavLink`, `useParams`, `useNavigate`, `useLocation` (leçon 34). Pas de
loaders/data routers. La version exacte est choisie en phase 0 après
vérification de ses peer dependencies (dernière version stable).

**D10 — Mutations sous `/api`.** Les POST existants reçoivent un alias
`/api/...` branché sur le même gestionnaire (mêmes champs, mêmes réponses
`succes`/`erreur`/`item`). Le proxy Vite ne relaie que `/api`, `/css` et
`/images` : relayer `/stock` renverrait la navigation React vers l'EJS.

**D11 — Mêmes messages système.** `alert()`, `confirm()` et le toast gardent
exactement leurs textes, leur ordre et leurs déclencheurs (section 4.6).

**D12 — Verrous identiques.** Chaque verrou anti-double-tap existant est
reproduit avec la même granularité ; aucun verrou n'est ajouté là où il n'y en
a pas (section 3.2).

**D13 — Mutations `/api` en JSON uniquement, même origine.** Les sessions
reposent sur un cookie envoyé automatiquement par le navigateur. Aujourd'hui,
`express.urlencoded` accepte aussi un formulaire posté depuis un autre site
(risque CSRF existant, cookie sans attribut `sameSite`). Pour les routes
`/api` : toute mutation exige `Content-Type: application/json`, sinon `415`.
Un autre site ne peut envoyer ce type de requête sans pré-vérification CORS,
et l'application n'active aucun CORS. Les appels React qui n'envoient pas de
corps aujourd'hui (`/recettes/:id/supprimer`, `/courses/preset-hebdo/enregistrer`)
envoient `{}` en JSON. Les anciens chemins EJS gardent leur comportement
jusqu'à leur retrait (phase 15). Le réglage `sameSite` du cookie est Q9.

### 2.2 Questions à trancher avant la phase 0 ⏸ Olumide

| # | Question | Recommandation |
|---|---|---|
| Q1 | Appareils et navigateurs. | **Tranché (2026-10-01)** : derniers iPhone et Mac, Safari à jour. Cible de build par défaut de Vite (navigateurs récents), aucune compatibilité ancienne, aucun polyfill. La contrainte Safari 12 de Check.Da.Train ne s'applique pas. |
| Q2 | Que montrer pendant le délai de chargement que l'EJS n'avait pas, et en cas d'échec de lecture ? | **Tranché (2026-10-01)** : une icône de cuisine en SVG animé (casserole qui fume), sans texte, 144 px, centrée sous le header (taille choisie par Olumide sur aperçu). Affichée seulement si le chargement dépasse 200 ms (pas de clignotement sur une page rapide), statique si `prefers-reduced-motion`. Dessin et animation validés par Olumide sur capture avant d'être généralisés (phase 2). Échec de lecture : header + `<main><p class="no-results">Erreur serveur. Recharge la page.</p></main>`. |
| Q3 | Session expirée pendant une action. | **Tranché (2026-10-01)** : toast « Ta session a expiré. Reconnecte-toi. » (composant toast existant), puis rechargement de la page courante après 1,5 s. Sans session, le rechargement affiche la connexion, qui ramène ensuite à cette même page (`/login?retour=<chemin>`, chemin interne uniquement). L'action interrompue n'est pas rejouée. |
| Q4 | `fetchAvecRetry` rejoue les POST de Courses : un achat peut être compté deux fois dans le Stock avec le réseau du magasin. | **Tranché (2026-10-01)** : corriger le serveur avant la migration (tâche T1, §2.3). Une fois l'achat idempotent, `fetchAvecRetry` est conservé tel quel. |
| Q5 | Fly déploie-t-il automatiquement à la fusion sur `main` ? | **Tranché (2026-10-01)** : oui. Toute fusion sur `main` est un déploiement en production et exécute les migrations au démarrage. Aucune fusion de la branche de migration avant la phase 15. |
| Q6 | `.dockerignore` est vide : `COPY . .` place `.env`, `.git`, `node_modules` et `docs/` dans l'image. | **Tranché (2026-10-01)** : corriger avant la migration (tâche T2, §2.3). |
| Q7 | Retour arrière (geste de bord ou flèche ‹ de Safari) : retrouver la position de défilement ? | **Tranché (2026-10-01)** : oui. Retour/avance → position restaurée une fois les données de la page affichées ; nouvelle navigation → haut de page (phase 2, point 5). |
| Q8 | `POST /recettes/depuis-journal` n'est appelé par aucune interface (« Enregistrer comme recette » passe par `/recettes/creer`). | **Tranché (2026-10-01)** : pas d'alias `/api`, route conservée telle quelle, y compris après la bascule (seule exception de la phase 15, point 1). |
| Q9 | Cookie de session sans `sameSite` explicite (`index.js`, `cookie: { maxAge }`). | **Tranché (2026-10-01)** : renforcer et ne jamais déconnecter. `sameSite: "lax"`, `httpOnly: true`, `secure: true` en production avec `app.set("trust proxy", 1)`, et `rolling: true` (les 360 jours repartent à chaque visite). Fait avant la migration (tâche T3, §2.3). Les sessions existantes restent valides. |
| Q10 | Nom de l'application Fly après le renommage en « chow » : `chow` est déjà pris sur Fly. | À trancher avant la phase 15 : garder `chow-ejs` (rien à faire, adresse inchangée) ou créer une nouvelle application (ex. `chow-maison`), y recopier les secrets et changer l'adresse utilisée sur les téléphones. |

### 2.3 Tâches préalables, sur l'application EJS actuelle

Faites le 2026-10-01 dans le code EJS, avant la phase 0. Décision d'Olumide :
elles ne sont pas commitées séparément mais partent avec la branche de
migration, avec le correctif d'en-tête de rayon et le renommage Cuisine. Elles
n'atteignent donc la production qu'à la bascule (phase 15).

| Tâche | État |
|---|---|
| T1 | Fait, vérifié sur Neon dev (Vérifié agent) ; BFV Olumide en attente |
| T2 | Fichier créé ; image non construite (pas de démon Docker local) : à vérifier au premier build |
| T3 | Fait, cookie vérifié en local (`HttpOnly; SameSite=Lax`, expiration renouvelée) ; `Secure` à vérifier en production |

**T1 — Achat compté deux fois (Q4).** `POST /courses/acheter` ajoute la
quantité au Stock puis passe `achete` à `true`, sans vérifier si l'article
était déjà acheté ni utiliser de transaction. Si la réponse se perd et que
`fetchAvecRetry` renvoie la requête, le Stock est augmenté deux fois.
Correction : dans une transaction, commencer par
`UPDATE courses SET achete = true, photo = NULL WHERE id = $1 AND achete = false RETURNING food_id`.
Aucune ligne → l'achat a déjà eu lieu : répondre `{ succes: true }` sans
toucher au Stock. Sinon, mettre le Stock à jour comme aujourd'hui, puis
`COMMIT` ; `ROLLBACK` en cas d'erreur. Un double tap ou deux téléphones sur le
même article donnent alors un seul ajout. Vérification : deux POST identiques
sur la branche Neon dev → Stock augmenté une fois. Requête pour la branche production fournie
si des données de production doivent être corrigées.

**T2 — `.dockerignore` (Q6).** Créer le fichier avec au minimum : `.env`,
`.env.*`, `.git`, `node_modules`, `frontend/node_modules`, `frontend/dist`,
`docs`, `AGENTS.md`, `.claude`, `.vscode`, `.DS_Store`. Vérification :
l'image construite ne contient plus `.env` ; l'application démarre avec les
secrets Fly. Les secrets déjà présents dans d'anciennes images restent à
évaluer avec Olumide (rotation de `SECRET_KEY` et du mot de passe Neon si
une image a pu être exposée).

**T3 — Session permanente et cookie renforcé (Q9).** Dans `index.js`,
options de session : `rolling: true` (le cookie et l'expiration en base sont
renouvelés à chaque requête : utilisée au moins une fois tous les 360 jours,
l'application ne déconnecte jamais) ; `cookie` : `maxAge` inchangé,
`sameSite: "lax"`, `httpOnly: true`, `secure` seulement si
`process.env.NODE_ENV === "production"` (le Dockerfile le définit), avec
`app.set("trust proxy", 1)` avant la session (Fly termine le HTTPS). Le HTTP
local continue de fonctionner. Vérification : en-tête `Set-Cookie` lu en
local, puis connexion maintenue en production après déploiement (Olumide).

### 2.4 Après la bascule

Demandes d'Olumide reportées, à ouvrir en tickets séparés après la phase 15 :

- glisser-déposer des cartes (Cuisine et ingrédients de recette) à la place
  des flèches ↑/↓, avec une bibliothèque tactile React ;
- article ajouté deux fois dans Courses quand `fetchAvecRetry` rejoue
  `POST /courses/ajouter` ;
- TypeScript (phase 10) ;
- les comportements conservés de la section 3.2.

---

## 3. Écarts et comportements conservés

### 3.1 Écarts inévitables (à approuver un par un)

| Écart | Cause | Traitement |
|---|---|---|
| Délai de chargement après le header | Les données arrivent après le premier rendu | Q2 |
| 401 → `/login` pendant une action | Fetch JSON au lieu de pages | Q3 |
| Position de défilement au retour arrière | Données asynchrones : restauration à reproduire en JS | Q7 |
| Erreur de lecture d'une page | « Internal Server Error » brut en EJS | Q2 |
| Toast encore visible juste après navigation | Le rechargement EJS effaçait `#toastReseau` | Le toast est effacé à chaque navigation |
| Listes de sélecteur ouvertes pendant une navigation | Idem | Fermées à chaque navigation |
| En-têtes de rayon (tri Catégorie) dérivés de la liste | `courses.js` ne reconstruisait les en-têtes qu'au changement de tri : un article ajouté en mode Catégorie tombait sous l'en-tête du rayon suivant (même famille que le bug d'en-tête vide corrigé le 2026-10-01) | Corrigé dans React, accepté par Olumide avec le correctif d'en-tête vide |

### 3.2 Comportements actuels conservés tels quels

Ces comportements sont discutables ou bogués. Ils sont **reproduits**, puis
proposés en tickets séparés après la bascule. Les corriger pendant la
migration rendrait la comparaison EJS/React impossible.

1. **Courses, Entrée** : le champ caché `idAlimentCacheCourses` n'est jamais
   rempli. Entrée ajoute donc toujours le texte tapé en article libre, même
   si une suggestion correspond.
2. **Recettes, ordre des ingrédients** : `GET /recettes/:id` trie par
   `foods.nom`. L'ordre réarrangé et enregistré n'apparaît ni en lecture ni à
   la réouverture en édition.
3. **Stock, filtres** : recliquer le filtre actif ne le désactive pas, malgré
   le commentaire du template qui l'affirme.
4. **Stock, nouvel article** : `deja_en_courses` est forcé à `false` même si
   l'aliment est déjà dans Courses.
5. **Ordre des suggestions** : Stock, Courses et Cuisine affichent les
   aliments dans l'ordre de `SELECT * FROM foods` (aucun `ORDER BY`). React ne
   trie pas ces listes. Seule la recherche d'ingrédient du panneau recette est
   triée (`alimentsTries`).
6. **Pas de bouton de déconnexion** dans l'interface. `POST /logout` existe
   sans lien. Ne pas en ajouter.
7. **Page de connexion** : elle inclut le header complet avec la navigation.
8. **Requêtes sans gestion d'échec réseau** (échec silencieux, bouton parfois
   bloqué) : Stock modifier/supprimer/« Ajouter aux courses », Cuisine
   modifier/supprimer/vider/déplacer, lecture et suppression de recette,
   équivalences. Les requêtes qui ont un `.catch` gardent exactement le leur.
9. **Verrous absents** : suppression Cuisine/Stock, modification de quantité,
   réordonnancement, application de recette, équivalences.
10. **Réordonnancement Cuisine optimiste** : pas de retour arrière si le
    serveur répond une erreur.
11. **Application de recette sans confirmation** : choisir une recette
    remplace immédiatement la Cuisine.
12. **Animations** : `.journal-item.entree`, `#autocomplete.entree` et
    `#rechercheStockWrapper.entree` n'ont pas de règle CSS. La classe est
    quand même posée. `popOutSuccess` dure 0,35 s mais la carte est retirée
    à 300 ms.
13. **Valeurs numériques affichées brutes** : la fiche Aliment, les cartes
    recette et le badge Stock affichent les chaînes PostgreSQL telles quelles
    (`NUMERIC`, `COUNT`). Ne pas passer par `Number()` pour les afficher.
14. **Jour de la Cuisine** : `CURRENT_DATE` du serveur PostgreSQL, pas le jour
    du téléphone.
15. **Enregistrer une recette** : le bouton exige 2 ingrédients alors que le
    message d'erreur parle d'« au moins un ingrédient ».
16. **Courses, refus serveur** : `fetchAvecRetry` traite toute réponse non 2xx
    comme une panne. Une erreur métier (400 avec `erreur`) est donc réessayée
    puis affichée comme « Connexion instable… », jamais en `alert`.

### 3.3 Incohérences de documentation à signaler (non corrigées ici)

- `docs/product.md` cite une catégorie de recette « Glace » : le code n'a que
  `plat` et `fraicheur` (Fraîcheur = boissons + glaces).
- CSS mort, à garder dans le fichier : `#formAjouterStock`, `#champQuantite`,
  `#champCL`, `#btnAjouter`.
- La version du 16 septembre de ce plan contenait des erreurs, corrigées ici :
  groupe de recettes « Glace », « consultation via œil », exclusion des
  aliments déjà présents dans les suggestions, bouton de déconnexion dans le
  shell, page « introuvable » React.

---

## 4. Inventaire de parité

Source de vérité : les fichiers cités. Recopier les textes depuis les
templates, ne pas les retaper.

### 4.1 Document et shell (`views/partials/header.ejs`, `footer.ejs`)

| Élément | Détail à reproduire |
|---|---|
| `<html lang="fr">`, `charset` | Identiques |
| Viewport | `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=1` |
| Titre | `Chow — <titre>` : Accueil, Connexion, Aliments, nom de l'aliment, « Aliment introuvable », Stock, Courses, Calories |
| Favicon | Data URI SVG recopié octet pour octet |
| Polices | `preconnect` + Google Fonts Playfair Display 700/900, DM Sans 300/400/500, `display=swap` |
| CSS | `<link rel="stylesheet" href="/css/style.css">` (D3) |
| Header | `header.header > div.header__inner > a.logo[href=/]` « Chow » + `nav.nav` |
| Navigation | Aliments, Stock, Courses, Calories ; classe `actif` si le chemin **commence par** `/aliments`, `/stock`, `/courses`, `/calories` (détail aliment inclus). Ordre des classes : `nav__link actif` |
| `--header-h` | `header.offsetHeight + "px"` sur `documentElement`, au montage et à chaque `resize` |
| Anti-zoom au blur | Écoute `blur` en **capture** sur `document` ; si la cible est `input, select, textarea`, ajouter `, user-scalable=0` au viewport puis restaurer après 300 ms |
| Footer | `footer.footer > p` « Chow — Fait maison 🏠 » |
| Sélecteurs globaux | Fermeture au clic n'importe où, au scroll (capture, sauf scroll interne d'une liste) et à Échap |

### 4.2 Routes serveur et contrats

| Route EJS actuelle | Données | Alias/lecture React |
|---|---|---|
| `GET /login` | `erreur` si `?erreur=1` | Page React `/login` |
| `POST /login` | Redirige `/` ou `/login?erreur=1` | `POST /api/login` → `{succes, utilisateur:{id,email}}` ou 401 `{erreur:"Email ou mot de passe incorrect."}` |
| `POST /logout` | Redirige `/login` | `POST /api/logout` (aucune interface, §3.2-6) |
| `GET /` | — | Page React `/` |
| `GET /aliments` | `chercherAliments()` | `GET /api/aliments` → `{aliments}` |
| `GET /aliments/:id` | `SELECT * FROM foods WHERE id` ; 404 si absent | `GET /api/aliments/:id` → `{aliment}` ou 404 `{erreur:"Aliment introuvable."}` |
| `POST /aliments/:id/equivalences` | JSON | `POST /api/aliments/:id/equivalences` |
| `GET /stock` | `chercherStock()`, `chercherAliments()` | `GET /api/stock` → `{stock, aliments}` |
| `POST /stock/ajouter`, `/modifier`, `/supprimer` | JSON | `/api/stock/...` |
| `GET /courses` | courses, aliments, stock, `presetHebdo` | `GET /api/courses` → `{courses, aliments, stock, presetHebdo}` |
| `POST /courses/ajouter`, `/preset-hebdo`, `/preset-hebdo/enregistrer`, `/commentaire`, `/photo`, `/photo/supprimer`, `/supprimer`, `/acheter` | JSON | `/api/courses/...` |
| `GET /courses/:id/photo` | JPEG binaire, 404 texte | `GET /api/courses/:id/photo` |
| `GET /calories` | journal, aliments, recettes | `GET /api/calories` → `{journal, aliments, recettes}` |
| `POST /calories/ajouter`, `/modifier`, `/supprimer`, `/deplacer`, `/vider`, `/ajouter-recette` | JSON | `/api/calories/...` |
| `GET /recettes/:id` | JSON | `GET /api/recettes/:id` |
| `POST /recettes/creer`, `/:id/modifier`, `/:id/supprimer` | JSON | `/api/recettes/...` |
| `POST /recettes/depuis-journal` | JSON, inutilisé | Pas d'alias (Q8) |
| Ajouté | — | `GET /api/session` → `{utilisateur:{id,email}}` ou 401 |

Règles :

- Login API et session API **avant** `requireAuth`. Pour les chemins `/api/*`,
  `requireAuth` répond `401 {erreur:"Non connecté."}` au lieu de rediriger.
- Ne jamais sérialiser l'objet `users` complet : il contient le hash.
- Conserver `express.json({ limit: "4mb" })` (photos base64).
- Types renvoyés par `pg` : `NUMERIC` et `COUNT` en **chaînes**, `BOOLEAN` en
  booléens, dates en ISO. `stock.quantite` est du texte (`"3"`, `"plein"`,
  `"à moitié"`…). Le frontend convertit au moment du calcul seulement, jamais
  à l'affichage d'une valeur brute (§3.2-13).
- Les réponses d'erreur gardent leurs codes actuels (400 pour un « Article
  introuvable », par exemple).

### 4.3 Accueil (`views/index.ejs`) et Connexion (`views/login.ejs`)

**Accueil** : `main > section.hero > div.hero__text` (h1 « Bienvenue sur
<span>Chow</span> », p « Ton hub alimentaire maison. »), puis
`section.grid-section > div.home-links` avec quatre `a.home-link-card`
(emoji, titre, description) vers les quatre pages. Animation `fadeIn` par CSS.

**Connexion** : `div.page-header` (h1 « Content de te <span>revoir.</span> »,
description, `p.erreur` « Email ou mot de passe incorrect. » si erreur), puis
`div.login-carte > form.login-form` : labels Email / Mot de passe, inputs
`type=email name=email id=email autocomplete=email required` et
`type=password name=password id=password autocomplete=current-password required`,
bouton `button.btn-connexion` « Se connecter ». La soumission native doit
rester possible (`required`, gestionnaires de mots de passe) : `onSubmit`
empêche l'envoi par défaut puis appelle `/api/login`. En cas d'échec, l'URL
devient `/login?erreur=1` comme aujourd'hui. Après succès : `/`.

### 4.4 Aliments (`views/aliments.ejs`, `public/js/aliments.js`)

- Hero : h1 « Mieux manger <span>commence ici.</span> », phrase avec
  `aliments.length`, `div.hero__badge` (nombre + `small` « Aliments »,
  rotation `rotate-slow`). Le badge compte **tous** les aliments.
- Filtres : `div.filters > div.filters__inner > div.filter-buttons` ; « Tous »
  `active` puis une catégorie par bouton, `[...new Set(categories)].sort()`.
  Choix unique.
- Recherche `#searchInput` + bouton d'effacement (§4.10) ; tri `#sortSelect`
  (Nom ↗/↘, Calories ↗/↘, Protéines ↗/↘), défaut `nom-asc`.
- Grille `#foodGrid` de `a.food-card` vers `/aliments/:id`, emoji dans
  `.food-card__img-placeholder` (jamais la photo), nom, catégorie.
- Filtrage : catégorie ET recherche (`normaliserTexte` NFD + suppression des
  diacritiques, minuscules, `trim`) sur le nom en minuscules. Les cartes
  masquées reçoivent `.hidden` (pas de démontage). `#noResults` visible si zéro
  carte ; `#searchInput.recherche-invalide` seulement si la recherche est non
  vide et sans résultat.
- Tri : nom par `localeCompare` sur le nom en minuscules ; calories/protéines
  par `Number()` ; tri stable sur l'ordre courant, appliqué au chargement.

**Détail** (`views/aliment-detail.ejs`, `public/js/aliment-detail.js`) :

- `a.btn-retour` « ← Retour aux aliments » vers `/aliments` (lien, pas
  `history.back`).
- Image `/<aliment.image>` si présente, sinon emoji ; catégorie, nom, origine
  et description seulement si présents ; quatre `macro-card` aux valeurs
  brutes (`kcal`, `g`).
- `details.detail-equivalences` fermé par défaut ; deux inputs `number`
  `min=0 step=0.1 placeholder=g`, valeur vide si `NULL`. Sauvegarde sur
  `change`, chaîne vide envoyée telle quelle (le serveur stocke `NULL`).
  Succès : `#equivStatut` visible 2 s, minuteur relancé à chaque succès.
  Erreur métier : `alert`. Échec réseau : silencieux (§3.2-8).
- Id inconnu : statut 404, titre « Aliment introuvable », `p.not-found`.

### 4.5 Stock (`views/stock.ejs`, `public/js/stock.js`)

Structure : `div.page-header` (textes, `p.erreur` jamais alimenté), filtres,
`div.stock-section` contenant dans l'ordre `#ajoutBackdropStock`,
`.search-ajout-row`, `.search-sort-wrapper`, `#listeStock`, `#noResultsStock`.

- **Filtres** : un seul groupe à choix unique : Tous / 🧊 Frigo / ❄️ Congélateur
  / 📦 Réserve (`emplacement`) puis 🫙 Niveau (`cl`) / 🔢 Pièces (tout sauf
  `cl`). Choisir un emplacement remet le type à « tous » et inversement.
- **Recherche** `#searchInput` dans `#rechercheStockWrapper` ; même
  normalisation et même `recherche-invalide` qu'Aliments.
- **Ajout** : `#btnToggleAjout` alterne `#rechercheStockWrapper` et
  `#autocomplete` (attribut `hidden`, jamais les deux). Ouverture : classe
  `entree` rejouée, `actif` sur le bouton, `ouvert` sur le backdrop, le champ
  reprend le texte de la recherche du stock, `focus()` + `select()`, puis
  filtrage immédiat. Fermeture : clic backdrop, clic hors `#autocomplete` et
  hors bouton, choix d'une suggestion. Elle vide le champ et masque la liste.
- **Suggestions** `#listeAliments` (ordre SQL) : `li` « emoji nom ». Liste
  masquée si champ vide ; `recherche-invalide` si zéro résultat.
- **Choix** : si un article du stock porte le **même nom en minuscules** :
  toast « Déjà dans le stock. », mise en avant (filtres remis à Tous,
  recherche vidée, `scrollIntoView({behavior:"smooth", block:"center"})`,
  `.mise-en-avant` 1 500 ms). Sinon verrou par `food_id`, quantité de départ
  `"plein"` pour `cl` sinon `1`, POST, ajout de la carte, `entree`, tri
  courant, filtres courants, puis mise en avant si visible. Échec réseau :
  toast « Connexion instable : réessaie dans un instant. ».
- **Carte** `div.stock-item.carte-article` : image `/<image>` ou emoji,
  `.stock-item__body > .stock-item__infos` (nom, ligne meta « Frigo |
  aujourd'hui / il y a 1 jour / il y a N jours »), `.stock-editable-zone` (barre
  `cl` avec `niveau-plein|moitie|presque-vide|vide` et `title`, sinon
  `span.stock-quantite`), puis `form.form-supprimer-stock` avec
  `button.btn-supprimer-icone.btn-supprimer-dash`.
- **Tri** `#sortSelect` : Nom (alpha), Ancien, Récent, Quantité ↗/↘ ;
  quantité `cl` par rang (vide 0 → plein 3), égalité départagée par nom.
- **Vue** : `#btnVueGrille`/`#btnVueListe`, classe `vue-liste` sur
  `#listeStock`, clé `localStorage` `vueStock` (`"liste"` sinon grille).
- **Édition** : un seul article ouvert. Clic sur la carte ouvre (et ferme +
  sauvegarde l'autre) ; reclic ferme et sauvegarde. Clics ignorés : formulaire
  de suppression, champ d'édition, sélecteur personnalisé. Clic hors de toute
  carte : ferme et sauvegarde. `cl` → `select.stock-cl-edit.anim-fondu`
  (Plein / À moitié / Presque vide / Vide). Sinon
  `div.stock-edition-ligne > input.stock-quantite-edit.anim-fondu`
  (`number`, `min=0`, `step=1`, focus + select) et
  `zone.stock-edition-colonne`. Bouton `btn-ajouter-courses` si la quantité
  est basse (`cl` : presque vide/vide ; sinon `< 2`) et pas déjà en courses.
  Boutons `.stock-quick-subtract > button.suggestion` « − 1/2/5 » seulement
  pour les valeurs ≤ quantité ; un clic soustrait, sauvegarde et ferme.
- **Sauvegarde** : valeur vide ou inchangée → retour à l'affichage sans
  requête. Sinon POST ; erreur → `alert` puis valeur précédente ; succès →
  nouvelle valeur, `maj-flash` 600 ms.
- **Ajouter aux courses** : stoppe la propagation, désactive le bouton, POST
  `/courses/ajouter` ; succès → `disparait` puis retrait après 200 ms ; erreur
  → `alert` et réactivation.
- **Suppression** : POST, `disparait`, retrait après 300 ms.

### 4.6 Courses (`views/courses.ejs`, `public/js/courses.js`)

Ordre DOM : `section.hero#heroCourses` (textes, `#badgeCoursesContainer >
#badgeNbCourses`), `p.erreur` conditionnel, `div.courses-section` avec
`.courses-controls-row > .courses-controls-row__inner` (tri, `#toggleMagasin`,
`#badgeCoursesAncre`, `#btnToggleAjoutCourse`), `.preset-hebdo-row`,
`#listeCourses` (articles, en-têtes de catégorie, puis `#panneauAjoutCourse`
**toujours dernier enfant**), `#noResultsCourses`, `#inputPhotoCourse`,
`#photoBackdrop`.

- **Badge** : nombre de `.course-item` (masquées incluses). Animation
  seulement si le nombre change : `badge-pop` (ajout, achat) ou `badge-shake`
  (suppression), relancée même coup sur coup.
- **Badge mobile** : `IntersectionObserver` sur le hero, `rootMargin`
  = `-(--header-h + hauteur de la barre)px`, calculé une fois au montage. Hero
  hors champ → le badge passe juste après `#badgeCoursesAncre` avec
  `.badge-courses-toolbar`, largeur/hauteur = hauteur du bouton de tri
  (`34` par défaut), `paddingBottom = taille × 8/65` (1 décimale). Retour →
  styles effacés. Transition FLIP `transform 0.4s cubic-bezier(0.34, 1.56,
  0.64, 1)`, désactivée si `prefers-reduced-motion`.
- **Tri** `#sortSelectCourses` Nom/Catégorie : tri stable par clé seule
  (`nom` en minuscules ou catégorie, `zzz` si absente). En mode Catégorie,
  `p.course-categorie-entete` avant chaque groupe (« Autres » pour `zzz`).
  Nouvel article inséré avant le premier article dont la clé est supérieure,
  sinon avant le panneau.
- **Mode magasin** : `#toggleMagasin.actif`, classe `mode-magasin` sur
  `body`, clé `modeMagasin` (`"true"`/`"false"`). Quitter le mode remet tous
  les rayons cochés. **La classe `body` est retirée en quittant la page.**
- **Filtres par rayon** (`#courseFiltresMagasin`) : « Tous » + rayons triés
  (`zzz` → « Autres »). Tous cochés au départ. Règles exactes de
  `activerBoutonFiltreCourses` : « Tous » bascule tout/rien ; un rayon cliqué
  alors que tout est coché devient le seul ; sinon bascule. « Tous » actif
  seul quand tout est coché. Un rayon apparu après le chargement reçoit une
  puce cochée ; un rayon vidé perd sa puce. Un article dont le rayon n'a pas de
  puce n'est jamais filtré.
- **Preset** : `#btnPresetHebdo` « 🧺 Semaine » ajoute les manquants ; zéro
  ajout → `alert("Tout est déjà dans la liste de courses.")`.
  `#btnEnregistrerPresetHebdo` caché sous 5 articles, désactivé si la liste
  égale le preset (clés `f:<food_id>` ou `n:<nom en minuscules>`), `confirm`
  avant envoi, `.confirme` 1 500 ms après succès, preset local mis à jour.
- **Panneau d'ajout** : `.ouvert` + bouton `.actif`, `scrollIntoView` centré,
  focus ; `.pret` ajouté au `transitionend` de `grid-template-rows`. Fermeture
  par reclic ou clic extérieur ; elle vide le texte, masque liste et bouton
  « Ajouter ».
- **Recherche** : vide → liste et « Ajouter » masqués. Sinon filtrage ;
  « Ajouter » visible et `recherche-invalide` seulement si aucune
  correspondance. Clic hors `#autocompleteCourses` masque la liste.
- **Choix d'une suggestion** : ferme le panneau ; déjà présent (même
  `food_id`) → toast « Déjà dans la liste de courses. » + mise en avant ;
  sinon ajout. Entrée ou « Ajouter » : article libre (§3.2-1). Verrou unique
  `ajoutArticleEnCours`.
- **Carte** : pastille de stock (nombre, ou point `cl` coloré), `span.course-nom
  > span.course-nom-emoji` + nom, `form.form-supprimer`, `p.note-affichee`
  (si note), `.ligne-commentaire.hidden` (input note + bouton photo sans
  photo), formulaire d'achat (trois variantes : `cl`, quantité avec
  +1/+2/+5 et champ, article libre), bouton photo en dernier enfant **s'il y a
  une photo**.
- **Armement** : un seul écouteur global, logique exacte du script : clic
  hors carte → désarme ; clic sur emoji, note, champ note, suppression,
  groupe quantité ou bouton photo → désarme seulement une **autre** carte ;
  sinon bascule l'armement et joue `vient-de-s-activer` 350 ms sur le panier.
- **Quantité** : « Acheté » désactivé tant que le champ est vide ou `< 1` ;
  `vient-de-s-activer` au passage à actif ; +1/+2/+5 remplit et soumet.
- **Achat/suppression** : bouton désactivé pendant l'envoi ; erreur métier →
  `alert` + réactivation ; échec réseau → toast + réactivation. Succès :
  cache photo local supprimé, `disparait-achete` ou `disparait-supprimer`,
  retrait à 300 ms, puis en-têtes de rayon devenus vides, preset, état vide,
  badge, puces.
- **Notes** : seul l'emoji ou la note affichée ouvre le champ (masquage de la
  note en 150 ms, focus). Au `blur` : masquage 150 ms ; inchangé → réaffiche ;
  vide → POST vide et retrait de la note ; sinon POST et note mise à jour
  avant la ligne. Mise à jour optimiste, toast si échec.
- **Photos** : un seul `input[type=file][accept="image/*"]` partagé, valeur
  vidée avant chaque ouverture. Compression : max 1 600 px sur le plus grand
  côté, JPEG qualité 0.9, base64 sans préfixe. `photo-pop` à chaque tap et
  après envoi. Cache `localStorage` `chow-photo-course-<id>` lu en premier,
  sinon `/courses/<id>/photo?t=<Date.now()>`. Échec de quota ignoré.
  Préchargement des photos non cachées au montage. Fermeture de l'aperçu :
  animation vers le bouton (`--vers-x`, `--vers-y`, `.fermeture` 350 ms) sauf
  reduced-motion. Suppression : fermeture, cache supprimé, puis 300 ms →
  `oeil-fermeture` → 300 ms → bouton replacé dans la ligne de note.
- **Réseau** : `fetchAvecRetry` (un réessai à 800 ms, statut non-OK compris)
  pour ajout, preset, notes, photos, achat et suppression ; toast en échec.
  L'achat est rendu idempotent côté serveur avant la migration (T1).

### 4.7 Calories et Recettes (`views/calories.ejs`, `public/js/calories.js`)

- **Totaux** : `.journal-totaux-sentinel` puis `.journal-totaux` (kcal
  `toFixed(0)`, macros `toFixed(1) + "g"`), recalculés depuis les entrées non
  `.disparait`. Mobile `≤ 768px` : `.compacte` quand la sentinelle passe sous
  `--header-h` (57 par défaut), recalculé au scroll (passif) et au resize.
- **Onglets** : Cuisine (ex-« Journal », renommé le 2026-10-01 ; classes, IDs et
  `data-tab="journal"` inchangés) actif par défaut, aucune persistance.
- **Recherche** `#rechercheAlimentCalories` (ordre SQL) : même filtrage ; clic
  hors `#autocompleteCalories` masque. Choix : vide le champ ; déjà présent →
  toast « Déjà en cuisine aujourd'hui. » + mise en avant ; sinon verrou
  par `food_id` et ajout de 100 g en fin de liste. Échec réseau : toast.
- **Sélecteurs de recette** `#selectRecettePlat`, `#selectRecetteFraicheur` :
  option vide d'abord (texte « Aucune recette de plat/fraîcheur » s'il n'y en
  a aucune, avec `disabled` et `title`), puis recettes triées par nom. Choisir
  remplace la Cuisine (sans confirmation), remet la valeur vide. Échec réseau :
  `alert("Une erreur est survenue.")`.
- **Tout effacer** `#btnToutEffacer` : `confirm("Vider la cuisine
  d'aujourd'hui ?")`, toutes les lignes `disparait`, totaux immédiats, liste
  vidée à 300 ms.
- **Enregistrer comme recette** `#btnEnregistrerRecette` : visible si 3
  aliments distincts ou plus et aucune recette n'a exactement le même
  ensemble de `food_id`. Ouvre le panneau pré-rempli (nom affiché avec emoji,
  quantités en grammes).
- **Ligne de Cuisine** : `.reorder-controls` (monter/descendre, cachés par
  `visibility` et désactivés aux extrémités), nom avec emoji, catégorie, input
  `number step=any min=0.25` (valeur `parseFloat`), sélecteur d'unité **toujours
  présent** (`g`, puis `tsp`/`tbs` si équivalence, puis pièce avec
  `unite_piece || "pc"` si `tracking_type === "unite"` et
  `parseFloat(poids_unite_g) > 0`), kcal `toFixed(0)`, formulaire de retrait.
- **Unités** : la donnée reste en grammes. Changer d'unité convertit l'affichage
  (`round(g / ratio, 2)`) et `min = round(0.25 / ratio, 4)` sans requête.
  `change` sur la quantité envoie `valeur × ratio` ; valeur invalide ignorée.
  Succès : macros mises à jour depuis la réponse.
- **Réordonnancement** : FLIP `transform 0.25s cubic-bezier(0.34, 1.56, 0.64,
  1)`, mise à jour des boutons, POST `deplacer` (§3.2-10).
- **Retrait** : `disparait`, totaux immédiats, retrait à 300 ms.
- **Grilles de recettes** : deux sections fixes, Plats puis Fraîcheur, chacune
  avec icônes de tri (nom/kcal, asc par défaut, reclic inverse, image
  `tri-alpha-asc/desc` ou `calorie-asc/desc`) et vue grille/liste (clés
  `vueRecettes-plat`, `vueRecettes-fraicheur`). Carte : 3 premiers emojis
  d'ingrédients ou icône de catégorie, nom, « N ingr. », « N kcal ». Carte
  « Nouvelle recette » toujours dernière.
- **Panneau** `#sheet` + `#sheetBackdrop` : `ouvert`, `scrollTop = 0`,
  `body.scroll-bloque` (retiré en quittant la page). Fermeture par ✕ (deux
  boutons) ou backdrop, pas par Échap. Lecture : fetch, nom, méta « N
  ingrédient(s) · N kcal » depuis la carte, ingrédients `emoji nom N g`,
  étapes en `ol` (lignes non vides) ou message vide. ✎ passe en édition.
- **Édition/création** : `reinitialiserSheet()` est la référence ; catégorie
  par pastilles ; `+` déplie `#autocompleteIngredient` (`.replie`, puis
  `.pret` et `.recherche-ouverte` au `transitionend` de `max-height`), défile
  la liste interne, focus. Ingrédient déjà présent : focus sur sa quantité.
  Ligne : réordre local, nom, quantité (`step=any min=0.25 placeholder=g`),
  unité, retrait (`disparait` 300 ms). « Enregistrer » désactivé sous 2
  ingrédients. Entrée dans le nom bloquée en édition seulement. `required` sur
  le nom. Envoi verrouillé (« Enregistrement… »), payload en grammes, mise à jour
  de la carte, des options triées, du sélecteur réactivé, du tri de section et
  de la liste locale des recettes. Suppression : `confirm("Supprimer cette
  recette ?")`, carte `disparait`, options retirées, panneau fermé.

### 4.8 CSS dépendant de la structure

Ces règles cassent silencieusement si le DOM diffère :

| Sélecteur | Contrainte |
|---|---|
| `#listeCourses > *:not(.panneau-ajout):last-child` | Le panneau d'ajout est le dernier enfant de la liste |
| `.course-categorie-entete:first-child` | En-têtes enfants directs de `#listeCourses` |
| `#selectRecettePlat + .custom-select`, `#selectRecetteFraicheur + .custom-select` | Le `select` natif est **immédiatement suivi** de `div.custom-select` |
| `.custom-select__list[data-for-select="…"]` | La liste ouverte porte `data-for-select` = id du select |
| `.recette-vue-icone[data-vue="grille" / "liste"]` | Les boutons de vue des recettes portent `data-vue` : sans lui, aucune icône (oubli repéré par Olumide le 2026-10-02) |
| `.btn-photo-course[data-a-photo="true"]` | Le bouton photo porte `data-a-photo` : il choisit l'icône télécharger ou œil |
| `body.mode-magasin …` | Classe sur `body`, pas sur un conteneur React |
| `.scroll-bloque` | Classe sur `body` |
| `.recette-groupe:last-child`, `.recette-lecture-ingredients li:last-child`, `.journal-totaux .macro-card:last-child` | Pas d'élément supplémentaire en fin de conteneur |
| IDs utilisés par le CSS | `#searchInput`, `#sortSelect`, `#listeStock`, `#autocomplete`, `#rechercheAliment`, `#listeAliments`, `#listeCourses`, `#autocompleteCourses`, `#rechercheAlimentCourses`, `#listeAlimentsCourses`, `#btnAjouterCourse`, `#formAjouterCourse`, `#panneauAjoutCourse`, `#badgeCoursesAncre`, `#autocompleteCalories`, `#rechercheAlimentCalories`, `#listeAlimentsCalories`, `#listeJournal`, `#formRecette`, `#btnEnregistrerSheet`, `#listeIngredientsRecette`, `#autocompleteIngredient`, `#rechercheIngredient`, `#listeIngredientsRecherche`, `#selectRecettePlat`, `#selectRecetteFraicheur` |
| `.hidden` (utilitaire) et attribut `hidden` | Conserver le mécanisme exact de chaque élément : classe pour l'un, attribut pour l'autre |

### 4.9 Animations

| Classe | Keyframe / transition | Durée CSS | Retrait JS |
|---|---|---|---|
| `.home-link-card`, cartes | `fadeIn` | 0,35 s | — |
| `.hero__badge` | `rotate-slow` | 12 s infini | — |
| `.badge-pop` / `.badge-shake` | `badgeSacPop` / `badgeSacShake` | 0,4 s | relancée par reflow |
| `.entree` (course, stock, ingrédient) | `popIn` | 0,35 s | `animationend` |
| `.disparait*` | `slideOutLeft` / `popOutSuccess` | 0,3 / 0,35 s | retrait DOM 300 ms |
| `.note-affichee`, `.ligne-commentaire` visibles | `slideDownNote` | 0,18 s | — |
| `.masquage`, `.masquage-input` | `fadeOutNote` | 0,15 s | 150 ms |
| `.maj-flash` | `flashMaj` | 0,6 s | 600 ms |
| `.mise-en-avant` | `pulseMiseEnAvant` | 1,5 s | 1 500 ms |
| `.vient-de-s-activer` | `popActivation` | 0,35 s | 350 ms |
| `.anim-fondu` | `stockFondu` | 0,15 s | — |
| `.photo-pop` | `badgeSacPop` | 0,4 s | relancée par reflow |
| `.oeil-fermeture` | `oeilSeFerme` | 0,3 s | 300 ms |
| `.photo-apercu.fermeture` | `aspirePhotoVersOeil` | 0,35 s | 350 ms |
| `.btn-ajouter-courses.disparait` | transition | — | 200 ms |
| Panneaux | `grid-template-rows` / `max-height` | CSS | `.pret` au `transitionend` |
| FLIP Cuisine/ingrédients | transform inline | 0,25 s | `transitionend` |
| FLIP badge | transform inline | 0,4 s | — |

« Relancée par reflow » : retirer la classe, forcer `offsetWidth`, la
remettre. En React : ref sur l'élément + manipulation de `classList` dans un
gestionnaire, pas un état qui ne change pas si la classe est déjà là.

### 4.10 Textes système et stockage

| Type | Texte exact | Où |
|---|---|---|
| Toast | Connexion instable : réessaie dans un instant. | Stock, Courses, Cuisine |
| Toast | Déjà dans le stock. / Déjà dans la liste de courses. / Déjà en cuisine aujourd'hui. | Doublons |
| alert | Tout est déjà dans la liste de courses. | Preset |
| alert | Ajoute un nom et au moins un ingrédient valide. | Recette |
| alert | Erreur réseau, réessaie. | Recette |
| alert | Une erreur est survenue. | Application de recette |
| alert | `data.erreur` du serveur | Toute erreur métier |
| confirm | Remplacer "Courses de la semaine" par la liste actuelle ? | Preset |
| confirm | Vider la cuisine d'aujourd'hui ? | Cuisine |
| confirm | Supprimer cette recette ? | Recette |
| Vide | Aucun aliment ne correspond à ta recherche. / Aucun article ne correspond à ce filtre. / Aucun article dans la liste de courses. / Rien d'ajouté aujourd'hui. / Aucun ingrédient pour l'instant — touche "+" pour en ajouter. / Aucune étape ajoutée — juste les ingrédients, cette fois. / Aliment introuvable. | Pages |

Toast : `div#toastReseau.toast-reseau` sous `body`, `visible` rejouée par
reflow, masquée après 3 500 ms, minuteur remis à zéro à chaque message.

Bouton d'effacement (`.btn-effacer-recherche`, mobile seulement via CSS) :
`visible` dès qu'il y a du texte ; clic → valeur vide, même effet qu'une
saisie, focus.

`localStorage` : `vueStock`, `modeMagasin`, `vueRecettes-plat`,
`vueRecettes-fraicheur`, `chow-photo-course-<id>`. Clés et valeurs identiques ;
lectures/écritures protégées comme aujourd'hui.

---

## 5. Architecture cible

```text
frontend/
  index.html            head identique à header.ejs (D3)
  package.json          versions exactes, scripts dev/build/preview/test
  vite.config.js        proxy /api, /css, /images vers Express
  jest.config.cjs, babel.config.cjs
  src/
    main.jsx            StrictMode, BrowserRouter, ErrorBoundary
    App.jsx             Routes, Shell, garde de session
    api.js              client fetch unique (+ fetchAvecRetry pour Courses)
    context/AuthContext.jsx
    components/         Shell.jsx, Header.jsx, Footer.jsx, CustomSelect.jsx,
                        SearchClearButton.jsx, Toast.jsx, ErrorBoundary.jsx
    hooks/              usePageData.js, useBodyClass.js, useOutsideClick.js,
                        useLocalStorage.js, useRestartClass.js
    utils/              texte.js (normaliserTexte, escape inutile en JSX),
                        stock.js (niveaux cl), unites.js (conversions)
    pages/
      Accueil.jsx, Login.jsx, Aliments.jsx, AlimentDetail.jsx
      stock/            StockPage.jsx, StockItem.jsx, StockAjout.jsx
      courses/          CoursesPage.jsx, CourseItem.jsx, PanneauAjout.jsx,
                        FiltresRayon.jsx, PhotoApercu.jsx, photos.js
      calories/         CaloriesPage.jsx, Cuisine.jsx, CuisineItem.jsx,
                        Recettes.jsx, RecetteSheet.jsx, IngredientLigne.jsx
```

Ce découpage est une cible ; un fichier qui reste seul dans son dossier est
remonté d'un niveau. Pas de `features/`, pas de dossier par composant.

Flux : chaque page appelle `usePageData("/api/…")` → `{etat, donnees}` ;
`etat` vaut `chargement`, `pret` ou `erreur` (Q2). Les listes affichées sont
**dérivées** des données + critères (filtre, recherche, tri), jamais stockées
en double. L'ordre courant d'une liste triable est un état, car les tris
actuels sont stables sur l'ordre précédent.

---

## Phase 0 — Branche, socle Vite et garde-fous

**Cours :** 15, 16, 22, 23, 33.

1. ⏸ Olumide : Q1–Q9 tranchées ; T1–T3 faites (§2.3). Olumide crée la branche (`bcm`) :
   `feat/migration-react`.
2. Créer `frontend/` avec Vite + plugin React, versions exactes (B6). Choisir
   React Router (D9), dernière version stable. Node du
   Dockerfile (22.21.1) compatible avec la version de Vite retenue.
3. `frontend/index.html` : `<head>` recopié de `header.ejs` (§4.1), `<div
   id="root">`, aucun texte visible avant le rendu.
4. `vite.config.js` : proxy `/api`, `/css`, `/images` vers Express, port lu
   dans `PORT` du `.env` racine (3030 en local ; 3000 est pris par un autre
   projet). Cible de build : défaut de Vite (Q1), aucun réglage. Ne lancer et
   n'arrêter que ses propres processus : d'autres projets tournent souvent sur
   3000, 5173 et suivants.
5. Racine : aucun changement de `package.json` racine à ce stade.
6. Garde-fous : `git check-ignore -v frontend/**` sur tous les fichiers créés
   (G3) ; `frontend/node_modules` et `frontend/dist` ignorés, rien d'autre.

**Pièges :** ne pas importer `style.css` dans `main.jsx` (D3) ; ne pas
installer `@types/*`, `plugin-legacy`, `core-js` ni polyfill (Q1).

**Terminé quand :** `npm ci` et `npm run build` passent dans `frontend/`
(Vérifié agent) ; `vite dev` affiche une page vide avec le style de fond
(Olumide, poste de dev) ; versions consignées dans le compte rendu ; `gcm`.

## Phase 1 — API JSON et authentification

**Cours :** 38 côté client ; le serveur est hors cours (compagnon).

1. Extraire si nécessaire une fonction par lecture de page dans `index.js`
   (ex. `chargerDonneesCourses()`), appelée par la route EJS **et** la route
   API. Les routes EJS rendent exactement la même chose qu'avant.
2. Ajouter les lectures et alias du §4.2. Les alias réutilisent le **même**
   gestionnaire (fonction nommée montée sur deux chemins), pas une copie.
3. `POST /api/login` avec `passport.authenticate` en callback personnalisé +
   `req.logIn` ; `POST /api/logout` ; `GET /api/session`. Placés avant
   `app.use(requireAuth)`.
4. `requireAuth` : `401` JSON pour `/api/*`, redirection sinon.
5. Garde JSON (D13) : middleware sur les mutations `/api` qui répond `415`
   si `req.is("application/json")` est faux. Aucun `cors()`.
6. Q9 : déjà en production via T3 ; vérifier seulement que `/api/login`
   émet le même cookie.

**Pièges :** vérifier l'ordre des routes Express (`GET /api/recettes/:id`
ne doit capturer aucun autre chemin) ; ne pas renvoyer `password` ; aucune
modification des migrations au démarrage.

**Terminé quand :** sur la branche Neon **dev** (`family-hub-dev`, jamais `production`), un script `curl`
avec cookie vérifie : 415 pour une mutation `/api` envoyée en formulaire,
attributs du cookie (`Set-Cookie`) conformes à Q9, 401 sans session, login faux/juste, session conservée,
chaque GET, chaque alias POST (aller-retour sur une donnée de test puis
remise en état), 404 aliment/recette, logout (Vérifié agent). Les pages EJS
sont inchangées (Olumide, tour rapide). Serveur redémarré après chaque
modification. `gcm`.

## Phase 2 — Shell, routes, session et pages simples

**Cours :** 20, 21, 24, 25, 28–30, 32, 34, 39.

1. `AuthContext` : `inconnu | connecte | deconnecte` via `/api/session`. Rien
   de privé n'est rendu tant que l'état est `inconnu` (header + chargement, Q2).
2. Routes : `/login`, `/`, `/aliments`, `/aliments/:id`, `/stock`,
   `/courses`, `/calories`. Pas de route attrape-tout (D5). Garde :
   `deconnecte` → `Navigate` vers `/login` (replace).
3. `Shell` : Header + `<main>` de la page + Footer, conformes au §4.1. Le
   `<main>` appartient à chaque page (structures différentes).
4. Effets globaux, posés une fois dans le Shell avec nettoyage : `--header-h`
   (`useLayoutEffect` + `resize`), blur viewport (capture), fermeture des
   sélecteurs (clic, scroll capture, Échap).
5. À chaque navigation : remontage de la page (D6), `document.title`, toast
   et listes de sélecteur fermés. Défilement (Q7) : `history.scrollRestoration
   = "manual"` ; la position `scrollY` est mémorisée par `location.key` dans
   `sessionStorage` en quittant une page. Navigation nouvelle (`PUSH`) → haut
   de page ; retour/avance (`POP`) → position mémorisée, appliquée **après**
   le premier rendu des données de la page (sinon la page est encore trop
   courte). Défilement toujours **instantané** : `html` a
   `scroll-behavior: smooth`, il faut `behavior: "instant"` ou neutraliser
   temporairement le style.
6. Pages Accueil et Connexion (§4.3). La connexion accepte `?retour=` (Q3) :
   seulement un chemin commençant par `/` et pas par `//`, sinon `/`.
7. `api.js` : `credentials: "same-origin"`, JSON, distinction erreur métier /
   HTTP / réseau / annulation. 401 pendant une session (Q3) : toast, puis
   `window.location.reload()` après 1,5 s, un seul déclenchement même si
   plusieurs requêtes reçoivent 401.
8. Composant `Chargement` (Q2) : SVG inline animé, délai d'affichage 200 ms,
   CSS dans un nouveau fichier `public/css/etats.css` chargé **après**
   `style.css` (D3 : `style.css` reste intact). ⏸ Olumide valide le dessin et
   l'animation sur capture avant la suite.

**Pièges :** `NavLink` ajoute sa classe `active` : utiliser `Link` avec la
classe calculée `nav__link actif` (le CSS attend `actif`). Le header doit
rester présent pendant le chargement.

**Terminé quand :** Jest (MemoryRouter) couvre garde, titre, classe `actif`
et remontage au clic sur le lien actif (Vérifié agent). ⏸ Olumide sur le build
de production (phase 0 + Express) : connexion fausse/juste, rechargement d'une
URL profonde, retour arrière, accueil identique à l'EJS. `gcm`.

## Phase 3 — Briques communes

**Cours :** 1–6, 8–13, 25–30, 38, 40.

1. `usePageData(url)` : `AbortController` par appel, annulé au nettoyage (R1) ;
   ignore l'annulation ; expose `donnees` et une fonction de mise à jour locale.
2. `CustomSelect` : `select` natif conservé (classe `custom-select-native`,
   `onChange` réel), suivi immédiatement de `div.custom-select >
   button.custom-select__button > span.custom-select__label` (D4, §4.8).
   Liste via `createPortal` sous `body` seulement quand elle est ouverte, avec
   `data-for-select`, position `fixed` sous le bouton (+6 px), `min-width` du
   bouton, recalage horizontal à 12 px des bords, ouverture animée par
   `custom-select__list--ouverte` après reflow, fermeture animée 150 ms (clic
   sur option) ou instantanée (clic ailleurs, scroll, Échap). Option vide sans
   texte non listée. `aria-*`, `title` et `aria-label` reportés.
3. Attention : les événements React d'un portail remontent **l'arbre React**,
   pas le DOM. Un clic sur une option ne doit pas atteindre le `onClick` de la
   carte Stock parente : `stopPropagation` sur la liste, et tests dédiés.
4. `Toast` (portail sous `body`, id `toastReseau`), `SearchClearButton`,
   `useBodyClass`, `useOutsideClick` (refs multiples : déclencheur + zone),
   `useRestartClass` (relance d'une classe d'animation par reflow),
   `useLocalStorage` protégé par `try/catch`.
5. Verrous : `useRef` posé dans le gestionnaire **avant** le fetch, état
   séparé pour l'affichage (R2, D12).
6. Sortie animée : la ligne reste montée avec sa classe `disparait*`, puis est
   retirée de l'état après 300 ms (minuteur nettoyé au démontage).

**Pièges :** aucun `innerHTML` ; aucun `MutationObserver` ; aucun composant
partagé qui ajoute un conteneur absent du template (R4).

**Terminé quand :** tests Jest du sélecteur (ouverture, choix → `change`,
fermeture extérieure, Échap, option vide masquée, `disabled`), du verrou
(double clic = un seul appel), de l'annulation sous StrictMode (Vérifié
agent). `gcm`.

## Phase 4 — Aliments et fiche détail

**Cours :** 20, 24–27, 28, 38.

Porter §4.4 en entier. Les cartes masquées restent rendues avec `.hidden`.
Tri stable sur l'ordre courant. Fiche : `details` non contrôlé, inputs non
contrôlés initialisés à la valeur serveur ou `""`, sauvegarde sur `change`
(l'événement natif, pas chaque frappe : utiliser `onBlur` + comparaison, ou un
écouteur `change` natif via ref, car `onChange` React se déclenche à chaque
frappe).

**Terminé quand :** Jest : « cafe » trouve « Café », filtre + recherche,
tri numérique, état vide, 404 (Vérifié agent). ⏸ Olumide : comparaison côte à
côte EJS / React (mobile + desktop), sauvegarde d'équivalence et message 2 s.
`gcm`.

## Phase 5 — Stock : lecture, filtres, tri, vue

**Cours :** 1–2, 24–28.

Structure et textes §4.5, filtres combinés, recherche, tri initial, vue
`vueStock`. Barre `cl` avec la bonne classe et `title`.

**Terminé quand :** Jest sur filtres/tri/vue ; ⏸ Olumide sur les deux vues.
`gcm`.

## Phase 5b — Stock : ajout

**Cours :** 5–6, 8–11, 26, 38.

Bascule recherche/ajout, backdrop, reprise du texte, suggestions, doublon par
nom, verrou par `food_id`, quantité de départ, insertion + tri + filtres +
mise en avant (§4.5).

**Terminé quand :** Jest (doublon, verrou, échec réseau → toast) ; ⏸ Olumide
(ouverture/fermeture par backdrop et clic extérieur, mise en avant). `gcm`.

## Phase 5c — Stock : édition, soustraction, courses, suppression

**Cours :** 5–6, 8–13, 26–30.

Un seul article ouvert, exceptions de clic, contrôle `cl` via `CustomSelect`
(§Phase 3, point 3), soustractions bornées, bouton « Ajouter aux courses »
bas, sauvegarde/annulation, `maj-flash`, suppression animée.

**Terminé quand :** Jest (ouverture A puis B sauvegarde A ; valeur inchangée
= aucune requête ; −5 absent sous 5 ; erreur restaurée) ; ⏸ Olumide (focus et
clavier mobile, sélecteur `cl` dans la carte). `gcm`.

## Phase 6 — Courses : liste, tri, badge, preset

**Cours :** 1–2, 8–13, 24–28, 38.

Ordre DOM complet, tri stable + en-têtes, insertion triée, badge et ses deux
animations, FLIP du badge (mesure de l'ancien nœud avant changement d'état,
application dans `useLayoutEffect` sur le nouveau, R5), preset (5 articles,
comparaison, confirm, `.confirme`).

**Terminé quand :** Jest (tri par catégorie avec en-têtes, preset désactivé si
identique, badge) ; ⏸ Olumide (badge qui glisse au scroll, aucun mouvement au
chargement). `gcm`.

## Phase 6b — Courses : panneau d'ajout

**Cours :** 5–6, 26, 38.

Panneau dernier enfant, `.ouvert`/`.pret`, scroll + focus, recherche, bouton
« Ajouter », Entrée = texte libre (§3.2-1), doublon par `food_id`, verrou
unique, `fetchAvecRetry`.

**Terminé quand :** Jest (texte libre, doublon, verrou) ; ⏸ Olumide (panneau
et suggestions qui débordent après ouverture). `gcm`.

## Phase 6c — Courses : mode magasin et rayons

**Cours :** 1–2, 8–13, 29.

`useBodyClass("mode-magasin")`, clé `modeMagasin`, règles exactes des puces
(§4.6), synchronisation après ajout/achat/suppression, réinitialisation en
quittant le mode.

**Terminé quand :** Jest sur les quatre règles de clic et l'apparition /
disparition des puces ; la classe `body` disparaît en quittant la page ;
⏸ Olumide en magasin simulé. `gcm`.

## Phase 6d — Courses : armement, achat, suppression, notes

**Cours :** 5–6, 8–13, 26–30, 38.

Écouteur global d'armement avec la liste d'exceptions exacte, trois variantes
d'achat, +1/+2/+5 (pas de `requestSubmit` : appeler le gestionnaire
directement), activation du panier, désactivation pendant l'envoi, sorties
animées, recalculs après retrait, notes (ouverture par emoji/note, `blur`,
150 ms, mise à jour optimiste).

**Terminé quand :** Jest (premier tap n'achète pas `cl` ; exceptions ; un seul
POST au double tap ; erreur réactive) et contrôle HTTP du Stock après achat
(Vérifié agent) ; ⏸ Olumide (gestes réels, notes, clavier). `gcm`.

## Phase 6e — Courses : photos

**Cours :** 5, 23, 30, 38 ; FileReader/canvas hors cours (compagnon).

Input partagé, id de course figé pendant compression/envoi, compression,
cache `chow-photo-course-<id>`, préchargement au montage, aperçu, animation de
fermeture vers le bouton, suppression en deux temps, position du bouton selon
la présence de photo, nettoyage du cache à l'achat/suppression.

**Terminé quand :** Jest sur la logique de cache (quota simulé) ; ⏸ Olumide
sur téléphone : photo prise, consultée hors réseau, supprimée, achat qui
nettoie. `gcm`.

## Phase 7 — Calories : totaux, onglets, lecture de la Cuisine

**Cours :** 1–2, 20, 24–28, 38.

Totaux (format exact), sentinelle et `.compacte` (≤ 768 px), onglets, lignes
de Cuisine avec sélecteur d'unité toujours présent, boutons de réordre
masqués aux extrémités.

**Terminé quand :** Jest (totaux identiques à la réduction serveur pour un
jeu connu, hors aliments CHOW-52) ; ⏸ Olumide (résumé sticky compact). `gcm`.

## Phase 7b — Cuisine : ajout, unités, modification, retrait, vidage

**Cours :** 5–6, 8–13, 26, 38.

Recherche + doublon + verrou, ajout 100 g, conversions aller-retour, `min`
recalculé, sauvegarde sur `change` natif, retrait animé, Tout effacer.

**Terminé quand :** Jest (conversion tsp → g → tsp sans dérive, valeur
invalide ignorée, totaux sans les lignes `disparait`) ; ⏸ Olumide. `gcm`.

## Phase 7c — Cuisine : réordre, recettes appliquées, bouton recette

**Cours :** 8–13, 26, 38 ; FLIP hors cours.

FLIP avec mesure avant/après dans `useLayoutEffect`, POST `deplacer`,
application de recette (remplacement, remise à vide du sélecteur), bouton
« Enregistrer comme recette » et sa condition.

**Terminé quand :** ordre conservé après rechargement (HTTP, Vérifié agent) ;
⏸ Olumide (glissement visible, sélecteurs de recette). `gcm`.

## Phase 8 — Recettes : grilles

**Cours :** 20, 24–28.

Deux sections fixes, tri et vue par section, clés `vueRecettes-*`, carte
« Nouvelle recette » dernière, icônes de tri qui changent d'image.

**Terminé quand :** Jest (tris indépendants) ; ⏸ Olumide. `gcm`.

## Phase 8b — Recettes : panneau de lecture

**Cours :** 26, 30, 38.

Ouverture via fetch (réponse obsolète ignorée si une autre carte est ouverte
entre-temps), méta depuis la carte, étapes, `scroll-bloque`, fermetures.

**Terminé quand :** Jest (A puis B rapide → B affichée) ; ⏸ Olumide (panneau
et défilement bloqué derrière). `gcm`.

## Phase 8c — Recettes : création, édition, suppression

**Cours :** 3–6, 8–14, 26, 38.

Brouillon `{id, nom, categorie, etapes, ingredients[]}` ; chaque ligne a une
clé stable (`food_id`, unique par recette). Repli/dépli de la recherche,
lignes, conversions, réordre local, validations, envoi verrouillé, mises à jour
(cartes, options triées, sélecteur réactivé, tri, liste locale), suppression.

**Terminé quand :** cycle créer → lire → modifier (catégorie changée) →
appliquer à la Cuisine → supprimer, en HTTP + Jest (Vérifié agent) ; ⏸ Olumide.
CHOW-56 garde sa BFV propre, non remplacée par ce test. `gcm`.

## Phase 9 — Passe cycle de vie

**Cours :** 23, 26, 30, 40.

Relire chaque page : minuteurs, écouteurs `scroll`/`resize`/clic, observateurs
et classes `body` nettoyés ; StrictMode sans double écriture serveur ni double
écouteur ; aucun élément animé au chargement ; `prefers-reduced-motion`
respecté partout où l'EJS le respectait (badge, photos).

**Terminé quand :** Jest de démontage pour chaque hook global ; ⏸ Olumide :
navigation répétée entre toutes les pages sans effet résiduel. `gcm`.

## Phase 10 — Contrôle des props (sans PropTypes)

**Cours :** 35 (lecture seule, D8).

React 19 ignore `propTypes` : n'en déclarer aucun, ce serait du code mort.
À la place, chaque composant qui reçoit des données serveur a un test Jest
avec des données réelles : chaînes numériques (`"52.00"`), `null`, quantités
textuelles (`"plein"`), listes vides. TypeScript serait la vraie validation
des props ; c'est un ticket séparé, après la bascule.

**Terminé quand :** ces tests passent (Vérifié agent). `gcm`.

## Phase 11 — Frontière d'erreur

**Cours :** 7, 46, 47.

Classe `ErrorBoundary` autour des routes. Affichage : Q2 (réutilise le même
message). Elle ne capture pas les erreurs de fetch, qui restent gérées par
`usePageData`.

**Terminé quand :** test Jest avec un composant qui lève une erreur. `gcm`.

## Phase 12 — Consolidation des tests

**Cours :** 42–45, 49.

Jest + jsdom + Babel (`.cjs`, le frontend étant en `"type": "module"`),
mocks CSS/images, `MemoryRouter`, faux minuteurs pour les délais (150, 200,
300, 350, 600, 800, 1 500, 2 000, 3 500 ms). Matrice : session, double tap,
Stock, Courses, photos, Cuisine, Recettes, nettoyage. Script HTTP de la phase
1 (`node scripts/verifier-api.js`, refuse toute autre base que Neon dev)
rejoué à chaque phase qui touche au serveur.

**Terminé quand :** `npm test` passe (sortie lue) ; la liste des limites
(rendu, gestes, caméra, clavier) est écrite dans le compte rendu. `gcm`.

## Phase 13 — Parité complète ⏸ Olumide

Sur iPhone et Mac (Q1), Safari à jour, **build de production servi par Express**
(B4), même base de données pour EJS (`:3000/…` avant bascule) et React :

1. parcourir l'[annexe B](#annexe-b--checklist-de-parité) page par page,
   mobile et desktop ;
2. noter chaque différence ; l'agent corrige seulement les différences de
   parité, jamais les comportements de la section 3.2 ;
3. ne pas déclarer de BFV pour CHOW-51/52/53/56 : ce n'est pas l'objet.

**Terminé quand :** annexe B entièrement cochée par Olumide.

## Phase 14 — Build de production, Docker, pré-vol

**Cours :** 22, 33, 48 ; Docker hors cours.

1. T2 vérifié : l'image construite ne contient ni `.env` ni `docs/`.
2. Dockerfile : étape `frontend-build` sur la même image Node que l'exécution
   (G7), `npm ci` + `npm run build` dans `frontend/` ; image finale avec le
   backend et `frontend/dist`.
3. Express : `express.static("public")` conservé pour `/css` et `/images`,
   `express.static("frontend/dist")` pour le bundle, puis `index.html` servi
   **seulement** pour les routes React connues (§Phase 2), avec une syntaxe de
   route compatible Express 5. Une URL `/api/...` ou un fichier inconnu ne
   reçoit jamais `index.html`.
4. Contrôle du build (B1) : l'image construite charge sans erreur console
   sur Safari iPhone et Safari Mac (Olumide).
5. ⏸ Olumide : `docker build` local puis lancement de l'image contre la branche
   Neon dev ; tests de l'annexe B réduits (connexion, une action par page,
   photo, rechargement profond).

**Terminé quand :** image construite et testée sur iPhone et Mac (Olumide). `gcm`.

## Phase 15 — Bascule, nettoyage, documentation

**Fait le 5 octobre 2026 :** routes et vues EJS, `public/js/`, dépendance `ejs`,
chemins POST sans `/api` (sauf `/recettes/depuis-journal`) et test de parité
retirés ; Express sert toujours React. `scripts/verifier-api.js` passe.

1. Retirer les routes GET EJS, `app.set("view engine")`, `views/`,
   `public/js/`, la dépendance `ejs`, et les chemins POST non `/api` (après
   vérification qu'aucun client ne les appelle encore). **Exception :**
   `POST /recettes/depuis-journal` reste en place (Q8). Garder `public/css` et
   `public/images`.
2. Mettre à jour la documentation (G10) et marquer ADR 004 selon la décision
   d'Olumide.
3. Commandes pour Olumide, dans l'ordre : `git status`, `git log -1`, `gcm`,
   push, PR, vérification que la branche contient tout, fusion (= déploiement
   automatique, Q5), contrôle production, puis seulement suppression de la
   branche (G4–G6).
4. Retour arrière, préparé **avant** la fusion :
   - noter l'image en production : `fly releases --image -a chow-ejs` (ligne
     de la release actuelle) ;
   - aucune migration de schéma n'est ajoutée par la migration React : les
     `ALTER ... IF NOT EXISTS` de `index.js` sont inchangés, l'ancienne image
     redémarre donc sur la même base ;
   - retour immédiat : `fly deploy --image <image notée> -a chow-ejs` ;
   - Fly redéployant `main` automatiquement (Q5), ce retour par image serait
     écrasé au prochain push : annuler aussi la fusion sur `main`
     (`git revert -m 1 <commit de fusion>`, poussé par Olumide), ce qui
     redéploie l'EJS par le même mécanisme.
   Les sessions et photos étant en base, un retour arrière ne déconnecte
   personne et ne perd aucune photo.

5. Renommage du projet « chow-ejs » → « chow » (demande d'Olumide,
   2026-10-02), une fois la production stable :
   - `package.json` : déjà fait (`"name": "chow"`) ;
   - dépôt GitHub : Olumide le renomme dans Settings → General ; GitHub
     redirige l'ancienne adresse, puis `git remote set-url origin
     git@github.com:Narcissussing/chow.git` ;
   - dossier local : `mv chow-ejs chow` **en dehors de toute session Claude**
     ouverte dessus ; copier ensuite la mémoire de projet Claude
     (`~/.claude/projects/…-chow-ejs/memory/`) vers le dossier du nouveau
     chemin, sinon elle est perdue ; rouvrir VS Code sur le nouveau dossier ;
   - Fly : une application ne se renomme pas, et le nom `chow` est déjà pris
     sur Fly (`chow.fly.dev` existe). Décision Q10.
6. Mettre à jour les mentions restantes (`README.md`, `docs/operations.md`,
   `AGENTS.md`, chemins de la mémoire Claude) selon Q10.

**Terminé quand :** production vérifiée par Olumide, documentation à jour,
branche supprimée après fusion confirmée, projet renommé.

## Phase 16 — Option : styled-components

**Cours :** 36, 37.

Seulement après la phase 15, un composant à la fois, chaque conversion
vérifiée seule. Variables globales, masques SVG, media queries, utilitaires
de fin de fichier et portails sous `body` à préserver. Hors du périmètre de
parité.

---

## Annexe A — Les 49 leçons

| # | Leçon | # | Leçon |
|---|---|---|---|
| 1 | [Udemy] React Hooks – useState | 26 | [OC1] Interagissez avec vos composants grâce aux événements |
| 2 | [Udemy] useState Hook Practice | 27 | [OC1] Quiz : Créer une application React |
| 3 | [Udemy] ES6 Object & Array Destructuring | 28 | [OC1] Mettez en place votre state local avec useState |
| 4 | [Udemy] ES6 Destructuring Challenge Solution | 29 | [OC1] Partagez votre state entre différents composants |
| 5 | [Udemy] Event Handling in React | 30 | [OC1] Déclenchez des effets avec useEffect |
| 6 | [Udemy] React Forms | 31 | [OC1] Quiz : Rendre une application dynamique |
| 7 | [Udemy] Class Components vs. Functional Components | 32 | [OC2] Tirez le maximum de ce cours |
| 8 | [Udemy] Changing Complex State | 33 | [OC2] Architecturez votre projet |
| 9 | [Udemy] Changing Complex State Practice | 34 | [OC2] SPA avec React Router |
| 10 | [Udemy] ES6 Spread Operator | 35 | [OC2] PropTypes |
| 11 | [Udemy] ES6 Spread Operator Practice | 36 | [OC2] styled components |
| 12 | [Udemy] Managing a Component Tree | 37 | [OC2] Quiz : SPA à l'architecture robuste |
| 13 | [Udemy] Managing a Component Tree Practice | 38 | [OC2] useState et useEffect pour les calls API |
| 14 | [Udemy] Keeper App Project – Part 3 | 39 | [OC2] Contexte et useContext |
| 15 | [Udemy] Packages and Imports | 40 | [OC2] Allez plus loin avec les hooks |
| 16 | [Udemy] React Dependencies & Styling | 41 | [OC2] Quiz : données et hooks |
| 17 | [Udemy] How to Build Your Own Product | 42 | [OC2] Base des tests avec Jest |
| 18 | [OC1] Tirez le maximum de ce cours | 43 | [OC2] React Testing Library |
| 19 | [OC1] Appréhendez la logique de React | 44 | [OC2] Allez plus loin dans vos tests |
| 20 | [OC1] Composants en JSX | 45 | [OC2] Quiz : tests |
| 21 | [OC1] Quiz : principes de React | 46 | [OC2] Anciennes syntaxes de React |
| 22 | [OC1] Premier projet React avec Vite | 47 | [OC2] API dans un composant classe |
| 23 | [OC1] Style et assets | 48 | [OC2] Exploitez vos acquis |
| 24 | [OC1] Listes et conditions | 49 | [OC2] Quiz : écosystème React |
| 25 | [OC1] Props | | |

## Annexe B — Checklist de parité

À cocher par Olumide en phase 13, mobile puis desktop. « = » signifie
identique à l'EJS sur la même base. Cette liste résume les parcours ; la
référence complète reste l'inventaire des sections 4.1 à 4.10 (textes exacts,
attributs, `title`/`aria-*`, minuteurs, clés `localStorage`). Une ligne cochée
ici signifie que la sous-section correspondante a été relue et comparée.

**Consigner chaque écart** dans le tableau en fin d'annexe, une ligne par
écart, avant toute correction. L'agent ne corrige que les écarts de parité ;
un écart qui correspond à la section 3.2 est noté « conservé ».

**Shell** (§4.1) : titre d'onglet · favicon · polices · header collant ·
lien actif (détail aliment inclus) · pied de page · pas de zoom au focus ·
clic sur le lien actif recharge la page.

**Sélecteur personnalisé** (§4.1, phase 3) : ouverture sous le bouton ·
recalage au bord droit · option vide absente · option choisie marquée ·
fermeture au clic extérieur, au défilement de la page et à Échap · défilement
interne d'une longue liste sans fermeture · état `disabled` et son `title` ·
`aria-expanded` qui suit l'ouverture · `aria-label` des sélecteurs de recette
lu par VoiceOver. Pas de navigation aux flèches : absente de l'EJS, elle ne
doit pas apparaître non plus.

**Connexion** : erreur affichée · gestionnaire de mots de passe · redirection
après succès · URL profonde sans session → connexion.

**Accueil** : quatre cartes, animation d'apparition.

**Aliments** : compteur et badge tournant · filtres · recherche sans accents ·
champ rouge sans résultat · bouton ✕ mobile · six tris · état vide · fiche :
photo ou emoji, macros, équivalences, « Enregistré » 2 s, retour · id inconnu.

**Stock** : filtres combinés · recherche · ajout (+, backdrop, reprise du
texte, doublon, mise en avant) · cinq tris · grille/liste mémorisée · édition
unique · sélecteur `cl` · −1/−2/−5 · « Ajouter aux courses » · flash · suppression.

**Courses** : badge (pop, shake, glissement vers la barre) · tri et en-têtes ·
mode magasin mémorisé · puces de rayon (4 règles, apparition, disparition) ·
preset (ajout, alert, Enregistrer ≥ 5, confirm, ✓) · panneau d'ajout · texte
libre · doublon · armement et exceptions · +1/+2/+5 · achat → Stock mis à
jour · suppression · notes · photos (prise, aperçu, hors réseau, suppression,
animation vers l'œil) · toast réseau.

**Calories** : totaux et résumé compact au scroll · onglets · ajout, doublon ·
unités tsp/tbs/pièce · modification · réordre animé · retrait · Tout effacer ·
recettes appliquées · bouton « Enregistrer comme recette ».

**Recettes** : deux sections · tris et vues indépendants mémorisés · carte
nouvelle recette · lecture (ingrédients, étapes, vide) · création depuis
section et depuis la Cuisine · édition (catégorie, ingrédients, unités, réordre,
étapes) · Entrée dans le nom · suppression · sélecteurs mis à jour.

**Transversal** : aucun texte « Chargement » · aucun saut au chargement ·
`body` sans `mode-magasin` ni `scroll-bloque` hors de leur page · retour
arrière (geste ou ‹) revient à la même position de défilement, nouvelle page
en haut (Q7) · reduced-motion.


**Tableau des écarts**

| # | Page / section | Appareil | Attendu (EJS) | Obtenu (React) | Statut (à corriger / conservé §3.2 / corrigé) |
|---|---|---|---|---|---|
| 1 | | | | | |

Sources techniques : [React : StrictMode](https://react.dev/reference/react/StrictMode),
[React : createPortal](https://react.dev/reference/react-dom/createPortal),
[React 19 et PropTypes](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-proptypes-and-defaultprops-for-functions),
[Vite : build](https://vite.dev/guide/build).
