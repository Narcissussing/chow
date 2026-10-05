# Exploitation

## Environnements

| Environnement | Base | Configuration |
|---|---|---|
| Local | Neon, branche `family-hub-dev` (`ep-spring-river-aslzwhz5`) | `DATABASE_URL` dans `.env` |
| Production | Neon, branche `production` (`ep-steep-glade-as56jlgu`) | `DATABASE_URL` en secret Fly |

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

## Vérification

- routes et calculs : vérifier en lançant l’application et en appelant le
  chemin réel ;
- interface : cet environnement ne dispose pas de navigateur headless ;
  la vérification reste au niveau du code et des captures fournies ;
- appareil réel : Olumide effectue la validation finale ;
- `npm test` est actuellement un script factice et ne constitue pas une
  vérification.

## Limites opérationnelles

- aucune supervision applicative dédiée ;
- aucune procédure de restauration documentée ;
- pas de pipeline CI ;
- pas de migration versionnée avec retour arrière ;
- pas de test de santé explicite au-delà du démarrage et des routes.
