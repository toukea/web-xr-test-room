#!/usr/bin/env bash
set -euo pipefail

PORT=${1:-5173}
KILLED=0

# Kill by port (covers any launcher)
if command -v lsof &>/dev/null; then
  PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Arrêt des processus sur le port $PORT : $PIDS"
    kill $PIDS
    KILLED=1
  fi
fi

# Fallback: kill any vite process not caught above
VITE_PIDS=$(pgrep -f "vite" 2>/dev/null || true)
if [ -n "$VITE_PIDS" ]; then
  echo "Arrêt des processus vite restants : $VITE_PIDS"
  kill $VITE_PIDS
  KILLED=1
fi

if [ "$KILLED" -eq 0 ]; then
  echo "Aucun serveur trouvé sur le port $PORT."
else
  echo "Serveur arrêté."
fi
