# Bugs

Registre local des anomalies Chow, synchronisé avec Notion
(Chow → Qualité (QA) → Anomalies pour les Bugs, puis
Chow → Qualité (QA) → BFV pour les Corrections et vérifications). Les entrées
les plus récentes apparaissent en premier.

**Champs** : clé (`CHOW-N`, numérotée dans Chow depuis l’abandon de Jira : suite des numéros, dans l’ordre de création, commune à tous les tickets du Kanban) · Titre · Étapes de reproduction · Résultat
attendu · Résultat obtenu · Fichiers concernés · Niveau
(Critique/Majeure/Mineure) · Statut (Ouvert/En cours/Corrigé) · Date de
signalement · Date de correction.

**Workflow** : Bug ouvert → Correction → BFV `En attente`, comme étapes
séparées et horodatées. L’agent crée la BFV après correction ; Olumide seul
l’exécute et renseigne son résultat.

---

<!--
### CHOW-103 — Suggestion d'ajout impossible à toucher quand les Courses sont vides

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/courses/CoursesPage.jsx`, `frontend/src/pages/courses/CoursesVide.css`
- **Date de signalement** : 2026-10-05
- **Date de correction** : 2026-10-05

**Étapes de reproduction** :

1. Vider la liste de Courses (par exemple en achetant les derniers articles).
2. Toucher « + », taper un aliment connu.
3. Toucher la suggestion.

**Résultat attendu** : l'aliment s'ajoute à la liste.

**Résultat obtenu** : le caddie de la liste vide reste affiché par-dessus la liste de suggestions ; le toucher arrive sur le caddie et rien n'est ajouté.

**Correction** : le caddie disparaît dès que le panneau d'ajout s'ouvre et ne capte plus aucun toucher (`pointer-events: none`). Test ajouté.

### CHOW-XXX — <titre>
- **Niveau**: Critique / Majeure / Mineure
- **Statut**: Ouvert
- **Fichiers concernés**: `chemin/vers/fichier.js`
- **Date de signalement**: AAAA-MM-JJ
- **Date de correction**: —

**Étapes de reproduction** :
1. …

**Résultat attendu** :
**Résultat obtenu** :

Correction :
-->

### CHOW-133 — Courses : la liste de recherche passe sous la barre d'outils

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/hooks/useListeDansEcran.js`
- **Date de signalement** : 2026-11-11
- **Date de correction** : 2026-11-11

**Étapes de reproduction** :

1. Courses sur téléphone, mode magasin, toucher « + ».
2. Taper « Suc » (clavier ouvert).

**Résultat attendu** : la liste entière, lisible, entre le champ et la barre du haut ou le clavier.

**Résultat obtenu** : la liste s'ouvre au-dessus du champ et son milieu passe sous la barre « Nom / magasin / + ».

**Correction** : la place au-dessus s'arrête sous les barres collées (pas seulement l'en-tête) ; si aucun côté n'a la place de 3 lignes, la page remonte une fois pour coller le champ sous la barre et la liste s'ouvre dessous, jusqu'au clavier. Vérifié dans Chrome en iPhone 13 sur un écran réduit à 330 px : liste à 139–295 px sous la barre (127 px), défilement 0 → 87 px.

### CHOW-132 — Courses : la liste de recherche ne défile pas

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/hooks/useListeDansEcran.js`, `frontend/src/components/CustomSelect.jsx`, `frontend/src/components/CustomSelect.css`, `PanneauAjout.jsx`, `StockPage.jsx`, `Cuisine.jsx`
- **Date de signalement** : 2026-11-11
- **Date de correction** : 2026-11-11

**Étapes de reproduction** :

1. Courses sur téléphone, toucher « + ».
2. Taper une lettre (« a »).
3. Faire glisser la liste des résultats.

**Résultat attendu** : la liste défile et montre les résultats suivants.

**Résultat obtenu** : rien ne défile ; la liste s'ouvre sous le champ, en bas de page, sous le clavier (779 à 1000 px sur un écran de 844 px).

**Correction** : la liste s'ouvre au-dessus du champ quand la place manque dessous, avec une hauteur limitée à l'écran visible (clavier exclu) ; même chose pour Stock, Calories et les menus des unités, qui défilent aussi désormais. Vérifié dans Chrome en iPhone 13 : liste à 508–729 px, défilement 0 → 150 px ; écran réduit à 480 px : liste à 215–436 px, défilement 0 → 153 px.

### CHOW-130 — Recette en modification : le menu des unités se ferme aussitôt ouvert

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/components/CustomSelect.jsx`
- **Date de signalement** : 2026-11-11
- **Date de correction** : 2026-11-11

