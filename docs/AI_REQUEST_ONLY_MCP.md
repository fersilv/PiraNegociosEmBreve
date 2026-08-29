# IA request-only e perfil MCP de automações

## Objetivo

O PiraNegócios não deve consumir modelos de IA silenciosamente por timer, subscriber, hook de publicação ou rotina de inicialização.

A regra passa a ser:

1. **IA do usuário final / monetizada** continua no produto quando nasce de uma ação explícita da pessoa e, quando aplicável, respeita créditos, entitlement ou plano.
2. **IA operacional do próprio sistema** não roda sozinha no backend.
3. O backend mantém filas, contexto e operações de escrita determinísticas.
4. Um agente externo consulta essas filas pelo MCP, executa a análise fora do PiraNegócios e devolve somente o resultado estruturado.
5. O agendamento pertence ao orquestrador externo.
6. **Cada ferramenta MCP possui um scope próprio.** Liberar leitura não libera escrita e liberar uma ferramenta de uma categoria não libera as demais.

## O que continua dentro do produto

Recursos explícitos e importantes para o usuário ou monetização continuam internos:

- importação/cadastro de currículo assistido por IA;
- análise e revisão de currículo;
- melhoria de currículo;
- análise alinhada a uma vaga quando adquirida/permitida;
- sugestões de competências acionadas pela pessoa;
- recursos de foto/documento acionados pela pessoa;
- compatibilidade de candidato com vaga usando ficha de vaga já preparada;
- concierge do WhatsApp quando uma pessoa envia uma mensagem;
- funções administrativas de IA executadas manualmente por request.

Essas funções não devem virar jobs automáticos apenas por existirem no backend.

## Disparos automáticos removidos

### Ficha de matching de vaga

**Antes:** criar, ativar ou editar uma vaga podia disparar geração da ficha de matching por IA no subscriber.

**Agora:** o subscriber nunca fabrica a ficha com modelo de IA. O fluxo externo é:

1. `piranegocios_jobs_match_profile_status`;
2. consultar a vaga;
3. `piranegocios_jobs_match_profile_schema`;
4. gerar a ficha externamente;
5. `piranegocios_jobs_set_match_profile`.

Scopes correspondentes:

```text
jobs:match:status:read
jobs:match:schema:read
jobs:match:write
```

### Duplicidade de anúncio dos Classificados

**Antes:** publicar um anúncio chamava a IA do backend para comparar anúncios anteriores do mesmo vendedor.

**Agora:** publicar não chama IA. O agente externo usa:

1. `piranegocios_classifieds_listing_moderation_queue`;
2. `piranegocios_classifieds_listing_moderation_context`;
3. compara externamente;
4. `piranegocios_classifieds_apply_listing_moderation` com `APPROVE` ou `DUPLICATE`.

Scopes:

```text
automation:classifieds:listings:queue:read
automation:classifieds:listings:context:read
automation:classifieds:listings:moderation:write
```

### Moderação de avaliações dos Classificados

**Antes:** enviar avaliação de compra chamava um modelo imediatamente.

**Agora:** a avaliação entra em `PENDING_MANUAL` e pode ser processada externamente:

```text
piranegocios_classifieds_review_moderation_queue
piranegocios_classifieds_apply_review_moderation
```

Scopes:

```text
automation:classifieds:reviews:queue:read
automation:classifieds:reviews:moderation:write
```

### Feedback de produto e FAQ

**Antes:** o backend iniciava uma rotina após o boot e repetia periodicamente análise de feedback e geração de FAQ.

**Agora:** não existe timer interno para essas chamadas.

Insights:

```text
piranegocios_product_feedback_queue
piranegocios_product_feedback_apply_insights
```

FAQ:

```text
piranegocios_product_faq_source
piranegocios_product_feedback_apply_faqs
```

Scopes:

```text
automation:feedback:queue:read
automation:feedback:insights:write
automation:feedback:faq-source:read
automation:feedback:faqs:write
```

Os artigos produzidos externamente continuam como rascunho para revisão/publicação administrativa.

