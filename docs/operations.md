# Exploitation

## Environnements

| Environnement | Base | Configuration |
|---|---|---|
| Local | Neon `family-hub-backup`, branche `dev` (`ep-spring-truth-b9vjj7sz`, 0,25 CU, veille au repos) | `DATABASE_URL` dans `.env` |
| Production | Neon (`ep-aged-flower-b9sgwq8t`) | `DATABASE_URL` en secret Fly, copie locale dans `.env.production` |

Variables requises :

- `DATABASE_URL` ;
- `PORT` ;
- `SECRET_KEY`.

`index.js` accepte aussi `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD` et
`DB_PORT` pour un PostgreSQL local lorsque `DATABASE_URL` est absente. Avant
tout test qui écrit en base, vérifier que `.env` vise bien l'endpoint de la
branche dev, jamais celui de production.

Les secrets ne doivent jamais être ajoutés au dépôt.

## Démarrage local

```bash
npm install
npm start
```

Il n’y a pas de watcher. Après chaque modification, arrêter puis relancer le
serveur avant de tester.

## Comptes

L’application ne possède pas d’inscription publique.

```bash
node scripts/creer-utilisateur.js email@example.com mot-de-passe
```

Le script crée le compte ou remplace son mot de passe.

## Production

- application Fly.io : `ch-ow` ;
- région : `cdg` ;
- machine : CPU partagé, 256 Mo ;
- une machine toujours allumée (`auto_stop_machines = off`, `min_machines_running = 1`) ;
- sessions et photos persistées dans PostgreSQL.

Le disque local de la machine n’est pas une source de persistance.

## Déploiement et migrations

Commande de déploiement :

```bash
fly deploy
```

Le déploiement est exécuté manuellement par Olumide, jamais automatiquement
par un agent.

Les migrations idempotentes présentes au début de `index.js` s’exécutent au
démarrage. Par conséquent :

1. relire chaque changement de schéma avant déploiement ;
2. vérifier qu’il peut être rejoué sans erreur ;
3. considérer `fly deploy` comme une opération de migration ;
4. contrôler les logs de démarrage après déploiement.

## Tickets de caisse

Les tickets bruts et leurs CSV restent dans `tickets/` (ignoré par Git).
`node tickets/extraire.cjs` puis `node tickets/correspondances.cjs`
régénèrent `achats.csv`, `promos.csv` et `correspondances.csv`. L'import
remplit `achats.tickets`, `achats.produits`, `achats.lignes` et
`achats.promos` ; il est rejouable (n'ajoute que les tickets absents, par
`code` date + magasin) et s'arrête sur un magasin inconnu ou une remise sans
promo :

```bash
node scripts/importer-tickets.js                                                                   # dev
DATABASE_URL="$(grep '^DATABASE_URL=' .env.production | cut -d= -f2-)" node scripts/importer-tickets.js   # production
```

Vérifier la première ligne affichée (`Base : ep-…`) avant de laisser
continuer. Les libellés listés « À classer » n'ont pas encore d'article.

Corriger le rangement d'un produit (libellé → article) après coup : modifier les règles de
`tickets/correspondances.cjs`, relancer `node tickets/correspondances.cjs`,
comparer l'ancien et le nouveau `correspondances.csv`, mettre les lignes changées
(`LIBELLÉ;aliment`) dans un fichier, puis l'appliquer sur chaque base :

```bash
node scripts/corriger-libelles.js fichier.txt                       # dev
DATABASE_URL="$(grep '^DATABASE_URL=' .env.production | cut -d= -f2-)" node scripts/corriger-libelles.js fichier.txt   # production
```

Chaque correction est gardée dans `tickets/corrections/`, nommée
`AAAA-MM-JJ-<type>-<sujet>` : `libelles` (fichier pour `corriger-libelles.js`)
`aliments` (SQL qui crée des aliments) ou `achats` (SQL qui corrige une ligne de ticket), tous deux lancés par
`node scripts/executer-sql.js fichier.sql`. Les
appliquer dans l'ordre des noms ; un fichier `aliments` passe avant les
`libelles` du même jour, qui pointent vers les aliments qu'il crée.

