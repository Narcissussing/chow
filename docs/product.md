# Produit

## Vision

Chow centralise le suivi alimentaire quotidien d’un foyer de deux personnes.
L’application doit rester rapide sur mobile, utilisable pendant les courses et
assez simple pour être administrée sans interface dédiée.

## Domaines fonctionnels

### Aliments

Référentiel des aliments connus et de leurs informations nutritionnelles.

- recherche insensible aux accents ;
- recherche d'ajout (Courses, Stock, Calories) et filtre du Stock
  (`utils/recherche.js`) : chaque mot tapé dans n'importe quel ordre, une
  faute tolérée dès 4 lettres ; classement : noms qui commencent par le
  texte, puis ce que le foyer utilise le plus (tickets, ajouts aux Courses,
  repas, Stock à la maison ; poids divisé par deux tous les 4 mois environ,
  `popularite` calculée par le serveur), puis l'ordre alphabétique ; tous
  les résultats dans une liste haute de 5 lignes et demie qui défile ;
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

Historique des tickets de caisse (Leclerc, Carrefour, Marché Frais, Tiger
Market, Action) importé
dans `tickets`, `achats` et `libelles`. L’estimation des Courses ne demande
aucune quantité : quantité habituelle × dernier prix normal, dans le magasin
choisi en mode magasin. Les achats en promo ne comptent ni dans la quantité ni
dans le prix (le foyer achète plus quand c'est en promo). Épices et herbes
séchées : prix attendu de Leclerc, quel que soit le magasin. La fourchette vient
des écarts passés entre prévu et payé : elle se resserre à chaque nouveau
ticket. Articles de la maison : prix d'un passage en caisse, toutes ses lignes
comprises (deux adoucissants pris ensemble = deux). Sans historique, `foods.prix_habituel`. La fourchette
s'affiche à côté du titre des Courses ; un clic montre le détail par article.

La page Stats (maquette Figma « Chow ») suit un filtre global (période et
magasin) : dépensé, dépense par semaine, inflation du foyer comparée à l'INSEE
(alimentation ou tous les prix), prix des produits classés par dépense, fiche
produit (dépense par semaine et par mois), dépenses par rayon et par magasin,
semaine la plus chère.

Tickets (icône en haut à droite des Stats) : tout ce qui a été acheté sur un
jour, une semaine ou un mois, filtrable par magasin, en articles ou en tickets
(un ticket s'ouvre sur ses articles). Total en haut ; trois boutons
d'économie retirent du total : 1 « À arrêter » (chips, bonbons, chocolat, limonade,
`achats.articles.a_reduire = 1`), 2 « Desserts » (`a_reduire = 2`),
3 « Moins cher » (même article acheté au moins deux fois à 85 % du prix ou
moins, gain d'au moins 0,50 €). Listes par paliers : 10 lignes, puis 10, 20,
30 de plus.

Mon plan (depuis les Tickets) : pour chaque article proposé, garder, en
acheter moins (quantité visée par mois), arrêter ou changer pour le moins
cher ; économie par semaine, mois ou an. Un article gardé avec une préférence
(gros œufs à Marché Frais) n'est plus proposé moins cher. Aliments jetés
(Paramètres) : quantité jetée par mois et par aliment ; le plan propose d'en
acheter d'autant moins.

### Stock

Inventaire de ce qui est disponible à la maison.

- quantités adaptées aux suivis `unite`, `pack` et `cl` ;
- emplacements Frigo, Congélateur et Réserve ;
- recherche, filtres, tris et vues grille/liste ;
- ajout, modification, suppression et ajustements rapides ;
- envoi vers Courses sans doublon actif ;
- filtre « À vérifier » : aliments encore présents sans mise à jour depuis 3
  semaines, 4 jours pour les fruits et légumes hors congélateur et les restes
  ponctuels (aussi en tête de « Encore à la maison ? » sur l'Accueil) ;
- filtre « Ponctuel » (icône bol) quand il reste un achat ponctuel.

### Courses

Liste de courses utilisable avant et pendant les achats.

- aliments connus, articles de la maison (hygiène, entretien… avec l'icône de
  leur famille, regroupés sous la famille, sans Stock) ou texte libre ;
- notes et photos de référence : plusieurs par article (pastille du nombre sur
  l'œil dès deux), on glisse ou on touche les flèches pour passer de l'une à
  l'autre ; « Supprimer » retire celle affichée ;
- filtres et regroupement par rayon ;
- preset hebdomadaire modifiable ;
- caddie : un toucher entre ou sort du mode magasin ; deux touchers sortent
  « Tous » puis les logos (Leclerc, Carrefour, Marché Frais, Tiger Market,
  Action) pour choisir le magasin, en mode magasin ou non, sans changer le
  mode. Le magasin choisi s'affiche en pastille sur le caddie et filtre la
  liste et la fourchette ; il reste choisi en entrant ou sortant du mode
  magasin. Logos sortis, toucher le caddie, ailleurs, Échap ou défiler la page
  les range sans rien changer. Un article
  peut être dans plusieurs magasins : liste choisie (oignons et patate douce
  à Marché Frais, pommes de terre à Leclerc, papier toilette et essuie-tout à
  Leclerc et Action, rayon asiatique à Tiger Market), sinon tickets et cases
  cochées des 3 derniers mois. Les articles du magasin restent (et ceux sans
  magasin connu), les autres sont masqués ; la liste est relue toutes les 15 s et un article
  ajouté ailleurs fait sortir du filtre pour le voir arriver ;
- panier de la tournée en mode magasin, à la place du titre : barre par rayon
  (piste = toute la liste prévue, parts = ce qui est au chariot, collées
  sans espace, +1/+2/+5 comptés dans l'unité du Stock : un œuf au prix d'une
  boîte ÷ ses œufs, une portion de tteok au prix d'un sachet ÷ 3), total, prévu effacé quand le chariot l'atteint, repère
  et « +N € » au-delà ; toucher une part donne son rayon ; filtré par le magasin
  choisi ; version fine sous la barre d'outils quand on descend ;
- tournée sur un ou plusieurs magasins le même jour : ouverte par le mode magasin,
  fermée par deux touchers sur le panier puis ✓ et « Terminer ? », sinon
  terminée d'elle-même au premier minuit (heure de Paris), la page sortant alors
  du mode magasin ;
- hors magasin : fourchette prévue en petite pastille ticket à côté du titre ;
- achat avec mise à jour du Stock ;
- achat ponctuel (recette, événement) : bouton bol dans la ligne de note
  (toucher l'emoji), tuile bol sur la carte, filtre bol à côté de « Semaine »
  et en mode magasin. Acheté, il va au Stock (marqué ponctuel tant que rien
  d'habituel n'y était) mais n'entre ni dans les habitudes, ni dans les prix
  attendus, ni dans « À racheter » ; double tap sur + : mode ponctuel (bol
  sur le +), chaque ajout part ponctuel jusqu'au double tap suivant, à la
  sortie de Courses ou à la fermeture de l'app ;
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
- application à la Cuisine du jour ;
- envoi aux Courses (caddie) : la liste des ingrédients devient cochable ;
  absents du Stock cochés d'office, Stock affiché comme sur les cartes de
  Courses (nombre, ou point vert / jaune / orange / rouge), relu toutes les
  15 s et au retour sur l'app ; déjà sur la liste en caddie coché discret.
  Les cochés partent en ponctuel, avec la quantité de la recette en note ;
  un ingrédient déjà sur la liste touché est fusionné : sa ligne garde son
  état (ponctuel ou non, seul Courses le change) et reçoit la quantité en
  note, après une note existante et sans répéter la même quantité.

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
