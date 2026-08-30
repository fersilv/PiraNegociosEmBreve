# MCP Empresarial do PiraNegócios

O **PiraNegócios Business MCP** é um servidor MCP exclusivo para empresas. Ele permite conectar agentes compatíveis com Model Context Protocol ao catálogo, recrutamento e analytics da empresa usando **OAuth 2.0 Authorization Code + PKCE (S256)**.

O MCP é intencionalmente separado do MCP operacional/global de vagas. Uma conexão empresarial nunca recebe poderes administrativos sobre outras empresas, moderação global, ingestão externa ou dados que não pertençam à empresa autorizada.

## Endpoints

| Finalidade | Endpoint |
| --- | --- |
| MCP Streamable HTTP | `https://piranegocios.com.br/api/company/mcp` |
| OAuth metadata | `https://piranegocios.com.br/.well-known/oauth-authorization-server/company` |
| Protected Resource Metadata | `https://piranegocios.com.br/.well-known/oauth-protected-resource/api/company/mcp` |
| Dynamic Client Registration | `https://piranegocios.com.br/api/company/oauth/register` |
| Authorization | `https://piranegocios.com.br/api/company/oauth/authorize` |
| Token | `https://piranegocios.com.br/api/company/oauth/token` |
| Código de conexão | `POST https://piranegocios.com.br/api/company/mcp/connection-code` |

Em desenvolvimento, substitua o domínio pelo `PUBLIC_BASE_URL` configurado no backend.

## Segurança e isolamento

1. O usuário entra normalmente no PiraNegócios e gera um **código de conexão empresarial**.
2. O código é de uso único e expira em 10 minutos.
3. O cliente MCP executa o OAuth Authorization Code Flow com PKCE S256.
4. O authorization code expira em 5 minutos.
5. O access token expira em 1 hora e o refresh token em 30 dias.
6. Access token e refresh token são persistidos apenas por hash.
7. O token guarda `companyId` e `authorizedByUserId` no servidor. Nenhuma ferramenta aceita `companyId` fornecido pelo agente.
8. A cada uso, o backend revalida o vínculo e as permissões empresariais do usuário que autorizou a conexão.
9. Se o usuário for removido da empresa ou perder Marketplace/Recrutamento, os scopes correspondentes deixam de funcionar imediatamente.
10. O endpoint MCP possui limite de 120 requisições/minuto por empresa + cliente OAuth.

## Como conectar

### 1. Gerar o código empresarial

O usuário precisa estar autenticado no PiraNegócios. O frontend do Pira Business pode chamar:

```http
POST /api/company/mcp/connection-code
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{
  "scopes": [
    "company:read",
    "catalog:categories:read",
    "catalog:products:list",
    "catalog:products:read",
    "catalog:products:create",
    "catalog:products:update",
    "catalog:products:publish",
    "catalog:products:status",
    "catalog:analytics:read",
    "analytics:reports:run"
  ]
}
```

Resposta resumida:

```json
{
  "connectionCode": "pn_company_connect_...",
  "company": { "id": "...", "name": "Minha Empresa" },
  "scopes": ["company:read", "catalog:products:list"],
  "expiresAt": "2026-08-30T17:00:00.000Z",
  "expiresIn": 600,
  "oneTime": true
}
```

O backend remove automaticamente scopes que o usuário não pode delegar.

### 2. Dynamic Client Registration

Clientes MCP que suportam DCR podem usar o `registration_endpoint` publicado nos metadados OAuth.

```http
POST /api/company/oauth/register
Content-Type: application/json

{
  "client_name": "Meu agente empresarial",
  "redirect_uris": ["https://cliente.exemplo.com/oauth/callback"]
}
```

Redirects precisam usar HTTPS. `http://localhost` e `http://127.0.0.1` são permitidos apenas para desenvolvimento local.

### 3. Authorization Code + PKCE

O cliente abre o `authorization_endpoint` com:

- `response_type=code`
- `client_id`
- `redirect_uri`
- `scope`
- `state`
- `code_challenge`
- `code_challenge_method=S256`
- `resource=https://piranegocios.com.br/api/company/mcp`

Na tela do PiraNegócios, o usuário informa o código `pn_company_connect_...` gerado dentro do Pira Business.

### 4. Trocar code por token

```http
POST /api/company/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "pn_company_mcp_...",
  "redirect_uri": "https://cliente.exemplo.com/oauth/callback",
  "code": "pn_company_oauth_code_...",
  "code_verifier": "<PKCE verifier>",
  "resource": "https://piranegocios.com.br/api/company/mcp"
}
```

