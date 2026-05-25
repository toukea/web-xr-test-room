# CONTEXT.md — Planets WebXR VR

> **Référence partagée pour tous les agents IA (Claude Code, Codex, etc.).**
> Lire ce fichier en premier. Consulter [AGENTS.md](./AGENTS.md) pour les règles d'agents.

---

## Identité du projet

Prototype WebXR VR pour **Meta Quest** construit avec Three.js, TypeScript et Vite.
Objectif : une scène VR interactive navigable au casque depuis le réseau local, avec
locomotion stick, saisie d'objets au grip et tir sur des bouteilles cassables.

---

## Architecture

Trois fichiers source dans `src/` :

| Fichier | Rôle |
|---|---|
| `main.ts` | Bootstrap : renderer, caméras, boucle de rendu, VRButton, statut WebXR |
| `world.ts` | Construction de la scène cel-shadée (salle, table, tableau mural, pistolet, armoire, bouteilles, bouton reset) |
| `xrControls.ts` | Entrées VR : locomotion stick, saisie du tableau/pistolet/bouteilles, tir, reset, impacts et effets |

### Modèle de parenté XR

```
Scene
├── world.root            ← salle + table + tableau mural + pistolet + armoire/bouteilles + bouton reset + effets de tir
└── playerRig (Group)     ← position du joueur
      ├── xrCamera
      ├── controllerGrip[0]
      └── controllerGrip[1]
```

Déplacer `playerRig.position` = locomotion. Les grips sont des enfants du rig,
donc ils suivent le joueur.

### Rendu dual-mode

- **Desktop** : `OrbitControls` + `desktopCamera`
- **VR** : `xrCamera` + `XRControls`, branché sur `renderer.xr.isPresenting`

### Cel shading

- `MeshToonMaterial` + gradient `CanvasTexture` 4 stops partagé
- Outline = mesh `BackSide` mis à l'échelle, groupé avec le mesh principal

---

## Contraintes non évidentes

- WebXR exige un **contexte sécurisé (HTTPS)** — utiliser `npm run dev:https` depuis le casque
- Delta time capé à **50 ms** (`Math.min(clock.getDelta(), 0.05)`) pour éviter le tunneling
- Le pistolet doit être **ajouté à la scène avant** d'instancier `XRControls` (qui mémorise `gun.parent`)
- Le pistolet expose un enfant `gun-muzzle`, utilisé comme origine et orientation du projectile
- Le tableau, le pistolet et les bouteilles utilisent `userData.grabbable = true` et `userData.grabRadius`
- Les bouteilles sont aussi des groupes avec `userData.breakable = true`; elles disparaissent à l'impact et déclenchent des éclats
- Le grip (`buttons[1]`) saisit l'objet grabbable le plus proche; la gâchette (`buttons[0]`) tire uniquement quand le pistolet est tenu
- Le bouton vert `RESET`, place sur le mur derriere le joueur, s'active a la gachette quand le controleur est proche et restaure les bouteilles

---

## Commandes

```bash
npm run dev          # HTTP (desktop)
npm run dev:https    # HTTPS auto-signé (casque sur réseau local)
npm run typecheck    # Vérification TypeScript sans émission
npm run build        # typecheck + build production → dist/
./kill-server.sh     # Tuer le serveur Vite (port 5173 par défaut)
```

---

## Protocole de modification sécurisée (concurrence entre agents)

Avant tout Write sur ce fichier :

```
1. Vérifier l'existence de CONTEXT.md.lock dans ce répertoire
2. Si CONTEXT.md.lock existe :
     → NE PAS modifier CONTEXT.md maintenant
     → Écrire l'intent dans CONTEXT.md.pending
     → Continuer le travail sans bloquer
3. Si CONTEXT.md.lock n'existe pas :
     → Créer CONTEXT.md.lock avec : "[agent-name] [timestamp]"
     → Relire CONTEXT.md (version fraîche)
     → Appliquer la modification
     → Supprimer CONTEXT.md.lock
```

Lock orphelin (> 10 min) : supprimer et reprendre normalement.

---

## Journal des mises à jour

<!-- Ajouter en tête de liste, ne jamais modifier les entrées existantes -->

- [2026-05-25] [Codex] Ajout bouton RESET mural — restauration instantanee des bouteilles cassees/deplacees
- [2026-05-24] [Codex] Extension de la saisie — tableau et bouteilles deplacables au grip, pistolet reduit et aligne sur le grip
- [2026-05-24] [Codex] Transformation en expérience de tir — pistolet saisissable, projectile, armoire, bouteilles cassables, effets et haptique
- [2026-05-23] [Claude] Création initiale — architecture, contraintes, protocole de verrou