## Modelo de autorização

### Endpoint MCP

```text
https://piranegocios.com.br/api/jobs/mcp
```

O caminho histórico contém `jobs`, mas o servidor representa hoje as operações externas controladas do PiraNegócios.

### Chaves

A tabela `external_api_clients` diferencia:

- `audience = api` para REST;
- `audience = mcp` para o MCP.

Uma chave REST não pode autorizar o MCP. O OAuth MCP exige uma chave com `audience = mcp`.

A chave define o teto de permissões. Access e refresh tokens OAuth só continuam válidos enquanto os scopes permanecem efetivamente liberados na chave vinculada.

### Política 1 ferramenta = 1 scope

Novas chaves MCP não recebem mais `jobs:read` e `jobs:write` implicitamente.

Scopes antigos continuam reconhecidos apenas para compatibilidade com vínculos existentes. Ao editar uma chave antiga no painel administrativo, seus scopes agrupados são expandidos para permissões individuais e o salvamento migra a chave para o modelo granular.

## Catálogo gerencial MCP

O catálogo atual possui 27 ferramentas com autorização individual.

### Vagas · consulta

```text
jobs:list                         -> piranegocios_jobs_list
jobs:detail                       -> piranegocios_jobs_get
jobs:stats:read                   -> piranegocios_jobs_stats
jobs:duplicates:check             -> piranegocios_jobs_check_duplicate
```

### Vagas · cadastro e auditoria

```text
jobs:create                       -> piranegocios_jobs_create_external
jobs:update                       -> piranegocios_jobs_update_external
jobs:verify                       -> piranegocios_jobs_verify_external
jobs:review:read                  -> piranegocios_jobs_review_queue
jobs:review:write                 -> piranegocios_jobs_set_review_status
jobs:activate                     -> piranegocios_jobs_activate
jobs:deactivate                   -> piranegocios_jobs_deactivate
jobs:flag                         -> piranegocios_jobs_flag
jobs:unflag                       -> piranegocios_jobs_unflag
jobs:delete                       -> piranegocios_jobs_delete
```

`jobs:delete` é destrutivo e não faz parte do perfil recomendado.

### Vagas · matching por IA externa

```text
jobs:match:schema:read            -> piranegocios_jobs_match_profile_schema
jobs:match:status:read            -> piranegocios_jobs_match_profile_status
jobs:match:write                  -> piranegocios_jobs_set_match_profile
```

### Operações externas · controle

```text
automation:status:read            -> piranegocios_ai_automation_status
```

### Classificados · anúncios

```text
automation:classifieds:listings:queue:read
  -> piranegocios_classifieds_listing_moderation_queue

automation:classifieds:listings:context:read
  -> piranegocios_classifieds_listing_moderation_context

automation:classifieds:listings:moderation:write
  -> piranegocios_classifieds_apply_listing_moderation
```

### Classificados · avaliações

```text
automation:classifieds:reviews:queue:read
  -> piranegocios_classifieds_review_moderation_queue

automation:classifieds:reviews:moderation:write
  -> piranegocios_classifieds_apply_review_moderation
```

### Produto & suporte · feedback

```text
automation:feedback:queue:read
  -> piranegocios_product_feedback_queue

automation:feedback:insights:write
  -> piranegocios_product_feedback_apply_insights
```

### Produto & suporte · FAQ

```text
automation:feedback:faq-source:read
  -> piranegocios_product_faq_source

automation:feedback:faqs:write
  -> piranegocios_product_feedback_apply_faqs
```

## Perfis sugeridos

### Auditoria de vagas

```text
jobs:list
jobs:detail
jobs:stats:read
jobs:review:read
jobs:update
jobs:verify
jobs:review:write
jobs:activate
jobs:deactivate
jobs:flag
jobs:unflag
```

### Moderação externa dos Classificados

```text
automation:status:read
automation:classifieds:listings:queue:read
automation:classifieds:listings:context:read
automation:classifieds:listings:moderation:write
automation:classifieds:reviews:queue:read
automation:classifieds:reviews:moderation:write
```

