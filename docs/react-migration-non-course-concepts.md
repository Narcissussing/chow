# Migration React — concepts au-delà des cours

Compagnon du [plan Chow](react-migration-plan.md), basé sur les 49 leçons
fournies par Olumide. Les cours suffisent à la majorité des composants. Les
sujets ci-dessous ne sont pas couverts explicitement par leurs intitulés :
ils répondent à un besoin existant de Chow, pas à une obligation d'ajouter des
technologies. Aucun code de migration n'est encore implémenté par ces documents.

## API Express parallèle et contrats de données

**Déjà appris :** calls API avec useState/useEffect (38).

**Besoin Chow :** les lectures initiales sont des pages EJS ; les mutations
renvoient déjà souvent du JSON. Il faut partager les fonctions métier entre
routes HTML de référence et nouvelles routes `/api`, avec payloads explicites,
404/401/500 cohérents et photos binaires séparées.

**À apprendre :** frontière serveur/client et contrat HTTP. Ce n'est pas un
simple changement `res.render` → `res.json` : préserver auth, types numériques,
quantités textuelles, migrations et routes historiques pendant la comparaison.
Le SQL et les règles nutritionnelles restent côté serveur.

## Sessions Passport et navigation protégée

**Déjà appris :** Router et Context (34, 39).

**Besoin Chow :** deux comptes privés, cookies de session PostgreSQL, accès
restreint. Le guard actuel redirige vers HTML ; un fetch SPA doit recevoir
401 JSON et afficher la connexion.

**À apprendre :** session cookie, login/logout JSON et différence entre cacher
une page dans React et autoriser réellement une requête sur Express. Context
partage seulement le statut minimal de session. Pas de JWT/localStorage pour
remplacer Passport. Même origine en production et proxy `/api` en développement
évitent une nouvelle architecture CORS ; secrets DB et session restent serveur.
Un cookie envoyé automatiquement expose aux requêtes forgées depuis un autre
site (CSRF). Le plan l'écarte pour `/api` en exigeant du JSON (un autre site
ne peut pas l'envoyer sans pré-vérification CORS, et aucun CORS n'est activé)
et propose `sameSite: "lax"` sur le cookie (décisions D13 et Q9).

## Refs, verrous et réponses obsolètes

**Déjà appris :** useState, événements, effets et état complexe (1–13, 30, 38).

**Besoin Chow :** empêcher deux achats au double-tap, ignorer une recette chargée
après fermeture du panneau, nettoyer les lectures lorsqu'on change de page.

**À apprendre :** `useRef` conserve une valeur mutable sans rendu. Une ref peut
verrouiller immédiatement un envoi ; state affiche le bouton désactivé.
`AbortController` ou un numéro de requête empêche une réponse ancienne de
remplacer la nouvelle. Annuler un fetch ne garantit pas l'annulation d'un POST
sur le serveur. Nettoyer effets/timers, notamment sous StrictMode.

## Échec réseau et répétition d'une mutation

**Déjà appris :** fetch dans un effet (38), formulaires (6).

**Besoin Chow :** réseau magasin instable et achat qui augmente Stock.
`fetchAvecRetry` réessaie actuellement une fois après 800 ms. Une réponse perdue
peut correspondre à un achat déjà enregistré : renvoyer le POST n'est pas neutre.

**À apprendre :** différence entre lecture répétable et mutation à résultat
incertain. Décision Q4 : avant la migration, l'achat devient idempotent côté
serveur (tâche T1 : `UPDATE ... WHERE achete = false RETURNING` dans une
transaction). Rejouer la requête ne change alors plus rien, et
`fetchAvecRetry` peut rester tel quel. Ce n'est pas un fonctionnement hors
ligne : une file d'attente hors ligne serait un autre projet.

## Hooks personnalisés et état dérivé

**Déjà appris :** state partagé, effets et hooks (29–30, 39–40).

**Besoin Chow :** mêmes structures de chargement, toasts et clic extérieur dans
plusieurs pages. Compteurs, chips de rayon et totaux doivent suivre les listes.

**À apprendre :** extraire un petit `use…` réutilisable lorsqu'une logique est
réellement commune. Calculer les listes filtrées depuis données + critères,
plutôt que stocker des copies désynchronisées. Pas de Redux ou cache global
obligatoire ; recharger Stock à l'entrée conserve la fraîcheur obtenue auparavant
par la navigation EJS. Ne pas mettre chaque frappe de formulaire dans Context.

