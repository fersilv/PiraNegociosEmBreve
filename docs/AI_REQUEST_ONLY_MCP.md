# IA request-only e perfil MCP de automações

## Objetivo

O PiraNegócios não deve consumir modelos de IA silenciosamente por timer, subscriber, hook de publicação ou rotina de inicialização.

A regra passa a ser:

1. **IA do usuário final / monetizada** continua no produto quando nasce de uma ação explícita da pessoa e, quando aplicável, respeita créditos, entitlement ou plano.
2. **IA operacional do próprio sistema** não roda sozinha no backend.
3. O backend mantém filas, contexto e operações de escrita determinísticas.
4. Um agente externo pode consultar essas filas pelo MCP, executar a análise no provedor/modelo escolhido fora do PiraNegócios e devolver somente o resultado.
5. O agendamento pertence ao orquestrador externo. O site deixa de ser responsável por acordar uma IA sozinho.

## O que continua dentro do produto

São recursos de uso explícito e importantes para o usuário ou para monetização:

- importação/cadastro de currículo assistido por IA;
- análise e revisão de currículo;
- melhoria de currículo;
- análise alinhada a uma vaga quando adquirida/permitida;
- sugestões de competências acionadas pela pessoa;
- recursos de foto/documento acionados pela pessoa;
- compatibilidade de candidato com vaga usando ficha de vaga já preparada;
- concierge do WhatsApp quando uma pessoa envia uma mensagem;
- funções de IA administrativas executadas manualmente por request.

Essas funções não devem ser convertidas em jobs automáticos apenas por existirem no backend.

## Disparos automáticos removidos

### 1. Ficha de matching de vaga

**Antes:** criar, ativar ou editar uma vaga podia disparar a geração da ficha de matching por IA no subscriber.

**Agora:** o subscriber apenas reutiliza uma ficha `READY`, se existir, para alertas. Ele nunca chama um modelo para fabricar a ficha.

Fluxo externo recomendado:

1. `piranegocios_jobs_match_profile_status` com `ready=false`;
2. buscar os dados necessários da vaga;
3. consultar `piranegocios_jobs_match_profile_schema`;
4. gerar a ficha no agente externo;
5. gravar com `piranegocios_jobs_set_match_profile`.

### 2. Duplicidade de anúncio dos Classificados

**Antes:** publicar um anúncio chamava a IA do backend imediatamente para comparar com anúncios anteriores do mesmo vendedor.

**Agora:** publicar não chama IA. O anúncio entra na fila operacional até uma revisão externa marcar a análise como concluída.

Fluxo externo recomendado:

1. `piranegocios_classifieds_listing_moderation_queue`;
2. `piranegocios_classifieds_listing_moderation_context`;
3. o agente externo compara anúncio e candidatos;
4. `piranegocios_classifieds_apply_listing_moderation` com:
   - `APPROVE`, ou
   - `DUPLICATE` + `duplicateOfListingId`.

A aplicação de `DUPLICATE` valida que o anúncio apontado pertence à mesma identidade antes de pausar o duplicado.

### 3. Moderação de avaliações dos Classificados

**Antes:** enviar uma avaliação de compra chamava um modelo imediatamente para aprovar, reprovar ou pedir revisão manual.

**Agora:** a avaliação é salva como `PENDING_MANUAL`, sem chamar provedor de IA.

Fluxo externo recomendado:

1. `piranegocios_classifieds_review_moderation_queue`;
2. analisar texto, notas e URLs de imagens fora do backend;
3. `piranegocios_classifieds_apply_review_moderation` com `APPROVE` ou `REJECT` e justificativa.

A moderação manual pelo painel administrativo continua válida como fallback.

### 4. Feedback de produto e FAQ

**Antes:** o backend iniciava uma rotina cerca de 1 minuto depois de subir e depois repetia periodicamente, analisando feedbacks e gerando FAQs por IA.

**Agora:** não existe timer interno para essas chamadas.

Fluxo de insights:

1. `piranegocios_product_feedback_queue`;
2. agrupar/priorizar externamente;
3. `piranegocios_product_feedback_apply_insights`.

Fluxo de FAQ:

