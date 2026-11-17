#!/bin/sh
set -e

export PORT="${PORT:-10000}"
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
rm -f /etc/nginx/sites-enabled/default

cd /app/backend
# Aplica as migrations pendentes antes de subir a API (inclui a trava de horario no banco).
# Com `set -e`, se alguma falhar o container nao sobe e o Render mantem a versao anterior.
npx prisma migrate deploy
PORT=3001 node dist/main &

cd /app/frontend
PORT=3000 HOSTNAME=0.0.0.0 node server.js &

nginx -g 'daemon off;'
