# SEO público: publicação e Nginx

As páginas de empresas e vagas são renderizadas pelo processo web na porta `3000`, para que o HTML já contenha o conteúdo e o `JobPosting` antes do JavaScript. O Nest continua na porta `3888` e atende a API.

## 1. Variáveis do processo web

No `.env` do diretório raiz, configure:

```env
NODE_ENV=production
PUBLIC_API_ORIGIN=http://127.0.0.1:3888/api
PUBLIC_SITE_URL=https://piranegocios.com.br
```

No `.env` do backend, configure também:

```env
PUBLIC_SITE_URL=https://piranegocios.com.br
```

## 2. Banco e processos

Execute uma única vez a migração `backend/migrations/20260817_public_seo.sql`. Depois do build, mantenha os dois processos ativos:

```bash
cd /home/deploy/piranegocios/backend
npm run build
pm2 restart PiraNegocios --update-env

cd /home/deploy/piranegocios
npm run build
pm2 start dist/server.cjs --name PiraNegociosWeb --update-env
```

Se `PiraNegociosWeb` já existir, use `pm2 restart PiraNegociosWeb --update-env` em vez de `pm2 start`.

## 3. Nginx

Mantenha o frontend estático como padrão, mas encaminhe páginas públicas individuais à porta 3000 e o sitemap dinâmico ao backend:

```nginx
server {
    server_name piranegocios.com.br www.piranegocios.com.br;
    root /home/deploy/piranegocios/dist;
    index index.html;

    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:3888/api/seo/sitemap;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # HTML pré-renderizado de cada vaga, incluindo JobPosting JSON-LD.
    location ^~ /vagas/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Perfil público de empresa: /fainde. Rotas do sistema ficam no frontend.
    location ~ ^/(?!api(?:/|$)|dashboard(?:/|$)|login$|termos$|vagas$|uploads(?:/|$)|assets(?:/|$)|robots\.txt$|sitemap\.xml$|manifest\.webmanifest$|icon\.svg$|apple-touch-icon\.svg$)[a-z0-9][a-z0-9-]*/?$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location ^~ /api/gemini/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location ^~ /api/socket.io/ {
        proxy_pass http://127.0.0.1:3888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:3888;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/piranegocios.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/piranegocios.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
```

Valide antes de recarregar: `sudo nginx -t && sudo systemctl reload nginx`.