`tickets/correspondances.cjs` est rangé en sections, dans cet ordre : 1. non
alimentaire (aucun mot d'aliment ne doit capter un produit ménager) ; 2. faux
amis (bonbons, glaces, sirops, biscuits qui portent un nom d'aliment) ; 3.
ingrédients ajoutés comme aliments ; puis les règles générales. Un aliment Chow
est un ingrédient de recette ou de Stock : un produit acheté au moins 3 fois et
mal rangé devient un aliment, le reste va dans Hors Chow.

Leçons sur les règles : la première règle qui correspond gagne, donc une marque
dont le libellé contient un autre mot (« POM'LISSE CHIPS BARBECUE », « LAYS
BARBECUE », « LAIT ENT.POUDRE ») doit avoir sa règle avant celle de ce mot ; une
même marque peut faire plusieurs produits (Pom'lisse : chips et frites).

## Export des données

`node scripts/exporter-donnees.js` écrit dans `~/Perso/House Projects/family-hub-data/`
un CSV par table et par vue (lignes découpées par année), `README.md` tiré des
`COMMENT` de la base, et un `pg_dump` complet dans `sauvegardes/` (12 gardés,
hors Git). À lancer après chaque import de tickets et au moins chaque semaine,
avec le `DATABASE_URL` de production une fois la base migrée. Restaurer :
`pg_restore --no-owner -d "<url>" sauvegardes/AAAA-MM-JJ-family-hub.dump`.

## Adresse IP bloquée

Une IP bloquée après trop d’échecs de connexion se débloque en base :

```sql
DELETE FROM ip_bloquees WHERE ip = '<adresse>';
```

## Vérification

- routes et calculs : vérifier en lançant l’application et en appelant le
  chemin réel ;
- interface : cet environnement ne dispose pas de navigateur headless ;
  la vérification reste au niveau du code et des captures fournies ;
- appareil réel : Olumide effectue la validation finale ;
- `node scripts/verifier-api.js` (branche dev uniquement) appelle toutes les
  routes avec un compte de test, puis nettoie ;
- `npx jest` dans `frontend/` lance les tests de l’interface.

## Limites opérationnelles

- aucune supervision applicative dédiée ;
- aucune procédure de restauration documentée ;
- pas de pipeline CI ;
- pas de migration versionnée avec retour arrière ;
- pas de test de santé explicite au-delà du démarrage et des routes.

## Incidents et leçons

À relire avant de toucher à la base, au déploiement ou au démarrage du serveur.

### 2026-10 — Base Neon à court de calcul, nouvelle base de production

- **Symptôme :** Chow en panne en production ; le projet Neon `family-hub` affichait
  102,81 CU-heures pour une limite gratuite d'environ 100 par mois.
- **Cause :** la base de production ne se mettait jamais en veille (98 CU-h sur 17
  jours ≈ 0,25 CU en continu). Le serveur gardait une connexion `pg.Client` ouverte en
  permanence, et le nettoyage des sessions toutes les 15 min la réveillait.
- **Correctif :** `pg.Pool` avec `idleTimeoutMillis` (les connexions se ferment au
  repos) et nettoyage des sessions au démarrage seulement (commit « fix: Neon peut se
  mettre en veille »). Nouveau projet Neon gratuit `ep-aged-flower-b9sgwq8t`, données
  copiées par `pg_dump`/`pg_restore`, secret Fly `DATABASE_URL` mis à jour ; 12
  articles de Courses ajoutés entre-temps recopiés à la main.
- **À retenir :** ne jamais garder de connexion ou de minuteur qui réveille la base ;
  surveiller les CU-heures dans la console Neon. Des mots de passe Neon sont passés
  dans une conversation : les réinitialiser (Roles → Reset password) si ce n'est pas
  déjà fait.

### 2026-10-26 — Ancien projet `family-hub` en pause, dev déplacée

- **Symptôme :** le projet Neon `family-hub` (qui portait la branche dev
  `family-hub-dev`) a atteint sa limite gratuite du mois et a été mis en pause.
- **Correctif :** nouvelle branche `dev` (`ep-spring-truth-b9vjj7sz`) dans
  `family-hub-backup`, copiée depuis `production`, calcul fixé à 0,25 CU.
- **À retenir :** dev et production partagent désormais le calcul gratuit du même
  projet (environ 100 CU-heures par mois) : serveurs de test et scripts courts, puis
  arrêtés. L'ancien projet `family-hub` n'est plus utilisé.

### Panne DNS chez Fly

- `getaddrinfo EAI_AGAIN` au démarrage : les migrations ne trouvaient pas Neon, le
  processus sortait en erreur, Fly a relancé 10 fois puis arrêté la machine. Rien à
  corriger côté code ; après la panne, `fly machine restart -a ch-ow` ou ouvrir l'app.

### Déploiement

- L'application Fly est `ch-ow` (anciennement `chow-ejs`). Aucun déploiement
  automatique depuis GitHub : `git push` sauvegarde, `fly deploy` met en production
  depuis le dossier local.
- `fly deploy` rejoue les migrations du démarrage (tables `tickets`, `achats`,
  `libelles`, `ip_bloquees`, `indices_france`, colonnes `users.admin`,
  `foods.prix_habituel`…). L'import des tickets se lance à part, une fois.

### Pièges de développement

- **Redémarrer le serveur Node après chaque changement côté serveur.** Vite ne recharge
  que l'interface : « NaN », « 0 € » ou d'anciens libellés venaient presque toujours
  d'un serveur pas relancé.
- Modifier une quantité de Stock ne mettait pas `date_maj` à jour : les articles
  restaient « à vérifier » pour toujours (corrigé, toute modification compte comme
  vérification).
- Les tickets Leclerc n'impriment pas le poids des paquets, et plusieurs produits
  différents tombent sous un même aliment Chow (tomates cerises / grappe, poulet en
  barquette / sac de 2,5 kg) : c'est ce qui gonfle l'inflation du foyer. Formats connus
  à ajouter dans `FORMATS` de `tickets/extraire.cjs` ; libellés à classer dans les
  Paramètres.