Depois, o cliente envia:

```http
Authorization: Bearer pn_company_oauth_at_...
```

## Scopes

### Empresa

- `company:read`: contexto da empresa conectada e instruções do agente.

### Catálogo e produtos

- `catalog:categories:read`
- `catalog:products:list`
- `catalog:products:read`
- `catalog:products:create`
- `catalog:products:update`
- `catalog:products:publish`
- `catalog:products:status`
- `catalog:products:delete`: arquivamento seguro, preservando histórico.
- `catalog:analytics:read`

Scopes de catálogo dependem da autorização de **Marketplace** do usuário empresarial.

### Recrutamento

- `recruitment:jobs:list`
- `recruitment:jobs:read`
- `recruitment:jobs:create`
- `recruitment:jobs:update`
- `recruitment:jobs:status`
- `recruitment:jobs:delete`
- `recruitment:applications:list`
- `recruitment:applications:read`
- `recruitment:applications:update`
- `recruitment:analytics:read`

Scopes de recrutamento dependem da autorização de **Recrutamento** do usuário empresarial.

### Relatórios

- `analytics:reports:run`

Esse scope sozinho não contorna as permissões de dados. Um relatório `COMMERCE` também exige `catalog:analytics:read`; `RECRUITMENT` exige `recruitment:analytics:read`; `EXECUTIVE` exige ambos.

## Ferramentas MCP

### Contexto e instruções

- `piranegocios_company_context`
- `piranegocios_company_agent_guide`

### Catálogo

- `piranegocios_company_categories`
- `piranegocios_company_products_list`
- `piranegocios_company_product_get`
- `piranegocios_company_product_create`
- `piranegocios_company_product_update`
- `piranegocios_company_product_publish`
- `piranegocios_company_product_set_status`
- `piranegocios_company_product_archive`
- `piranegocios_company_commerce_analytics`

### Recrutamento

- `piranegocios_company_jobs_list`
- `piranegocios_company_job_get`
- `piranegocios_company_job_create`
- `piranegocios_company_job_update`
- `piranegocios_company_job_set_active`
- `piranegocios_company_job_delete`
- `piranegocios_company_applications_list`
- `piranegocios_company_application_get`
- `piranegocios_company_application_update`
- `piranegocios_company_recruitment_analytics`

### Relatórios parametrizados

- `piranegocios_company_report`

Domínios aceitos: `COMMERCE`, `RECRUITMENT`, `EXECUTIVE`.

## Casos de uso

### Cadastro de produto por agente

Usuário:

> Cadastre a Camiseta Pira preta por R$ 79,90 na categoria correta, estoque 20, com estas três fotos. Não publique antes de me mostrar como ficou.

Fluxo recomendado do agente:

1. `piranegocios_company_categories`
2. `piranegocios_company_product_create`
3. `piranegocios_company_product_get`
4. mostrar o rascunho ao usuário
5. somente após pedido explícito: `piranegocios_company_product_publish`

Exemplo de argumentos:

```json
{
  "categorySlug": "moda",
  "title": "Camiseta Pira Preta",
  "description": "Camiseta preta em algodão...",
  "price": 79.90,
  "condition": "NEW",
  "stockQuantity": 20,
  "publicationChannels": ["CLASSIFIEDS", "COMPANY_PAGE"],
  "images": [
    "https://cdn.exemplo.com/camiseta-1.jpg",
    "https://cdn.exemplo.com/camiseta-2.jpg",
    "https://cdn.exemplo.com/camiseta-3.jpg"
  ]
}
```

### Atualização de preço e estoque

Usuário:

> O estoque da camiseta preta agora é 11 e o preço é R$ 74,90.

Fluxo:

1. localizar com `piranegocios_company_products_list`
2. confirmar o ID pelo título/categoria
3. `piranegocios_company_product_update` com somente `price` e `stockQuantity`
4. reler com `piranegocios_company_product_get`

```json
{
  "id": "<uuid-do-produto>",
  "price": 74.90,
  "stockQuantity": 11
}
```

### Pausar ou arquivar produto

Para indisponibilidade temporária use:

```json
{ "id": "<uuid>", "status": "PAUSED" }
```

Para remover do catálogo use `piranegocios_company_product_archive`. O MCP não faz hard delete de produto porque o registro pode estar relacionado a histórico comercial, conversas, avaliações ou auditoria.

### Criar vaga

Usuário:

