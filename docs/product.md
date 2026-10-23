# Produit

## Vision

Chow centralise le suivi alimentaire quotidien d’un foyer de deux personnes.
L’application doit rester rapide sur mobile, utilisable pendant les courses et
assez simple pour être administrée sans interface dédiée.

## Domaines fonctionnels

### Aliments

Référentiel des aliments connus et de leurs informations nutritionnelles.

- recherche insensible aux accents ;
- filtres par catégorie et tri par nom ou nutrition ;
- fiche détaillée ;
- équivalences propres à chaque aliment pour cuillère à café, cuillère à
  soupe et poids d’une unité.

Les Aliments ne sont plus dans la navigation : ils se trouvent dans les
Paramètres (`/parametres/aliments`), réservés à l’administrateur. La création
et la suppression ne sont pas exposées dans l’interface.

### Accueil

Trois cartes chiffrées : Stats (dépensé ce mois, cette semaine et le mois
dernier), Stock (aliments encore présents, dont ceux à vérifier) et Courses
(articles à acheter et estimation du montant).

### Dépenses et estimation des Courses

Historique des tickets de caisse (Leclerc, Carrefour, Marché Frais) importé
dans `tickets`, `achats` et `libelles`. L’estimation des Courses ne demande
aucune quantité : quantité habituelle (8 derniers passages en caisse, 12
derniers mois) × dernier prix payé, avec une fourchette ; sans historique,
`foods.prix_habituel`. La page Stats suit la maquette Figma « Chow ».

### Stock

Inventaire de ce qui est disponible à la maison.

- quantités adaptées aux suivis `unite`, `pack` et `cl` ;
- emplacements Frigo, Congélateur et Réserve ;
- recherche, filtres, tris et vues grille/liste ;
- ajout, modification, suppression et ajustements rapides ;
- envoi vers Courses sans doublon actif ;
- filtre « À vérifier » : aliments encore présents sans mise à jour depuis 3
  semaines.

### Courses

Liste de courses utilisable avant et pendant les achats.

- aliments connus ou articles en texte libre ;
- notes et photos de référence ;
- filtres et regroupement par rayon ;
- preset hebdomadaire modifiable ;
- achat avec mise à jour du Stock ;
- protection contre les doubles soumissions et actions accidentelles.

Un achat passe `achete` à `true` ; il ne supprime pas l’historique.

### Calories

Cuisine : suivi nutritionnel de la journée courante (onglet appelé « Journal »
jusqu'au 2026-10-01).

- ajout d’aliments en grammes, cuillères ou pièces ;
- calcul des calories et macronutriments à partir des valeurs pour 100 g ;
- modification, suppression, réordonnancement et vidage ;
- conversion de la Cuisine en recette.

### Recettes

Groupes réutilisables d’aliments et de quantités.

- création, consultation, modification et suppression ;
- consultation et modification des étapes de préparation ;
- catégories Plat, Fraîcheur et Glace ;
- tri et vues grille/liste indépendantes ;
- application à la Cuisine du jour.

Appliquer une recette remplace la Cuisine du jour. À l’inverse, appliquer le
preset hebdomadaire ajoute uniquement les courses manquantes.

## Utilisateurs et accès

- deux comptes privés ;
- aucune inscription publique ;
- toutes les pages, sauf la connexion, exigent une session ;
- un administrateur (`users.admin`, le compte d’Olumide) accède seul aux
  Paramètres ; le serveur refuse ces routes aux autres comptes (403) ;
- connexion limitée : 5 échecs en 15 min bloquent l’adresse IP 30 jours
  (table `ip_bloquees`), 10 échecs verrouillent l’email 15 min ;
- les comptes sont créés ou réinitialisés avec
  `scripts/creer-utilisateur.js`.

## Hors périmètre actuel

- administration du catalogue depuis l’interface ;
- inscription et gestion autonome des comptes ;
- historique nutritionnel multi-jour dans l’interface ;
- API publique.

Le travail futur est suivi dans Jira, notamment les tests automatisés, la
modularisation du backend et la migration éventuelle vers React.
