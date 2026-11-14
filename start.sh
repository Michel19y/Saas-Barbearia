#!/bin/sh
set -e

export PORT="${PORT:-10000}"
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
rm -f /etc/nginx/sites-enabled/default

cd /app/backend
PORT=3001 node dist/main &

cd /app/frontend
PORT=3000 HOSTNAME=0.0.0.0 node server.js &

nginx -g 'daemon off;'