> Crie uma vaga de Analista de Marketing em Piracicaba, híbrida, recebendo candidaturas pelo Pira.

```json
{
  "title": "Analista de Marketing",
  "description": "Buscamos profissional para...",
  "requirements": "Experiência com campanhas digitais...",
  "city": "Piracicaba",
  "state": "SP",
  "workModel": "HYBRID",
  "acceptsPlatformApplications": true,
  "skills": ["Marketing Digital", "Google Ads", "Analytics"]
}
```

A ferramenta não recebe `companyId`. A vaga é sempre criada para a empresa do OAuth.

### Triagem de candidaturas

Usuário:

> Mostre candidaturas novas da vaga X e abra o currículo da Ana.

Fluxo:

1. `piranegocios_company_applications_list` com `jobId` e `status=PENDING`
2. selecionar a candidatura correspondente
3. `piranegocios_company_application_get`

Dados do currículo são pessoais. O agente deve usá-los apenas no contexto do processo seletivo autorizado e não deve inferir atributos sensíveis.

### Atualizar etapa do processo

```json
{
  "id": "<uuid-da-candidatura>",
  "status": "REVIEWING",
  "observations": ["Perfil encaminhado para entrevista técnica"]
}
```

O serviço reaproveita o fluxo normal de candidaturas e notificações do PiraNegócios.

### Relatório específico para um agente

Usuário:

> Faça um relatório do catálogo de agosto com produtos publicados, vendidos, visualizações e favoritos.

```json
{
  "domain": "COMMERCE",
  "from": "2026-08-01",
  "to": "2026-08-31",
  "metrics": ["published", "sold", "views", "favorites"],
  "groupBy": "status"
}
```

Usuário:

> Quero uma visão executiva de agosto juntando catálogo e recrutamento.

```json
{
  "domain": "EXECUTIVE",
  "from": "2026-08-01",
  "to": "2026-08-31"
}
```

O backend entrega números determinísticos. O agente pode transformar esses dados em relatório narrativo, diagnóstico, tabela ou apresentação sem o backend precisar chamar um modelo de IA.

## Instruções recomendadas para agentes

Use estas regras no system prompt ou nas instruções da integração:

1. Trate o MCP como uma conexão de uma única empresa. Nunca peça nem invente `companyId`.
2. Antes de criar produtos, consulte categorias quando a categoria não estiver inequivocamente definida.
3. Prefira criar produtos em rascunho e revisar antes de publicar.
4. Em updates, envie somente os campos que realmente precisam mudar.
5. Nunca invente preço, estoque, imagem, SKU, categoria ou dado de variação.
6. Antes de ações destrutivas ou que removam visibilidade, confirme quando a intenção do usuário não estiver clara.
7. Não faça hard delete de produtos. Use arquivamento.
8. Nunca misture candidatos, vagas ou produtos de IDs que não vieram da conexão atual.
9. Dados de currículo e candidatura são confidenciais. Não inferir raça, religião, saúde, orientação sexual, opinião política ou outros atributos sensíveis.
10. Para métricas, informe o período e diferencie claramente número retornado pelo PiraNegócios de interpretação feita pelo agente.
11. Se uma ferramenta retornar erro de permissão, não tente contornar com outra rota ou domínio.
12. Se o OAuth perder scopes após mudança de permissões, peça ao administrador da empresa para revisar a conexão.

## Política de publicação de produtos

A publicação continua obedecendo às regras normais do PiraNegócios:

- empresa verificada;
- adesão ativa ao Marketplace;
- termos atuais aceitos;
- venda de produtos habilitada para a empresa;
- categoria válida;
- título, descrição, localização e preço válidos;
- ao menos um canal de publicação.

O MCP não é um atalho para burlar essas validações.

## Política de exclusão

- **Produto:** `catalog:products:delete` executa arquivamento seguro (`ARCHIVED`).
- **Vaga:** `recruitment:jobs:delete` é destrutivo e remove a vaga definitivamente, por isso o scope não faz parte do conjunto padrão.

## Revogação

A conexão perde acesso quando:

- o token expira;
- o refresh token expira ou é rotacionado;
- o usuário autorizador perde o vínculo com a empresa;
- o usuário perde a permissão necessária para o domínio;
- no futuro, o cliente OAuth for desativado ou os tokens forem revogados administrativamente.

Como cada chamada revalida as permissões, remover um colaborador ou retirar sua permissão de Marketplace/Recrutamento interrompe o acesso sem depender do vencimento do refresh token.