**Étapes de reproduction** :

1. Calories, Recettes, ouvrir Tteokbokki, modifier.
2. Toucher l'unité d'un ingrédient au nom long (« Galettes de poisson (eomuk) »).

**Résultat attendu** : la liste des unités reste ouverte jusqu'au choix.

**Résultat obtenu** : la liste s'ouvre puis disparaît aussitôt.

**Correction** : les noms trop longs défilent seuls à chaque image, et la liste se fermait à tout défilement ; le défilement des `.nom-defile` est ignoré. Test ajouté (échoue sans la correction).

### CHOW-129 — Petit pot de crème au chocolat en double dans les Courses

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `db/migrations/2026-11-11-2-aliments-relies-article.sql`
- **Date de signalement** : 2026-11-11
- **Date de correction** : 2026-11-11
- **Environnement** : production seulement

**Étapes de reproduction** :

1. Courses, toucher « + ».
2. Taper « petit pot de crème ».

**Résultat attendu** : un seul Petit pot de crème (chocolat).

**Résultat obtenu** : deux, l'aliment et un article de la maison du même nom ; 20 autres aliments dans le même cas (ailerons de dinde, pain burger, chorizo…), leurs achats absents des Stats.

**Correction** : en production, 21 aliments n'avaient pas d'`article_id` ; la migration relie chacun à l'article de même identifiant (appliquée en production et en dev, 0 doublon restant).

### CHOW-126 — Panier en magasin : espaces entre les parts de la barre

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/courses/PanierMagasin.css`
- **Date de signalement** : 2026-11-11
- **Date de correction** : 2026-11-11

**Étapes de reproduction** :

1. Courses sur téléphone, mode magasin, plusieurs rayons dans la liste.
2. Mettre au chariot des articles de quelques rayons seulement.

**Résultat attendu** : les parts colorées se suivent en une seule barre.

**Résultat obtenu** : des espaces séparent les parts, plus larges quand des rayons n'ont encore rien au chariot.

**Correction** : la piste n'a plus d'écart entre les parts (chaque rayon, même vide, en ajoutait un) et les parts ne sont plus arrondies une à une ; seuls les bouts de la barre restent arrondis.

### CHOW-125 — Panier en magasin : les œufs comptés au prix d'une boîte chacun

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `index.js`, `db/vues.sql`
- **Date de signalement** : 2026-11-11
- **Date de correction** : 2026-11-11

**Étapes de reproduction** :

1. Courses, mode magasin, œufs dans la liste.
2. Prendre les œufs avec +10 / +20 (24 œufs).
3. Toucher la part Oeufs de la barre.

**Résultat attendu** : environ 5 € (21 à 25 centimes l'œuf).

**Résultat obtenu** : « 60 € sur 5 € » : chaque œuf compté au prix d'une boîte (24 × 2,49 €).

**Correction** : `v_lignes_stats` garde le nombre de pièces par produit (`pieces` : œufs par boîte) et le chariot prend le prix à la pièce de la même boîte de référence (0,21 € l'œuf). Vérifié sur la base dev ; vérification dans l'app à faire.

### CHOW-124 — Courses défilées : le caddie et ses logos passent sur le bouton de tri

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/courses/TiroirMagasins.jsx`, `frontend/src/pages/courses/CoursesPage.css`
- **Date de signalement** : 2026-11-09
- **Date de correction** : 2026-11-09

**Étapes de reproduction** :

