# Planets WebXR VR

Prototype WebXR VR pour Meta Quest avec Three.js, TypeScript et Vite.

## Commandes

```bash
npm install
npm run dev
```

Pour tester depuis le casque sur le réseau local, WebXR doit être servi en contexte sécurisé. Le projet inclut un mode HTTPS de développement :

```bash
npm run dev:https
```

Le certificat généré est auto-signé. Selon la configuration du navigateur du casque, un tunnel HTTPS public ou un certificat local approuvé peut être nécessaire.

## Validation

```bash
npm run typecheck
npm run build
```
