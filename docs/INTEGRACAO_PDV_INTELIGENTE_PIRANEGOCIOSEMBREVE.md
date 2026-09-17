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
