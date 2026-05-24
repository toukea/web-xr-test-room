# Planets WebXR VR

Prototype d'expérience VR interactive tournant dans le navigateur (WebXR) pour **Meta Quest**, construit avec Three.js, TypeScript et Vite.

La scène propose une salle cel-shadée avec :
- Locomotion au stick analogique (marche + rotation)
- Saisie d'objets au grip (tableau mural, pistolet)
- Tir de projectiles sur des bouteilles cassables avec effets d'éclats

---

## Prérequis

- [Node.js](https://nodejs.org/) ≥ 18
- Un Meta Quest (ou tout casque WebXR) sur le **même réseau local** que la machine de développement
- Navigateur **Meta Browser** sur le casque

---

## Installation

```bash
git clone <url-du-repo>
cd planets
npm install
```

---

## Lancer sur desktop (visualisation rapide)

```bash
npm run dev
```

Ouvre `http://localhost:5173` dans un navigateur. Le mode desktop utilise l'OrbitControls (clic + glisser pour orbiter, molette pour zoomer).

---

## Lancer et visionner dans le casque Meta Quest

WebXR exige un **contexte sécurisé (HTTPS)**. Suivre ces étapes :

### 1. Démarrer le serveur HTTPS

```bash
npm run dev:https
```

Le serveur démarre sur toutes les interfaces réseau avec un certificat auto-signé.
Repérer l'adresse LAN affichée dans la sortie Vite, par exemple :

```
  ➜  Network: https://192.168.1.42:5173/
```

### 2. Accepter le certificat auto-signé sur le casque

1. Mettre le casque et ouvrir le **Meta Browser**
2. Naviguer vers l'adresse LAN affichée (ex. `https://192.168.1.42:5173`)
3. Une alerte de sécurité "certificat non approuvé" s'affiche — c'est normal
4. Appuyer sur **Avancé** puis **Continuer vers le site** (ou libellé équivalent)

> **Note :** cette acceptation est à refaire si le serveur est relancé (le certificat change à chaque démarrage).

### 3. Entrer en VR

Sur la page chargée, un bouton **Enter VR** apparaît en bas de l'écran. L'appuyer lance l'expérience immersive.

Si le bouton n'apparaît pas ou affiche une erreur WebXR, vérifier que :
- Le casque est bien en mode développeur (activer via l'app Meta mobile)
- Le Meta Browser est à jour
- Le serveur tourne bien en HTTPS (`dev:https` et non `dev`)

---

## Commandes en VR

| Action | Commande |
|---|---|
| Marcher / strafer | Stick gauche |
| Pivoter | Stick droit (axe X) |
| Saisir un objet | Bouton Grip (annulaire) à moins de 44 cm de l'objet |
| Relâcher | Relâcher le Grip |
| Tirer (pistolet en main) | Gâchette (index) |

---

## Toutes les commandes npm

```bash
npm run dev          # Serveur HTTP desktop — port 5173
npm run dev:https    # Serveur HTTPS (requis pour le casque) — port 5173
npm run typecheck    # Vérification TypeScript sans compilation
npm run build        # typecheck + build production → dist/
npm run preview      # Sert le build dist/ sur toutes les interfaces
```

Arrêter le serveur : `Ctrl+C` dans le terminal. Si le terminal n'est pas accessible :

```bash
./kill-server.sh          # Tue le serveur sur le port 5173
./kill-server.sh 5174     # Ou sur un port alternatif
```

---

## Architecture source

```
src/
├── main.ts          # Bootstrap : renderer, caméras, boucle de rendu, VRButton
├── world.ts         # Construction de la scène (salle, table, objets grabbables, bouteilles)
└── xrControls.ts    # Entrées VR : locomotion, saisie, tir, impacts, haptique
```

Voir [CONTEXT.md](CONTEXT.md) pour la documentation technique détaillée (architecture, contraintes, parenté XR).
