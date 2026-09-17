# INTEGRACAO PDV INTELIGENTE PIRANEGOCIOSEMBREVE

## Visão canônica
Integração OAuth 2.0 Authorization Code + PKCE, bidirecional e assíncrona entre `fersilv/PDV-INTELIGENTE` e `fersilv/PiraNegociosEmBreve`.

### Branches
- PDV Inteligente: `Integracao-Piranegocios`, baseada em `feat/pdv-fluxo-operacional`, a linha mais atual do PDV.
- PiraNegócios: `Integracao-PDV-Inteligente`, baseada na `main` consolidada.

### Decisões funcionais
- PiraNegócios é cliente OAuth do PDV.
- Produtos e Vendas são permissões obrigatórias.
- Demais módulos do PDV aparecem selecionados por padrão no consentimento, mas podem ser removidos.
- PDV já possui multiusuário (`admin`, `manager`, `cashier`) e passa a ter permissões granulares e direito de autorizar integrações.
- Por padrão no Pira: importar todos, sincronização automática ligada, visibilidade ligada, sincronizar preço e estoque.
- Empresa pode desligar auto-sync global, preço ou estoque; cada produto também possui overrides próprios.
- Nem todo produto precisa ser importado e produto importado pode permanecer oculto sem perder o vínculo.
- Associação explícita produto PDV -> anúncio Pira é suportada. Antes de criar novo, a integração tenta vínculo existente e match seguro por SKU/código de barras; título é apenas sugestão, nunca deduplicação automática.
- O catálogo do Pira continua obedecendo as regras existentes de empresa verificada, adesão/termos, `canSellProducts`, categoria, preço, canais de publicação, estoque, checkout e lifecycle.
- Vendas vindas do PDV são inicialmente observadas/auditadas, sem criar pedido Pira automaticamente. Isso evita furar checkout, pagamento, entrega e regras comerciais já existentes.

### OAuth PDV
Servidor OAuth no PDV usa PKCE S256, access token curto, refresh token rotativo e armazenamento somente de hashes. O consentimento exige usuário PDV admin/manager; gerente pode ter `canAuthorizeIntegrations=false`.

### PiraNegócios
O Pira armazena access/refresh token cifrados com AES-256-GCM usando `PDV_INTEGRATION_ENCRYPTION_KEY`. Existe sincronização manual e reconciliação automática (padrão 60 s, configurável por `PDV_INTEGRATION_SYNC_SECONDS`).

### Modelos persistidos
- `pdv_integrations`: conexão OAuth e defaults da empresa.
- `pdv_oauth_states`: PKCE/state temporário.
- `pdv_product_links`: vínculo por produto + visibilidade/sync/preço/estoque.
- `pdv_sale_links`: vendas observadas do PDV, sem conversão automática em pedido.
- `pdv_integration_events`: auditoria do fluxo.

### Estado atual
1. Branches criadas.
2. OAuth server + permissões no PDV implementados.
3. API OAuth PDV para produtos/vendas implementada.
4. Cliente OAuth no Pira implementado.
5. Importação, associação, sync manual e auto-sync de catálogo implementados no backend.
6. O Pira reutiliza o mesmo `ClassifiedsService` para criação/atualização, sem bypass de regras.
7. Painel empresarial `/company/integracoes/pdv` implementado com conexão OAuth, defaults, sync manual, leitura de vendas, associação e overrides por produto.

### Continuação planejada
- Webhooks assinados para reduzir latência do polling e manter polling como reconciliação/fallback.
- Sincronização Pira -> PDV de alterações permitidas, com proteção contra loop e versionamento/idempotência.
- Mapeamento visual de categorias/variações e conflitos.
- Processos de venda bidirecionais somente após contrato explícito de status/pagamento/entrega, sem substituir as regras comerciais do Pira.


### Webhooks assinados e idempotência
- O PDV registra `webhook_uri` junto do cliente OAuth e devolve um segredo derivado por cliente; o Pira armazena esse segredo cifrado com AES-256-GCM.
- Alterações de produto, estoque e vendas entram primeiro em uma outbox persistente no PDV. O worker envia de forma assíncrona, com timeout, lock, retry exponencial e limite de tentativas. A operação normal do PDV não depende da disponibilidade do Pira.
- Cada entrega usa `X-PDV-Client-Id`, `X-PDV-Event-Id`, `X-PDV-Event-Type`, `X-PDV-Timestamp` e `X-PDV-Signature` HMAC-SHA256. O timestamp tem tolerância de 5 minutos.
- O Pira registra `sourceEventId` com índice único por empresa. Eventos repetidos já concluídos não são processados novamente; eventos que falharam podem ser reprocessados pelo retry do PDV.
- `product.created`, `product.updated` e `product.stock_updated` sincronizam apenas o produto afetado. `product.removed` não apaga histórico no Pira: marca a origem como indisponível e oculta o anúncio sincronizado. `sale.*` continua somente OBSERVED, sem fabricar pedido Pira.
- O polling periódico continua ativo como reconciliação/fallback para recuperar qualquer divergência ou indisponibilidade temporária de webhook.

### Checkpoint 2026-09-17
- PDV: outbox assinada, retry e eventos de produto/estoque/venda implementados na branch `Integracao-Piranegocios`.
- Pira: receptor assinado/idempotente implementado na branch `Integracao-PDV-Inteligente` e segredo de webhook passa a fazer parte do vínculo OAuth.
- Próximo foco: detecção/resolução explícita de conflitos bidirecionais e reconciliação de produtos removidos durante polling.


### Conflitos bidirecionais
- O vínculo guarda `lastSyncedAt`, snapshots e timestamps dos dois lados. No auto-sync, produto remoto sem alteração desde o último sync é ignorado, preservando alterações locais.
- Se o mesmo produto divergiu localmente e também mudou no PDV desde o último sync, o Pira marca `conflictState=PENDING` em vez de escolher silenciosamente um lado.
- A empresa resolve explicitamente com **Usar dados do PDV** ou **Usar dados do Pira**. A resolução atualiza snapshots/direção e limpa o conflito.
- Evento exclusivamente de estoque só compara/aplica estoque; uma alteração de título local não bloqueia uma baixa de estoque do PDV.
- Produto removido, ausente ou inativo no PDV fica `remoteAvailable=false` e é ocultado no Pira quando o vínculo está sincronizado, sem excluir anúncio, histórico ou preferência de visibilidade. Se voltar a ficar disponível, a preferência de visibilidade pode ser restaurada.
