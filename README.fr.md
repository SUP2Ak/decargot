# Decargot

[![release](https://img.shields.io/github/v/release/SUP2Ak/decargot?style=flat-square)](https://github.com/SUP2Ak/decargot/releases)

[![](https://img.shields.io/badge/English-000?style=for-the-badge&logo=github&logoColor=white)](README.md)

---

**Decargot** est une application de bureau moderne (Tauri + React + Mantine) pour Windows, permettant de scanner, visualiser et nettoyer facilement les dossiers `target` des projets Rust (Cargo) sur vos disques.

---

## Fonctionnalités

- **Scan rapide** de plusieurs dossiers/disques à la recherche de projets Cargo et de leurs dossiers `target`
- **Affichage de la taille** de chaque dossier `target` détecté
- **Suppression sécurisée et permanente** des dossiers `target` (pas de corbeille)
- **Barre de progression en temps réel** lors de la suppression, avec estimation de l'espace libéré
- **Détection et gestion des doublons** (même dossier `target` trouvé plusieurs fois)
- **Sélection multiple** et suppression groupée
- **UI moderne et réactive** (Mantine, React), thème sombre, animations fluides
- **Mise à jour intégrée** (vérification et installation en un clic)
- **Support Windows** (Linux/Mac prévu)

---

## Installation

1. **Téléchargez la dernière release `.msi** depuis la page [Releases](https://github.com/SUP2Ak/decargot/releases).
2. **Lancez l'installeur** et suivez les instructions.
3. **Ouvrez Decargot** depuis le menu Démarrer ou le raccourci sur le bureau.

> L'application intègre un système de mise à jour automatique : vous serez notifié lorsqu'une nouvelle version est disponible et pourrez l'installer en un clic.

---

## Utilisation

1. **Sélectionnez un ou plusieurs dossiers/disques** à scanner.
2. **Lancez l'analyse** pour détecter tous les projets Cargo et leurs dossiers `target`.
3. **Visualisez la taille** de chaque dossier `target` détecté.
4. **Sélectionnez les dossiers à supprimer** (individuellement ou en groupe).
5. **Lancez la suppression** : la barre de progression s'affiche en temps réel, l'espace disque est libéré instantanément.

---

## Roadmap

- [ ] Support Linux/Mac
- [ ] Plus d'options de nettoyage (node_modules, .venv, ...)
- [ ] Historique des suppressions
- [ ] Personnalisation avancée de l'UI
- [ ] **Support multi-langue**

---

## Avertissement

> **Attention** : la suppression est définitive (pas de corbeille). Vérifiez bien votre sélection avant de lancer le nettoyage.

---

## Licence

MIT

---

## Auteur

- [SUP2Ak](https://github.com/SUP2Ak) 