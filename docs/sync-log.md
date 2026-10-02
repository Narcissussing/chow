# Sync log — passages entre agents

File opérationnelle courte pour le travail qu’un autre agent doit exécuter ou
reprendre. Ce document n’est ni une spécification, ni un changelog, ni un
registre de bugs, ni une source d’architecture. Les informations durables
appartiennent au document qui en est responsable.

Lire `À faire` en premier. Ajouter une entrée uniquement lorsqu’un autre agent
doit agir ou reprendre, puis la retirer lorsque le passage est terminé. Les
instructions directes d’Olumide priment toujours.

## À faire

### Nouveau bug — achat compté deux fois (Courses)

- **Responsable** : agent disposant d'un accès Jira/Notion.
- **État** : corrigé localement le 2026-10-01, non commité (sera commité avec
  la migration) ; entrée complète dans `docs/bugs.md`.
- **Action** : créer Bug, Correction et BFV `En attente`, reporter la clé.

### Nouveau bug — en-tête de rayon vide (Courses)

- **Responsable** : agent disposant d'un accès Jira/Notion.
- **État** : corrigé localement le 2026-10-01, non commité ; entrée complète
  dans `docs/bugs.md` (clé à attribuer).
- **Action** : créer Bug, Correction et BFV `En attente`, puis reporter la clé
  dans `docs/bugs.md`.

### CHOW-56 — étapes de recette à valider

- **Responsable** : Olumide.
- **État** : implémentation locale terminée ; Jira et Notion créés.
- **Action** : vérifier la lecture par l’œil, puis la modification des étapes.
- **Production** : appliquer la migration via le prochain déploiement.

### CHOW-52 — données nutritionnelles en attente d’étiquettes

- **Responsable** : agent d’implémentation.
- **Action** : reprendre depuis l’entrée complète de `docs/bugs.md` après que
  Olumide aura fourni les six étiquettes. Jira et Notion ne sont pas
  nécessaires pour retrouver le contexte d’implémentation.
- **Blocage** : valeurs des étiquettes à fournir par Olumide.

### CHOW-51 — BFV en attente

- **Responsable** : Olumide.
- **État** : correction appliquée localement et sur Neon ; la BFV Notion
  existe avec le statut `En attente`.
- **Action** : effectuer la BFV dans l’application réelle.

### CHOW-53 — registres externes et confirmation Neon

- **Responsable** : agent disposant d’un accès Jira/Notion ; Olumide pour la
  confirmation en production.
- **État** : `mais-en-conserve` et `haricot-rouge-en-conserve` existent en
  local. Leur présence sur Neon a été supposée, mais pas confirmée.
- **Action** : confirmer Neon, puis reporter l’état final dans Jira/Notion.

## Règles de passage

- Attribuer le travail selon les capacités, pas selon le nom de l’outil : agent
  d’implémentation, agent disposant des accès aux trackers ou Olumide.
- Un agent sans accès Jira en écriture inscrit ici l’action requise pour un
  agent qui possède cet accès.
- Chaque passage doit être autonome : responsable, état actuel, prochaine
  action et blocage éventuel.
- Ne pas recopier ici un travail terminé déjà enregistré dans `docs/bugs.md`,
  `docs/changelog.md`, Jira, Notion ou Git.
