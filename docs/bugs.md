# Bugs

Registre local des anomalies Chow, synchronisé avec Notion
(Chow → Qualité (QA) → Anomalies pour les Bugs, puis
Chow → Qualité (QA) → BFV pour les Corrections et vérifications). Les entrées
les plus récentes apparaissent en premier.

**Champs** : clé Jira (`CHOW-N`) · Titre · Étapes de reproduction · Résultat
attendu · Résultat obtenu · Fichiers concernés · Niveau
(Critique/Majeure/Mineure) · Statut (Ouvert/En cours/Corrigé) · Date de
signalement · Date de correction.

**Workflow** : Bug ouvert → Correction → BFV `En attente`, comme étapes
séparées et horodatées. L’agent crée la BFV après correction ; Olumide seul
l’exécute et renseigne son résultat.

---

<!--
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

### CHOW-? — Le panneau recette ne défile plus

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

### CHOW-? — Listes déroulantes de plus de 5 lignes

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

### CHOW-? — Quantités adaptées sans arrondi

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

### CHOW-? — Champs de saisie de tailles différentes

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

### CHOW-? — Achat compté deux fois dans le Stock

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

### CHOW-? — En-tête de rayon vide après un achat (tri Catégorie)

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