### Feedback e FAQ externos

```text
automation:feedback:queue:read
automation:feedback:insights:write
automation:feedback:faq-source:read
automation:feedback:faqs:write
```

## Perfil MCP conceitual

```yaml
name: piranegocios-operacoes-ia
endpoint: https://piranegocios.com.br/api/jobs/mcp
auth: oauth2
mode: request-only
rules:
  - usar apenas ferramentas liberadas na chave MCP
  - ler a fila antes de chamar qualquer modelo externo
  - processar lotes pequenos e idempotentes
  - devolver somente estrutura, decisão e justificativa
  - não alterar conteúdo fora do escopo da tarefa
  - não solicitar jobs:delete sem autorização administrativa explícita
workflows:
  job_match_profile:
    read: piranegocios_jobs_match_profile_status
    schema: piranegocios_jobs_match_profile_schema
    write: piranegocios_jobs_set_match_profile
  classified_listing_moderation:
    queue: piranegocios_classifieds_listing_moderation_queue
    context: piranegocios_classifieds_listing_moderation_context
    write: piranegocios_classifieds_apply_listing_moderation
  classified_review_moderation:
    queue: piranegocios_classifieds_review_moderation_queue
    write: piranegocios_classifieds_apply_review_moderation
  feedback_insights:
    queue: piranegocios_product_feedback_queue
    write: piranegocios_product_feedback_apply_insights
  faq_drafts:
    source: piranegocios_product_faq_source
    write: piranegocios_product_feedback_apply_faqs
```

## Cadência externa sugerida

A cadência pertence ao orquestrador externo e **não deve ser implementada como timer no backend**:

- matching de vagas: por ciclo de coleta/auditoria ou pequenos lotes frequentes;
- duplicidade de anúncios: lotes frequentes;
- avaliações: conforme volume;
- insights de feedback: diariamente;
- FAQ: diariamente ou semanalmente.

O agente consulta a fila primeiro. Se estiver vazia, encerra sem chamar modelo.

## UI administrativa

A aba **APIs & MCP** usa o catálogo do backend como fonte única de permissões.

- API V1 mostra apenas o modo legado fixo;
- API V2 mostra somente scopes que possuem rota REST V2;
- MCP mostra somente funções disponíveis no servidor MCP;
- funções são agrupadas por seção e subcategoria;
- cada função possui checkbox próprio;
- é possível selecionar seção/subcategoria, buscar por nome/scope/tool e aplicar presets;
- o painel diferencia leitura, alteração e ação destrutiva;
- chaves antigas são identificadas e podem ser migradas ao editar/salvar.

## UI temporária de chat

A antiga bolha global de suporte/IA foi retirada do `App.tsx`.

No lugar existe `AuthenticatedClassifiedsChatWidget`, que apenas navega para `/classificados/conversas`. Ele não chama IA, não cria polling e não agenda tarefa.

## O que não deve ser removido

Nem toda execução em background é IA. Permanecem válidos processos determinísticos necessários ao produto, por exemplo:

- webhooks;
- notificações;
- realtime/chat;
- expiração e reconciliação de operações comerciais;
- analytics sem modelo generativo;
- buffer curto do WhatsApp disparado pela chegada de uma mensagem humana.

A regra desta correção é eliminar **chamadas automáticas a modelos**, não paralisar o backend.

## Regra para novas funcionalidades

Uma nova integração com IA deve responder:

1. Quem pediu essa chamada agora?
2. Ela é ação explícita ou veio de timer/hook?
3. Existe entitlement/crédito/plano quando monetizada?
4. Se for operação interna, por que não pode ser fila MCP processada externamente?
5. A chamada pode ser repetida sem necessidade por retry, atualização de entidade ou boot?
6. A ferramenta externa possui scope próprio e pode ser revogada isoladamente?

Se indicar IA operacional automática, o padrão é **fila + MCP externo**, não chamada direta do backend.