## Portals et sélecteurs personnalisés

**Déjà appris :** JSX, props, événements et formulaires (20, 25–30).

**Besoin Chow :** la liste visuelle d'un select est sous `body` pour ne pas être
coupée par les panneaux. Le select natif reste présent et synchronisé.

**À apprendre :** `createPortal` rend un élément ailleurs dans le DOM tout en
le gardant dans l'arbre React. Ref pour mesurer le déclencheur ; props pour les
options et disabled ; cleanup pour scroll/clic extérieur/Échap. Le
MutationObserver du script vanilla n'est pas nécessaire pour observer des props.
Les événements d'un portal suivent l'arbre React : vérifier les clics extérieurs.

## Mesures DOM, useLayoutEffect et animations FLIP

**Déjà appris :** styles, événements et useEffect (23, 26, 30).

**Besoin Chow :** ordre de la Cuisine/ingrédients animé, badge Courses qui change
de position, photo qui revient vers l'œil, hauteur du header et résumé sticky.

**À apprendre :** refs pour mesures avant/après, `useLayoutEffect` quand il faut
mesurer avant peinture, et maintien temporaire d'une ligne pendant sa sortie.
React met à jour le DOM mais ne recrée pas automatiquement une animation FLIP.
Respecter `prefers-reduced-motion` ; un test jsdom ne mesure pas un layout réel.
Ne pas réintroduire `innerHTML` dans le sous-arbre géré par React.

## Photos : FileReader, canvas, base64 et cache local

**Déjà appris :** événements, assets et calls API (5, 23, 38).

**Besoin Chow :** photo compressée avant envoi, persistance `BYTEA`, aperçu
consultable depuis le cache pendant les courses.

**À apprendre :** pipeline asynchrone FileReader → Image → canvas → JPEG/base64,
avec id de course figé pendant le traitement, gestion d'échec et quota de
localStorage. Garder les paramètres du code actuel, la limite JSON de 4 Mo et
les clés de cache. Nettoyer après achat/suppression. Cache photo ne signifie
ni cache complet des pages ni synchronisation des écritures hors connexion.

## Types numériques et conventions nutritionnelles

**Déjà appris :** JS, destructuration/spread et formulaires (3–11).

**Besoin Chow :** PostgreSQL peut renvoyer des nombres comme chaînes ; Stock
peut contenir `plein`, et équivalence absente vaut NULL. Nutrition pour 100 g,
conversions propres à chaque aliment, Cuisine en grammes.

**À apprendre :** normaliser aux frontières selon chaque champ, sans conversion
universelle qui transforme absence ou quantité textuelle en zéro. Conserver
arrondis et calcul serveur. PropTypes vérifie une forme, pas la justesse d'une
étiquette nutritionnelle. CHOW-52 reste un problème de données séparé.

## Jest dans un projet Vite et tests temporels

**Déjà appris :** Jest et React Testing Library (42–44).

**Besoin Chow :** tests avec JSX/ESM, CSS, Router, session, photos et temporisations.

**À apprendre :** configurer transform JSX/ESM, jsdom et mocks d'assets ; isoler
`import.meta.env` dans un module remplaçable. Vite ne configure pas Jest à lui
seul. MemoryRouter pour les écrans ; faux timers pour le feedback et cleanup ;
réponses contrôlées pour doubles clics/erreurs. Tests HTTP séparés sur base
jetable/localement dédiée. Les animations/caméra/clavier mobile nécessitent un
vrai navigateur/appareil et ne deviennent pas « vérifiés » par un mock réussi.

## Frontière d'erreur classe

**Déjà appris :** classes vs fonctions et anciennes syntaxes (7, 46–47).

**Besoin Chow :** éviter qu'une exception de rendu laisse un écran vide.

**À apprendre :** cycle spécifique d'une ErrorBoundary. C'est une utilisation
justifiée de classe ; elle ne capture pas les échecs fetch asynchrones et ne
remplace pas leurs états d'erreur. Pas besoin de recréer tous les calls API en
classes pour montrer que la leçon 47 a été comprise.

## Build, proxy et déploiement

**Déjà appris :** Vite, architecture et packages (15–16, 22, 33).

**Besoin Chow :** frontend compilé et backend sur la même origine Fly ; sessions
et photos dans PostgreSQL. Le Docker actuel copie le backend mais ne construit
pas `frontend/`.