1. `piranegocios_product_faq_source`;
2. produzir artigos externamente;
3. `piranegocios_product_feedback_apply_faqs`;
4. os artigos permanecem como rascunho para revisão/publicação administrativa.

## MCP

### Endpoint

O endpoint OAuth já existente continua sendo usado para compatibilidade:

`/api/jobs/mcp`

Apesar do caminho histórico conter `jobs`, o servidor MCP passa a representar operações controladas do PiraNegócios e inclui as novas filas de automação.

### Scopes recomendados para o perfil de automação externa

Para um agente operacional completo, sem permissão de exclusão definitiva:

```text
jobs:list
jobs:detail
jobs:stats:read
jobs:match:read
jobs:match:write
jobs:review:read
jobs:review:write
jobs:verify
jobs:activate
jobs:deactivate
jobs:flag
jobs:unflag
automation:classifieds:read
automation:classifieds:write
automation:feedback:read
automation:feedback:write
```

`jobs:delete` deve continuar fora desse perfil salvo necessidade administrativa explícita.

### Ferramentas de IA operacional externa

#### Estado geral

- `piranegocios_ai_automation_status`

Mostra contagens das filas e expõe a política request-only. Não executa modelo.

#### Vagas

- `piranegocios_jobs_match_profile_schema`
- `piranegocios_jobs_match_profile_status`
- `piranegocios_jobs_set_match_profile`

#### Classificados, anúncios

- `piranegocios_classifieds_listing_moderation_queue`
- `piranegocios_classifieds_listing_moderation_context`
- `piranegocios_classifieds_apply_listing_moderation`

#### Classificados, avaliações

- `piranegocios_classifieds_review_moderation_queue`
- `piranegocios_classifieds_apply_review_moderation`

#### Produto e FAQ

- `piranegocios_product_feedback_queue`
- `piranegocios_product_feedback_apply_insights`
- `piranegocios_product_faq_source`
- `piranegocios_product_feedback_apply_faqs`

## Perfil MCP sugerido

Abaixo está o perfil conceitual para o agente que substituirá os processamentos internos. O agendamento deve existir fora do PiraNegócios.

```yaml
name: piranegocios-operacoes-ia
endpoint: https://piranegocios.com.br/api/jobs/mcp
auth: oauth2
mode: request-only
rules:
  - nunca pedir ao backend para gerar IA operacional
  - ler a fila antes de processar
  - processar lotes pequenos e idempotentes
  - devolver somente estrutura, decisão e justificativa
  - não alterar conteúdo fora do escopo da tarefa
  - não usar jobs:delete
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

A cadência abaixo é apenas uma recomendação para o orquestrador externo e **não deve ser implementada como timer no backend**:

- fichas de matching de vagas: a cada ciclo de coleta/auditoria ou em pequenos lotes frequentes;
- duplicidade de anúncios: lotes frequentes para reduzir o tempo até revisão;
- avaliações: lotes frequentes ou conforme volume;
- insights de feedback: diariamente;
- FAQ: diariamente ou semanalmente, conforme volume.

O agente deve consultar a fila primeiro. Se estiver vazia, encerra sem chamar modelo.

## UI temporária

A antiga bolha global de suporte/IA foi retirada do `App.tsx`.

No lugar existe `AuthenticatedClassifiedsChatWidget`, que apenas navega para `/classificados/conversas`. Ele não chama IA, não cria polling e não agenda tarefa.

A infraestrutura antiga de suporte permanece no código para não destruir a funcionalidade durante esta correção, mas não é mais montada globalmente.

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

Uma nova integração com IA deve responder às perguntas abaixo antes de entrar em produção:

1. Quem pediu essa chamada agora?
2. Ela é uma ação explícita do usuário/admin ou veio de um timer/hook?
3. Existe entitlement/crédito/plano quando a função é monetizada?
4. Se for operação interna, por que não pode ser uma fila MCP processada externamente?
5. A chamada pode ser repetida sem necessidade por retry, atualização de entidade ou boot do servidor?

Se a resposta indicar IA operacional automática, o padrão é **fila + MCP externo**, não chamada direta do backend.
