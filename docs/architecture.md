# Architecture

## Vue d’ensemble

Chow est une app React servie par un serveur Express qui expose une API JSON.

```text
Navigateur (app React, frontend/dist)
   │ fetch JSON vers /api/*
   ▼
Express 5 + Passport
   │ SQL brut via pg
   ▼
PostgreSQL sur Neon (branche dev en local, production sur Fly)
```

Pas d’ORM. `index.js` contient la configuration, les migrations au démarrage,
l’authentification, les accès aux données et toutes les routes `/api`. Cette
concentration est une dette technique suivie dans Jira.

## Structure

| Emplacement | Responsabilité |
|---|---|
| `index.js` | Serveur, SQL, migrations, authentification et routes |
| `frontend/` | App React (Vite) : pages, composants, hooks, tests Jest |
| `frontend/src/styles/` | Styles partagés : `base.css`, `communs.css`, `fin.css` |
| `*.css` à côté de chaque composant | Styles du composant (ex. `pages/stock/StockItem.css`) |
| `public/images/` | Photos et icônes SVG |
| `scripts/` | Administration ponctuelle, notamment les comptes |

## Cycle d’une requête

1. Express analyse les formulaires et sert les ressources statiques.
2. Les corps JSON sont acceptés jusqu’à 4 Mo pour les photos compressées.
4. La session PostgreSQL et Passport chargent l’utilisateur.
5. Les routes de connexion restent publiques.
6. `requireAuth` protège toutes les routes déclarées ensuite.
7. Les routes `/api` interrogent PostgreSQL et répondent en JSON. Les pages
   (`/`, `/stock`…) renvoient toutes `frontend/dist/index.html`.

L’ordre des middlewares est une contrainte de sécurité : toute nouvelle route
privée doit rester déclarée après `app.use(requireAuth)`.

## Carte des routes

| Domaine | Routes principales |
|---|---|
| Accès | `POST /api/login`, `POST /api/logout`, `GET /api/session` |
| Aliments | `GET /api/aliments`, `GET /api/aliments/:id`, créer, équivalences |
| Stock | `GET /api/stock`, ajouter, modifier, supprimer |
| Courses | `GET /api/courses`, ajouter, acheter, supprimer, notes, photos, preset |
| Calories | `GET /api/calories`, ajouter, modifier, supprimer, réordonner, vider |
| Recettes | créer, consulter, modifier, supprimer, appliquer à la Cuisine |

La liste exacte et les contrats de réponse restent définis par `index.js`.
Ce document décrit l’architecture, pas chaque gestionnaire ligne par ligne.

## Rendu et état client

- chaque page charge ses données d’un `GET /api/...` puis garde son état dans
  React ;
- les mutations passent par `api()` (`frontend/src/api.js`) et mettent l’état
  à jour sans rechargement ;
- les recherches, filtres, tris et bascules d’affichage restent locaux ;
- `CustomSelect.jsx` remplace les `select` natifs.

Les conventions visuelles et composants partagés sont documentés dans
[Design system](design-system.md).

## Authentification

Passport Local recherche l’utilisateur par email et compare le mot de passe
avec bcrypt. Seul l’identifiant est sérialisé ; l’utilisateur est rechargé
depuis PostgreSQL à chaque requête. Les sessions sont stockées en base afin
de survivre aux arrêts automatiques de Fly.io.

## Limites connues

- backend monolithique ;
- absence de tests automatisés et de lint ;
- migrations dispersées dans `index.js` ;
- pas de schéma SQL versionné séparément ;
- dépendance à des mises à jour DOM manuelles ;
- validation visuelle réelle nécessaire sur navigateur/appareil.

Les choix structurants et leurs raisons sont recensés dans
[Décisions](decisions.md).