**À apprendre :** proxy `/api`, versions/lockfile reproductibles, stage Docker
avec devDependencies de build puis copie de dist, ordre API/assets/fallback SPA
compatible Express 5. Les routes profondes doivent marcher après recharge ; une
API inexistante ne doit pas répondre avec l'HTML React. Les migrations au
startup imposent une revue avant lancement. Olumide exécute le déploiement.

## Remonter une page à chaque navigation

**Déjà appris :** React Router (34), state local (28).

**Besoin Chow :** en EJS, chaque clic de navigation rechargeait la page :
filtres, recherche, onglet et panneaux repartaient de zéro, et recliquer la
page active relisait le serveur (décision D6).

**À apprendre :** une `key` change force React à recréer un composant. Donner
`location.key` comme clé à l'élément de route recrée la page à chaque
navigation, même vers la même URL. Penser aussi au défilement :
`html { scroll-behavior: smooth }` rend `window.scrollTo(0, 0)` animé, il faut
un défilement instantané pour imiter un rechargement.

Le retour arrière doit en plus retrouver la position de défilement (Q7).
Le navigateur ne sait pas le faire seul quand le contenu arrive après coup :
mémoriser `scrollY` par entrée d'historique (`location.key`), puis l'appliquer
une fois la page remplie, avec `history.scrollRestoration = "manual"`.

## Classes sur `body` et ressources globales

**Déjà appris :** useEffect et son nettoyage (30).

**Besoin Chow :** `mode-magasin` et `scroll-bloque` vivent sur `body` ; le
toast et les listes de sélecteur sont ajoutés sous `body`. En EJS, changer de
page les effaçait. En SPA, ils survivent si rien ne les retire.

**À apprendre :** tout ce qu'un composant pose hors de son propre arbre est
retiré dans le nettoyage de son effet (`useBodyClass`). Un test vérifie que
`document.body.className` est propre après démontage.

## Événement `change` natif et `onChange` React

**Déjà appris :** formulaires (6).

**Besoin Chow :** les quantités de la Cuisine et les équivalences sont
enregistrées sur l'événement `change` natif, déclenché quand on quitte un
champ modifié, pas à chaque frappe.

**À apprendre :** en React, `onChange` se déclenche à chaque frappe. Pour
reproduire le comportement actuel : comparer la valeur au `blur`, ou écouter
le `change` natif via une ref. Sinon chaque chiffre tapé enverrait une requête.

## Tri stable et ordre courant

**Déjà appris :** listes (24), spread et état complexe (8–11).

**Besoin Chow :** les tris actuels réordonnent les nœuds déjà affichés. Un
tri par catégorie garde l'ordre précédent à l'intérieur d'une catégorie, et
un nouvel article est inséré avant le premier article de clé supérieure.

**À apprendre :** `Array.prototype.sort` est stable ; trier une copie de
l'ordre courant (stocké en state) reproduit exactement le résultat. Recalculer
depuis l'ordre serveur à chaque fois donnerait un ordre différent.

## Servir la SPA depuis Express

**Déjà appris :** Vite et build (22), structure de projet (33).

**Besoin Chow :** une seule origine en production pour les cookies de session.
Les URL profondes (`/courses`) doivent renvoyer l'application après un
rechargement, mais une URL d'API inconnue doit garder sa réponse d'erreur.

**À apprendre :** servir `index.html` uniquement pour la liste des routes
React connues, après les routes `/api` et les fichiers statiques, avec une
syntaxe de route compatible Express 5. Une route attrape-tout masquerait les
404 d'API et d'images.

## Choix de version et PropTypes

**Déjà appris :** validation PropTypes (35).

**Besoin Chow :** appliquer cette leçon avec une vérification observable.

**Choix du plan :** dernière version stable de React (décision d'Olumide,
2026-10-01). React 19 ignore les déclarations `propTypes` : le package n'est
pas installé et la leçon reste théorique. Les formes de données sont vérifiées
par des tests Jest avec des valeurs réelles. TypeScript est l'outil moderne
équivalent ; il reste une option après la bascule, pas un ajout caché à cette
migration.

Références : [React : portals](https://react.dev/reference/react-dom/createPortal),
[React : useLayoutEffect](https://react.dev/reference/react/useLayoutEffect),
[React : StrictMode](https://react.dev/reference/react/StrictMode),
[React 19 : PropTypes](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-proptypes-and-defaultprops-for-functions),
[Jest : configuration](https://jestjs.io/docs/configuration),
[Vite : build](https://vite.dev/guide/build).