1. Courses sur téléphone, mode magasin, faire défiler la liste (le compteur rejoint la barre).
2. Deux touchers sur le caddie pour sortir les logos (ou les sortir en haut de page, puis faire défiler).

**Résultat attendu** : le caddie et les logos tiennent entre « Nom » et « + », les logos glissent de côté.

**Résultat obtenu** : le caddie se place sur le bouton « Nom ».

**Correction** : le tiroir se place d'après le bouton de tri lui-même, la zone de tri ne rétrécit plus quand le compteur rejoint la barre, et la place est recalculée quand la barre change (tiroir ouvert puis page défilée), d'après la place du caddie au repos (sinon il partait jusqu'au tri avant de revenir).

### CHOW-120 — Calories garde une unité ou un ordre que le serveur n'a pas enregistré

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/calories/cuisine/Cuisine.jsx`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Calories, couper le réseau.
2. Changer l'unité d'une ligne, ou glisser une ligne.

**Résultat attendu** : un message, et l'état d'avant revient.

**Résultat obtenu** : l'écran garde le changement sans rien dire ; au rechargement, l'ancien revient.

**Correction** : en cas d'échec (réseau ou refus du serveur), l'unité ou l'ordre d'avant est remis et un message s'affiche.

### CHOW-121 — Stock : l'envoi aux Courses échoue en silence et bloque le bouton

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/stock/StockPage.jsx`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Stock, couper le réseau.
2. Toucher le chariot d'un article, ou supprimer un article.

**Résultat attendu** : un message, et le bouton reste utilisable.

**Résultat obtenu** : rien ne s'affiche ; le chariot reste désactivé jusqu'au rechargement.

**Correction** : l'échec réseau affiche « Connexion instable » et rend le bouton ; même message pour la suppression et la modification de quantité.

### CHOW-122 — Noms de recettes et de suggestions du Stock coupés par « … »

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/calories/recettes/Recettes.css`, `frontend/src/pages/stock/StockSuggestions.css`, `frontend/src/pages/stock/StockSuggestions.jsx`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Recettes en vue liste, ou suggestions « À racheter » du Stock, avec un nom long.

**Résultat attendu** : le nom défile sur une ligne, fondu à droite.

**Résultat obtenu** : le nom est coupé par « … ».

**Correction** : les deux noms utilisent `.nom-defile` ; la règle qui forçait l'ellipse est retirée.

### CHOW-123 — La recherche Calories montre tout le catalogue

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/calories/cuisine/Cuisine.jsx`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Calories, taper « a » dans la recherche.

**Résultat attendu** : 5 résultats au plus.

**Résultat obtenu** : presque tous les aliments.

**Correction** : seuls les 5 premiers aliments trouvés s'affichent.

**Remplacé le 2026-11-11** (demande d'Olumide) : tous les résultats, classés par usage, dans une liste haute de 5 lignes qui défile.

### CHOW-117 — Deux reçus du même jour fusionnés, deux reçus Leclerc comptés double

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `tickets/extraire.cjs`, `scripts/importer-tickets.js`, `db/migrations/2026-11-03-1-un-ticket-par-recu.sql`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Stats, Tickets : Leclerc Brezet le 26/11/2024 ou le 05/12/2024.
2. Regarder un jour à deux passages (Leclerc Brezet 01/08/2025).

**Résultat attendu** : un ticket par reçu, au montant du reçu.

**Résultat obtenu** : les reçus 007W00D900 et 00BJA03I00, enregistrés deux fois, comptent double (142,80 € au lieu de 71,40 €, 128,14 € au lieu de 64,07 € : 135,47 € de trop) ; 15 jours à deux passages ne font qu'un ticket.

**Correction** : `extraire.cjs` garde le numéro de chaque reçu (colonne `recu`) et ne lit qu'une fois un reçu en double ; l'import fait un ticket par reçu (`tickets.numero`) et le plus gros du jour garde son ancien code. La migration retire les lignes en double et sépare les 15 passages, sans toucher un ticket qui ne correspond pas au fichier.

### CHOW-118 — Le modèle « Courses de la semaine » perd les articles de la maison

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `index.js`, `frontend/src/pages/courses/CoursesPage.jsx`, `frontend/src/pages/courses/photos.js`, `db/migrations/2026-11-03-2-courses-une-cible.sql`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Mettre un article de la maison dans les Courses.
2. Enregistrer la liste comme Courses de la semaine, puis l'appliquer.

**Résultat attendu** : l'article de la maison revient dans la liste.

**Résultat obtenu** : il est enregistré en ligne vide, et l'application du modèle échoue (`toLowerCase` sur une valeur nulle).

**Correction** : le modèle garde `article_id` ; l'application compare aliment, article ou texte libre avant d'ajouter.

### CHOW-119 — Une ligne de Courses peut ne viser rien, ou deux choses

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `db/migrations/2026-11-03-2-courses-une-cible.sql`, `index.js`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Écrire en base une ligne de Courses sans aliment, article ni texte (ou aliment et texte).

**Résultat attendu** : la base la refuse.

**Résultat obtenu** : elle est acceptée et ne peut pas être affichée correctement.

**Correction** : lignes impossibles nettoyées, puis règle « une seule cible » sur `chow.courses` et `chow.courses_modeles` ; l'ajout refuse un texte vide.

### CHOW-111 — L'estimation des Courses oublie les articles de la maison et compte des prix de promo

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `index.js`, `stats.js`, `frontend/src/pages/courses/EstimationCourses.jsx`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Mettre un article de la maison (lessive, essuie-tout) déjà acheté sur un ticket dans les Courses.
2. Ouvrir la fourchette des Courses.

**Résultat attendu** : chaque article de la liste a sa ligne, avec le prix normal de ses derniers achats.

**Résultat obtenu** : l'article de la maison compte « sans prix » et n'a pas de ligne ; le total d'articles ne correspond pas au détail ; un aliment acheté seulement en promo, ou sans unité commune, était estimé au prix remisé.

**Correction** : l'estimation lit aussi les articles de la maison (médiane des 8 dernières lignes, hors promo d'abord, prix avant remise sauf article acheté seulement en promo), comme le panier du mode magasin. Sans passage hors promo, le prix avant remise sert de référence. Les aliments gardent leur dernier vrai prix même acheté il y a plus de 12 mois, puis le prix moyen en magasin. Chaque article compté a sa ligne, texte libre compris (« aucun prix connu »).

### CHOW-112 — Une entrée Calories accepte une quantité négative

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `index.js`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Appeler `POST /api/calories/ajouter` ou `/modifier` avec une quantité de -100.

**Résultat attendu** : la quantité est refusée.

**Résultat obtenu** : l'entrée est enregistrée avec des calories et macros négatives.

**Correction** : le serveur exige un nombre fini strictement positif à l'ajout et à la modification (400 sinon).

### CHOW-113 — Les scripts de données écrivent sur la production sans garde

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `scripts/garde-base.js`, `scripts/importer-tickets.js`, `scripts/corriger-libelles.js`, `scripts/executer-sql.js`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Lancer un des scripts avec le `DATABASE_URL` de production.

**Résultat attendu** : le script s'arrête sauf demande explicite.

**Résultat obtenu** : il affiche la base et continue.

**Correction** : les trois scripts refusent toute base autre que la branche dev sans `--prod` en dernier argument.

### CHOW-114 — Modifier un article disparu répond « succès »

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `index.js`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Modifier une ligne de Stock ou une entrée Calories supprimée entre-temps (autre appareil).

**Résultat attendu** : une erreur « introuvable ».

**Résultat obtenu** : succès sans rien modifier ; Calories renvoie un `item` vide.

**Correction** : les deux routes vérifient le nombre de lignes modifiées et renvoient 404.

### CHOW-115 — « Aliments jetés » s'ouvre sur le mois précédent la nuit du 1er

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/parametres/FeuilleJetes.jsx`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Ouvrir Paramètres, Aliments jetés, le 1er du mois avant 1 h ou 2 h du matin.

**Résultat attendu** : le mois en cours.

**Résultat obtenu** : le mois précédent (mois calculé en UTC).

**Correction** : le mois courant vient de la date locale.

### CHOW-116 — Deux ajouts simultanés dans Calories prennent le même ordre

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `index.js`
- **Date de signalement** : 2026-11-03 (audit `docs/audits/2026-11-03-audit-donnees-comportements.md`)
- **Date de correction** : 2026-11-03

**Étapes de reproduction** :

1. Ajouter deux aliments au journal au même instant (deux appareils).

**Résultat attendu** : un ordre stable.

**Résultat obtenu** : même `ordre`, ordre d'affichage indéterminé.

**Correction** : le journal du jour se trie aussi par identifiant, qui départage les ex æquo.

### CHOW-110 — Le « i » n'est pas aligné avec son titre (Économiser, Inflation)

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/stats/FeuilleTickets.css`, `frontend/src/pages/stats/StatsPage.css`
- **Date de signalement** : 2026-10-31
- **Date de correction** : 2026-10-31

**Étapes de reproduction** :

1. Stats, ouvrir les Tickets.
2. Regarder « Économiser » et son bouton « i » ; puis « Inflation » et son ⓘ dans les Stats.

**Résultat attendu** : le bouton est centré verticalement sur le titre.

**Résultat obtenu** : le bouton est décalé vers le bas par rapport au texte.

**Correction** : le conteneur du bouton héritait de la hauteur de ligne du texte (1,6) et posait le bouton sur la ligne de base ; il passe en flex et le bouton centre son glyphe. Dans les Tickets, la marge basse de `.fiche h3` remontait aussi le titre de 4 px : annulée.

### CHOW-109 — Spaghetti à 5,1 kg par achat (contenances mal lues sur les tickets)

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `tickets/extraire.cjs`, `tickets/correspondances.csv`, `db/migrations/2026-10-31-1-oeufs-marche-frais.sql`, `db/migrations/2026-10-31-2-donnees-tickets.sql`
- **Date de signalement** : 2026-10-31
- **Date de correction** : 2026-10-31

**Étapes de reproduction** :

1. Courses : ajouter Spaghetti.
2. Ouvrir le détail de l'estimation.

**Résultat attendu** : 1 kg par achat, environ 1,90 €/kg.

**Résultat obtenu** : 5,1 kg par achat, 0,35 €/kg (« PATES SPAGHETTI N 5.1KG » lu comme 5,1 kg).

**Correction** : 21 contenances corrigées (virgule ou point lus comme décimale : « X2,300G », « 1.125G » ; numéro de pâtes), œufs Marché Frais par 12, jus d'orange, sauce poivron et steak végétal rangés au bon article, 65 remises Carrefour notées en promo. Payé inchangé (contrôle dans la migration).

### CHOW-108 — Fenêtres qui ne se ferment pas pareil, ✕ qui part en défilant

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/components/BoutonFermer.jsx`, `frontend/src/hooks/useGlisserPourFermer.js`, `frontend/src/pages/stats/FicheProduit.jsx`, `frontend/src/pages/stats/ListeProduits.jsx`, `frontend/src/pages/stats/StatsPage.jsx`, `frontend/src/pages/courses/EstimationCourses.jsx`, `frontend/src/pages/courses/PhotoApercu.jsx`, `frontend/src/pages/calories/recettes/RecetteSheet.jsx`
- **Date de signalement** : 2026-10-30
- **Date de correction** : 2026-10-30

**Étapes de reproduction** :

1. Téléphone, Stats : ouvrir « Les prix », puis un produit ; faire défiler la fiche.
2. Comparer le ✕ avec celui des Courses (estimation) et d'une recette.
3. Tirer une fenêtre vers le bas depuis le haut.

**Résultat attendu** : même ✕ partout, en-tête qui reste en haut, tirer vers le bas ferme toute fenêtre.

**Résultat obtenu** : ✕ de tailles et d'icônes différentes ; dans la fiche produit et la recette, l'en-tête et le ✕ défilent hors de l'écran ; les bulles d'info sur téléphone n'ont pas de ✕ ; tirer vers le bas ne ferme rien.

**Correction** : un ✕ commun, en-têtes collés en haut, geste « tirer pour fermer » commun à toutes les fenêtres (sauf depuis une liste déjà descendue ou une courbe ; en modification de recette, seulement depuis l'en-tête). Tests ajoutés.

### CHOW-107 — Les ingrédients volent en modifiant une recette

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/calories/recettes/RecetteSheet.jsx`
- **Date de signalement** : 2026-10-30
- **Date de correction** : 2026-10-30

**Étapes de reproduction** :

1. Calories, Recettes : ouvrir une recette existante, la modifier.
2. Enregistrer.

**Résultat attendu** : pas de vol d'ingrédients ; seule une nouvelle recette les envoie vers l'onglet Recettes.

**Résultat obtenu** : les emojis des ingrédients volent vers l'onglet Recettes comme pour une création.

**Correction** : le vol n'est lancé que pour une nouvelle recette.

### CHOW-106 — Semaines des Stats décalées (mercredi au mardi)

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/stats/Filtres.jsx`
- **Date de signalement** : 2026-10-30
- **Date de correction** : 2026-10-30

**Étapes de reproduction** :

1. Stats, choisir la période « Semaine ».
2. Lire le libellé, puis reculer avec ‹.

**Résultat attendu** : semaines du lundi au dimanche (12–18 oct., 19–25 oct., 26 oct.–1 nov.).

**Résultat obtenu** : le libellé part du jour du dernier achat (7–13 oct., 14–20 oct., 21…) ; les montants, eux, sont bien calculés du lundi au dimanche.

**Correction** : le libellé et les flèches partent du lundi de la semaine. Test ajouté.

### CHOW-105 — Compteur des Courses bloqué dans la barre après remontée

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/courses/CoursesPage.jsx`
- **Date de signalement** : 2026-10-13
- **Date de correction** : 2026-10-13

**Étapes de reproduction** :

1. iPhone, Courses : faire défiler vers le bas, le compteur rejoint la barre (tri, magasin, +).
2. Remonter tout en haut.

**Résultat attendu** : le compteur revient à côté du titre « Courses ».

**Résultat obtenu** : le compteur reste dans la barre.

**Correction** : sans le compteur, le titre devenait plus bas que la barre collante (≈ 51 px contre ≈ 62 px) et n'était plus jamais détecté comme visible. Une réserve invisible garde au titre la taille du compteur.

### CHOW-104 — Liste d'unités coupée en bas de l'écran

- **Niveau** : Mineure
- **Statut** : Ouvert
- **Fichiers concernés** : `frontend/src/components/CustomSelect.jsx`, `frontend/src/components/CustomSelect.css`
- **Date de signalement** : 2026-10-08
- **Date de correction** : —
- **Notion** : https://app.notion.com/p/3f33344c68fa81e2bb1fdbc8d312f61d

**Étapes de reproduction** :

1. iPhone, Calories : ajouter assez d'aliments pour que le dernier soit en bas de l'écran.
2. Ouvrir la liste d'unités du dernier aliment (ex. Huile d'Olive).

