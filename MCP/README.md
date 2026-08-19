# Pira Negocios MCP — MVP Node.js, sem Docker

Servidor MCP remoto para administrar o Pira Negocios. O primeiro modulo e **vagas**, mas o nucleo foi separado da API e dos modulos para permitir adicionar empresas, anuncios, eventos, usuarios e outros dominios depois.

**Nao usa Docker.** Roda diretamente em Node.js 20+.

## Ferramentas do MVP

- `jobs_check_duplicate` — POST confirmado em `/api/v1/jobs/check`.
- `jobs_create` — POST confirmado em `/api/v1/jobs`.
- `jobs_list` — preparado; habilita quando a rota real for configurada.
- `jobs_get` — preparado; habilita quando a rota real for configurada.
- `jobs_update` — preparado para PATCH/PUT; habilita quando a rota real for configurada.
- `jobs_delete` — preparado como acao destrutiva; habilita quando a rota real for configurada.
- `system_capabilities` — informa o que o backend realmente permite, sem revelar segredos.
- `system_ping_api` — testa conectividade MCP -> API do Pira.

As rotas administrativas nao foram inventadas. Como somente `/jobs/check` e `POST /jobs` foram confirmadas, as demais ficam desativadas ate o contrato real do backend ser informado.

## Arquitetura

```text
ChatGPT / cliente MCP / OpenAI API
              |
         Streamable HTTP
              |
        /mcp  Pira MCP
              |
      +-------+--------+
      |                |
   system/           jobs/
                       |
                PiraApiClient
                       |
             piranegocios.com.br
```

## Requisitos

- Linux/VPS ou servidor com Node.js 20+
- npm
- Nginx ou outro proxy reverso se o MCP for exposto na internet
- dominio/subdominio com HTTPS, por exemplo `mcp.piranegocios.com.br`

## 1. Configurar

```bash
unzip pira-mcp-node.zip
cd pira-mcp-node
cp .env.example .env
nano .env
```

No minimo, ajuste:

```env
HOST=127.0.0.1
PORT=8787
MCP_AUTH_MODE=bearer
MCP_ACCESS_TOKEN=gere-um-token-grande-e-aleatorio

PIRA_API_BASE_URL=https://piranegocios.com.br
PIRA_API_KEY=gere-uma-nova-chave
```

A chave antiga usada na conversa nao deve ser reutilizada como segredo permanente.

## 2. Instalar e compilar

Modo automatico:

```bash
./scripts/install-production.sh
```

Ou manualmente:

```bash
npm install
npm run build
```

## 3. Testar sem daemon

```bash
npm start
```

Em outro terminal:

```bash
curl http://127.0.0.1:8787/health
npm run api:ping
npm run smoke
```

O endpoint `/health` deve responder algo semelhante a:

```json
{"ok":true,"service":"pira-mcp","version":"0.1.0"}
```

## 4. Rodar em producao com PM2

Essa e a opcao mais pratica.

```bash
sudo npm install -g pm2
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

Execute tambem o comando que o `pm2 startup` imprimir na tela.

Comandos uteis:

```bash
pm2 status
pm2 logs pira-mcp
pm2 restart pira-mcp
pm2 stop pira-mcp
```

Depois de atualizar o codigo:

```bash
npm install
npm run build
pm2 restart pira-mcp
```

## Alternativa: systemd

Se nao quiser PM2:

```bash
sudo mkdir -p /var/www/pira-mcp
# copie o projeto para /var/www/pira-mcp
sudo cp deploy/pira-mcp.service.example /etc/systemd/system/pira-mcp.service
sudo systemctl daemon-reload
sudo systemctl enable --now pira-mcp
```

O exemplo assume:

```text
/var/www/pira-mcp
```

Se usar outro diretorio ou usuario, edite `/etc/systemd/system/pira-mcp.service` antes de habilitar.

Ver logs:

```bash
journalctl -u pira-mcp -f
```

## 5. Nginx + HTTPS

O Node deve ficar privado em:

```text
127.0.0.1:8787
```

E o Nginx expor:

```text
https://mcp.piranegocios.com.br/mcp
```

Ha um exemplo em:

```text
deploy/nginx.conf.example
```

Depois de configurar certificado SSL:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Seguranca

1. A `PIRA_API_KEY` fica apenas no `.env` do servidor.
2. O cliente MCP nunca recebe a chave interna da API do Pira.
3. `/mcp` exige `Authorization: Bearer <MCP_ACCESS_TOKEN>` por padrao.
4. `/health` nao revela segredos.
5. O cliente HTTP respeita `PIRA_API_RPM=60`.
6. `jobs_delete` e declarada como ferramenta destrutiva.
7. Alteracoes geram audit log JSONL em `data/audit.log`.
8. O processo Node pode rodar apenas em `127.0.0.1`; o acesso publico fica sob HTTPS no Nginx.

## Rotas de vagas confirmadas

```env
PIRA_JOBS_CHECK_PATH=/api/v1/jobs/check
PIRA_JOBS_CREATE_PATH=/api/v1/jobs
```

## Configurar as rotas administrativas reais

Quando soubermos o contrato do backend:

```env
PIRA_JOBS_LIST_PATH=/rota/real
PIRA_JOBS_GET_PATH=/rota/real/{id}
PIRA_JOBS_UPDATE_PATH=/rota/real/{id}
PIRA_JOBS_UPDATE_METHOD=PATCH
PIRA_JOBS_DELETE_PATH=/rota/real/{id}
PIRA_JOBS_DELETE_METHOD=DELETE
```

O placeholder `{id}` e substituido com URL encoding.

## Fluxo seguro para cadastro

```text
jobs_check_duplicate
        |
  duplicada exata? ---- sim ---> parar
        |
       nao
        v
    jobs_create
```

`allowSimilarDuplicate:true` deve ser usado apenas quando a semelhanca for aproximada e empresa, codigo ou fonte confirmarem que se trata de outra vaga.

## Adicionar novos modulos

Exemplo para empresas:

```text
src/modules/companies/schema.ts
src/modules/companies/tools.ts
```

Depois registre `registerCompanyTools(server)` em `src/server.ts`.

A camada compartilhada continua cuidando de:

- autenticacao
- cliente HTTP
- timeout
- rate limit
- audit log
- transporte MCP

Assim podemos crescer para:

```text
companies_list/get/create/update/delete
events_list/get/create/update/delete
ads_list/get/create/update/delete
users_get/update
audit_list
```

sem reescrever o servidor.

## Estrutura

```text
pira-mcp-node/
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── server.ts
│   ├── lib/
│   └── modules/
├── scripts/
│   ├── install-production.sh
│   ├── smoke.ts
│   └── test-api.mjs
├── deploy/
│   ├── ecosystem.config.cjs
│   ├── pira-mcp.service.example
│   └── nginx.conf.example
├── docs/
├── data/
├── .env.example
├── package.json
└── tsconfig.json
```

## Proximo passo do backend

Para liberar administracao completa de vagas, precisamos apenas confirmar as rotas e formatos reais de:

- listar vagas
- obter uma vaga por ID
- atualizar uma vaga
- excluir/desativar uma vaga

O MCP ja esta estruturado para essas operacoes e nao precisa mudar de arquitetura.
