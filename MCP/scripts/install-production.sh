#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js nao encontrado. Instale Node.js 20+ antes de continuar.' >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20+ e obrigatorio. Versao atual: $(node -v)" >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo 'Arquivo .env criado. Edite os segredos antes de iniciar.'
fi

npm ci || npm install
npm run build
mkdir -p data

echo
echo 'Build concluido.'
echo 'Para iniciar agora: npm start'
echo 'Para producao com PM2:'
echo '  npm install -g pm2'
echo '  pm2 start deploy/ecosystem.config.cjs'
echo '  pm2 save'
echo '  pm2 startup'