**Résultat attendu** : toutes les unités sont visibles et sélectionnables.

**Résultat obtenu** : la liste est coupée par le bas de l'écran ; les dernières unités sont inaccessibles. Faire défiler la page ferme la liste.

### CHOW-77 — Le panneau recette ne défile plus

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/hooks/useVerrouDefilement.js`, `frontend/src/pages/calories/RecetteSheet.jsx`
- **Date de signalement** : 2026-10-02
- **Date de correction** : 2026-10-02

**Étapes de reproduction** :

1. iPhone, Calories → Recettes, ouvrir une recette longue.
2. Faire glisser le panneau vers le haut.

**Résultat attendu** : la recette défile, la page derrière reste figée.

**Résultat obtenu** : la recette ne défile pas.

**Correction** : panneau à la hauteur visible réelle (`100dvh`, marge pour la barre Safari) au lieu de `100vh`, qui cachait le bas sous la barre ; le verrou de page laisse défiler les listes des sélecteurs. Cause sur iPhone non confirmée : à vérifier en BFV.

### CHOW-78 — Listes déroulantes de plus de 5 lignes

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `public/css/style.css` (limite posée par id), `public/css/etats.css`
- **Date de signalement** : 2026-10-02
- **Date de correction** : 2026-10-02

**Étapes de reproduction** :

1. Calories → Adapter, ouvrir la liste des recettes.

**Résultat attendu** : 5 lignes visibles, le reste en défilant, comme partout.

**Résultat obtenu** : toute la liste s'affiche ; la limite ne vise que les
deux sélecteurs de recettes de la Cuisine.

**Correction** : limite de 5 lignes (215 px, défilement) appliquée à toutes les `.custom-select__list` dans `etats.css`.

### CHOW-79 — Quantités adaptées sans arrondi

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `frontend/src/pages/calories/RecetteSheet.jsx` (`nouvelleLigne`), `AdapterRecette.jsx`
- **Date de signalement** : 2026-10-02
- **Date de correction** : 2026-10-02

**Étapes de reproduction** :

1. Calories → Adapter, choisir une recette en grammes.
2. Saisir une quantité qui donne un rapport non rond (ex. 100 g au lieu de 300 g).

**Résultat attendu** : valeurs arrondies : entier sans décimale, sinon une seule (`toFixed(1)`).

**Résultat obtenu** : valeurs brutes (ex. 166.66666666666666 g).

**Correction** : grammes arrondis au centième dans `nouvelleLigne` ; RègleX affiche un entier sans décimale, sinon une décimale (`toFixed(1)`).

### CHOW-76 — Champs de saisie de tailles différentes

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `public/css/style.css`, `public/css/etats.css`
- **Date de signalement** : 2026-10-02
- **Date de correction** : 2026-10-02

**Étapes de reproduction** :

1. Comparer les champs de quantité (Cuisine, recette, Adapter, Courses).

**Résultat attendu** : tous les champs ont la même taille.

**Résultat obtenu** : largeurs et hauteurs différentes selon la page.

**Correction** : hauteur 38 px et texte 0,9 rem pour tous les champs ; champs de quantité à 80 px de large (`etats.css`).

### CHOW-58 — Achat compté deux fois dans le Stock

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `index.js` (`POST /courses/acheter`)
- **Date de signalement** : 2026-10-01
- **Date de correction** : 2026-10-01
- **Jira** : à créer (agent avec accès Jira)

**Étapes de reproduction** :

1. En magasin, réseau instable : marquer un article comme acheté.
2. La réponse se perd ; `fetchAvecRetry` renvoie la requête après 800 ms.

**Résultat attendu** : la quantité est ajoutée une seule fois au Stock.

**Résultat obtenu** : chaque envoi ajoutait la quantité, l'achat pouvait
compter deux fois.

**Correction** : l'achat est marqué d'abord, dans une transaction,
seulement si `achete = false` ; un envoi répété ne touche plus au Stock.
Vérifié sur la branche Neon dev : deux envois de +3 → +3, trois envois
simultanés de +2 → +2 ; données de test supprimées. BFV : en magasin, acheter
un article avec un réseau faible et contrôler le Stock.

### CHOW-59 — En-tête de rayon vide après un achat (tri Catégorie)

- **Niveau** : Mineure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : `public/js/courses.js`
- **Date de signalement** : 2026-10-01
- **Date de correction** : 2026-10-01
- **Jira** : à créer (agent avec accès Jira)

**Étapes de reproduction** :

1. Courses, trier par « Catégorie ».
2. Marquer comme acheté (ou supprimer) le dernier article d'un rayon.

**Résultat attendu** : l'en-tête du rayon disparaît avec son dernier article.

**Résultat obtenu** : l'en-tête reste affiché jusqu'au rechargement.

**Correction** : `retirerItem` retire désormais les en-têtes qui ne sont
plus suivis d'un article (`retirerEntetesVides`). BFV : trier par Catégorie,
acheter puis supprimer le dernier article de deux rayons, sans recharger.

### CHOW-52 — Valeurs nutritionnelles incohérentes entre portion et 100 g

- **Niveau** : Majeure
- **Statut** : Ouvert
- **Fichiers concernés** : données `foods` ; calculs consommateurs dans
  `index.js`
- **Date de signalement** : 2026-08-05
- **Date de correction** : —
- **Jira** : https://oyinloyemide-1785766576452.atlassian.net/browse/CHOW-52
- **Notion** : https://app.notion.com/p/3b33344c68fa8139bb23c2a32c8197bd

**Étapes de reproduction** :

1. Ouvrir un aliment concerné.
2. Consulter ses calories et macros.
3. L’ajouter au Journal ou à une Recette.
4. Comparer le calcul avec l’étiquette sur une base de 100 g.

**Résultat attendu** : toutes les valeurs nutritionnelles utilisent une
référence cohérente pour 100 g ; `poids_unite_g` ne sert qu’à convertir les
portions.

**Résultat obtenu** : l’audit en lecture seule de toute la table `foods` a
identifié six incohérences à confirmer :

- **Crème Fouettée** : 17,22 kcal et les macros semblent stockées pour une
  portion de 6 g, alors que l’application les traite comme des valeurs/100 g.
- **Oeuf Large** : 90 kcal et les macros semblent correspondre à une pièce de
  61 g ; équivalent attendu ≈ 148 kcal/100 g.
- **Oeuf Moyen** : 80 kcal et les macros semblent correspondre à une pièce de
  55 g ; équivalent attendu ≈ 145 kcal/100 g.
- **Knacki Poulet** : 90 kcal et les macros sont cohérentes avec une pièce de
  40 g, pas avec 100 g ; étiquette produit à confirmer.
- **Poundo Yam** : 370 kcal/100 g est plausible pour la farine sèche, mais les
  macros stockées ne fournissent qu’environ 119 kcal ; étiquette à confirmer.
- **Salsa** : 6,8 kcal, portion de 15 g et macros incompatibles entre elles ;
  étiquette ou recette exacte à confirmer.

**Correction** : œufs corrigés le 2026-10-02 (dev et production) : un seul
« Oeuf » (`oeuf-moyen`, 55 g la pièce) aux valeurs ramenées à 100 g
(145,5 kcal) ; « Oeuf Large », inutilisé, supprimé. Reste : confirmer les
étiquettes, surtout Knacki Poulet, Poundo Yam et Salsa. Les autres écarts détectés par la formule macros →
énergie peuvent venir des fibres, de l’alcool ou des arrondis et ne suffisent
pas seuls à justifier une modification.

### CHOW-51 — Calories du Haricot niébé environ trois fois trop élevées

- **Niveau** : Majeure
- **Statut** : Corrigé (BFV en attente)
- **Fichiers concernés** : donnée `foods.calories/glucides/proteines/lipides`
  du Haricot niébé
- **Date de signalement** : 2026-08-05
- **Date de correction** : 2026-08-05
- **Jira** : https://oyinloyemide-1785766576452.atlassian.net/browse/CHOW-51

**Étapes de reproduction** :

1. Ouvrir Chow.
2. Sélectionner « Haricot niébé » dans le catalogue ou le Journal.
3. Consulter la valeur calorique affichée pour 100 g.
4. Comparer avec la valeur nutritionnelle correcte du produit.

**Résultat attendu** : la valeur calorique correspond à la valeur correcte
pour 100 g.

**Résultat obtenu** : la valeur affichée paraît environ trois fois trop
élevée, ce qui fausse le Journal et les recettes.

**Correction** : la base avait la référence *cuit* (116 kcal), le produit
est suivi *sec*. Corrigé avec l'étiquette d'Olumide (pour 100 g, sec) :
311 kcal, 44.34 g glucides, 22.45 g protéines, 1.32 g lipides, 16.24 g
fibres, 3.38 g sucres, 0.19 g saturés, 0.02 g sel. Appliqué en local puis
Neon. À faire : BFV (Olumide), et vérifier si `pois-chiches` doit aussi
passer sec.
