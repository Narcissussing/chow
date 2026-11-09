# Plan d’audit complet — 2026-11-03

Ce plan suit la revue de l’interface, de la présentation et de la cohérence des données dans Chow. Les constats sont consignés dans [l’audit données et comportements](2026-11-03-audit-donnees-comportements.md), sans modifier l’application.

## Règle de suivi

Parcours examinés dans l’ordre de navigation ; pour chaque parcours, noter les faits affichés, leur source/calcul, états chargement-vide-erreur, interactions, mobile/desktop, cohérence avec le design system. Distinguer code lu, données réellement interrogées et interface observée. Une anomalie découverte est rapportée, pas corrigée dans cet audit.

## Périmètre

- [x] Socle : navigation, connexion, chargement/erreur, styles partagés et responsive (revue de code).
- [x] Accueil : KPIs, libellés, liens, actions rapides et données actualisées (revue de code).
- [x] Stats : périodes/magasins, montants, comparaison, inflation, rayons, prix, tickets, fiches et plan (revue de code et rapport précédent).
- [x] Stock : quantités/unités, emplacement, filtres, tri, ajout/modification/suppression et suggestions (revue de code).
- [x] Courses : aliments/articles/texte libre, prix, estimation, magasins/tournée, panier, achat, preset, photo/note et synchronisation (revue de code et rapport précédent).
- [x] Calories : ajout, conversion, quantités, ordre, suppression, totaux et vue mobile (revue de code).
- [x] Recettes : création/édition, ingrédients, conversions, étapes, catégories, application à Calories (revue de code).
- [x] Paramètres : accès admin, aliments, équivalences, catégories, prix et aliments jetés (revue de code).
- [x] Cohérence transversale : libellés, monnaie/unités/dates, sources, totaux, états sans données, notifications et accessibilité (revue des parcours et conventions).
- [x] Vérification finale : constats référencés, niveaux et limites indiqués dans le rapport.
- [ ] Contrôle navigateur téléphone/desktop et interrogation lecture seule de Neon : non effectués dans cet audit.

## Préférences de revue appliquées

- Interface mobile d’abord, texte minimal, DM Sans, pas de Playfair ni de bande colorée en bord de carte.
- Les montants passent avant les comptes ; intitulés neutres pour le foyer ; noms jamais tronqués dans les listes.
- Contrôles globaux cohérents, états vides utiles, détails en fenêtres adaptées au téléphone, animations d’entrée et de sortie.
- Audit non destructif : ne pas écrire en base, ne pas modifier le code produit, ne pas toucher aux modifications préexistantes.

## Journal d’avancement

- 2026-11-03 — Skills projet et design-web/figma-maquettes lus ; préférences et historique local Chow consultés.
- 2026-11-03 — Documentation produit, architecture, données, qualité et exploitation parcourue ; inventaire des pages React établi.
- 2026-11-03 — Revue statique des pages, composants partagés et principaux parcours ; constats et pistes UI ajoutés au rapport.
- 2026-11-03 — Audit clos au niveau du code local. Les données réelles de Neon et le rendu dans un navigateur restent à vérifier séparément.
