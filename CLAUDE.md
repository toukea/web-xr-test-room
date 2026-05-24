# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stratégie multi-agent

Ce workspace utilise une stratégie de coordination entre agents (Claude Code, Codex, etc.) :

- [AGENTS.md](AGENTS.md) — point d'entrée pour tout agent non-Claude
- [CONTEXT.md](CONTEXT.md) — vérité partagée du projet, à lire en premier ; inclut un **protocole de verrou** (`CONTEXT.md.lock`) pour éviter les conflits d'écriture concurrente
- [scrumboard/BACKLOG.md](scrumboard/BACKLOG.md) — tâches ouvertes à lire avant de commencer

Avant de modifier `CONTEXT.md`, vérifier l'existence de `CONTEXT.md.lock`. Si le verrou est présent, écrire l'intent dans `CONTEXT.md.pending` et continuer sans bloquer. Lock orphelin (> 10 min) : supprimer et reprendre.

## Commands

```bash
npm run dev          # Dev server on all interfaces (HTTP, port 5173)
npm run dev:https    # Dev server with self-signed HTTPS (required for WebXR on headset)
npm run typecheck    # Type-check without emitting
npm run build        # Typecheck + Vite production build → dist/
npm run preview      # Serve the dist/ build on all interfaces
```

Arrêter le serveur : `Ctrl+C` dans le terminal qui le fait tourner. Si ce terminal n'est pas accessible (lancé par un agent externe), utiliser le script dédié :

```bash
./kill-server.sh          # Arrête le serveur sur le port 5173 (défaut)
./kill-server.sh 5174     # Ou sur un port alternatif
```

Le script tue d'abord les processus occupant le port (`lsof`), puis tout processus `vite` restant.

WebXR requires a secure context — use `dev:https` when testing from a Meta Quest headset on the local network. The HTTPS flag is toggled via `VITE_HTTPS=1` which activates `@vitejs/plugin-basic-ssl` in [vite.config.ts](vite.config.ts).

There are no tests beyond `typecheck`.

## Architecture

Three source files in [src/](src/):

**[src/main.ts](src/main.ts)** — entry point. Sets up the Three.js renderer (`xr.enabled = true`, `local-floor` reference space), creates two cameras (desktop OrbitControls + VR headset), wires the render loop that switches between them based on `renderer.xr.isPresenting`, appends the VRButton, and handles WebXR availability status display.

**[src/world.ts](src/world.ts)** — pure scene construction. `createWorld()` builds a cel-shaded room (walls, floor, ceiling, corner posts, trim) and a center table, then places a `grabbable-framed-board` Group on the table. Returns a `World` object containing:
- `root` — the scene Group to add to the scene
- `board` — the board Group (passed to XRControls for grab interaction)
- `roomBounds` — min/max X/Z for locomotion clamping
- `spawn` — player start position

All geometry is `BoxGeometry`. Cel shading uses `MeshToonMaterial` with a shared 4-stop `CanvasTexture` gradient. Outlines are rendered as a scaled `BackSide` mesh sharing geometry with the main mesh, grouped under a single `Object3D` per element.

**[src/xrControls.ts](src/xrControls.ts)** — `XRControls` class. Manages up to two controller grips obtained from `renderer.xr.getControllerGrip()`, attached to the `playerRig` Group. On each `update(deltaSeconds)` call:
- **Locomotion**: left stick → strafe/walk (camera-relative), right stick X → yaw rotation. Movement is clamped to `roomBounds`. Deadzone of 0.18 applied with rescaling.
- **Grab**: squeeze/trigger (buttons[0] or buttons[1]) within 0.44 m of the board center re-parents the board to the controller grip via `attach()`; releasing re-parents it back to `boardParent`.

Controller handedness is read from `XRInputSource.handedness` on the `connected` event. Stylized cartoon hands (palm + cuff + fingers as capsule geometry) are built procedurally and added to each grip on connect.

## Key design constraints

- `playerRig` acts as the XR player root: camera and both controller grips are children of it. Moving `playerRig.position` is locomotion.
- The board's `userData.grabbable = true` is a marker convention — `XRControls` currently hard-codes grab logic for the single board object.
- Delta time is capped at 50 ms (`Math.min(clock.getDelta(), 0.05)`) to avoid tunneling on frame drops.
- TypeScript strict mode is on; `noEmit: true` means the compiler only type-checks.
