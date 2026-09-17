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
- `pdv_category_links`: mapeamento por empresa entre categoria do PDV e taxonomia do Pira.

### Estado atual
1. Branches isoladas criadas, sem merge/deploy automático.
2. OAuth server + permissões granulares no PDV implementados.
3. API OAuth PDV para produtos, categorias e vendas implementada.
4. Cliente OAuth no Pira implementado com tokens e segredo de webhook cifrados.
5. Importação, associação, sync manual, auto-sync de reconciliação e push Pira -> PDV implementados para catálogo.
6. Webhooks assinados/idempotentes PDV -> Pira implementados para produto, estoque e venda.
7. Conflitos bidirecionais de produto são detectados e exigem escolha explícita PDV/Pira.
8. Categorias possuem mapeamento persistente por empresa, com match exato automático e edição visual no painel.
9. Produto variável do PDV permanece um único anúncio no Pira, com cada filho real preservado como variante canônica com ID, atributos, SKU, código, preço, estoque e estado próprios.
10. Carrinho/pedido do Pira persistem a variante selecionada, reservam/devolvem seu estoque específico e mantêm snapshot da variante no pedido.
11. O Pira continua reutilizando `ClassifiedsService` e regras comerciais existentes, sem bypass de publicação, checkout ou identidade empresarial.

### Próximas pendências
- Validar build integral e testes ponta a ponta em ambiente com dependências/banco antes de qualquer deploy.
- Definir contrato explícito para uma venda originada no Pira virar venda/baixa definitiva no PDV sem duplicar reserva, pagamento ou entrega.
- Cobrir cenários de reconciliação com pedido pendente enquanto uma variante é removida/inativada no PDV.
- Processos de venda bidirecionais completos continuam bloqueados até existir contrato explícito de status/pagamento/entrega.


### Webhooks assinados e idempotência
- O PDV registra `webhook_uri` junto do cliente OAuth e devolve um segredo derivado por cliente; o Pira armazena esse segredo cifrado com AES-256-GCM.
- Alterações de produto, estoque e vendas entram primeiro em uma outbox persistente no PDV. O worker envia de forma assíncrona, com timeout, lock, retry exponencial e limite de tentativas. A operação normal do PDV não depende da disponibilidade do Pira.
- Cada entrega usa `X-PDV-Client-Id`, `X-PDV-Event-Id`, `X-PDV-Event-Type`, `X-PDV-Timestamp` e `X-PDV-Signature` HMAC-SHA256. O timestamp tem tolerância de 5 minutos.
- O Pira registra `sourceEventId` com índice único por empresa. Eventos repetidos já concluídos não são processados novamente; eventos que falharam podem ser reprocessados pelo retry do PDV.
- `product.created`, `product.updated` e `product.stock_updated` sincronizam apenas o produto afetado. `product.removed` não apaga histórico no Pira: marca a origem como indisponível e oculta o anúncio sincronizado. `sale.*` continua somente OBSERVED, sem fabricar pedido Pira.
- O polling periódico continua ativo como reconciliação/fallback para recuperar qualquer divergência ou indisponibilidade temporária de webhook.

### Checkpoint 2026-09-17
- PDV `Integracao-Piranegocios`: outbox/webhooks, categorias e produto pai + variações expostos à integração. Checkpoint de categorias/variações: `d4fbcdb53c09f66c935707a710f568c5caf3aa97`.
- Pira `Integracao-PDV-Inteligente`: receptor assinado, conflitos, categorias, variantes canônicas e carrinho com estoque por variante implementados em checkpoints separados.
- Nenhuma dessas branches foi mesclada ou implantada em produção nesta etapa.


### Conflitos bidirecionais
- O vínculo guarda `lastSyncedAt`, snapshots e timestamps dos dois lados. No auto-sync, produto remoto sem alteração desde o último sync é ignorado, preservando alterações locais.
- Se o mesmo produto divergiu localmente e também mudou no PDV desde o último sync, o Pira marca `conflictState=PENDING` em vez de escolher silenciosamente um lado.
- A empresa resolve explicitamente com **Usar dados do PDV** ou **Usar dados do Pira**. A resolução atualiza snapshots/direção e limpa o conflito.
- Evento exclusivamente de estoque só compara/aplica estoque; uma alteração de título local não bloqueia uma baixa de estoque do PDV.
- Produto removido, ausente ou inativo no PDV fica `remoteAvailable=false` e é ocultado no Pira quando o vínculo está sincronizado, sem excluir anúncio, histórico ou preferência de visibilidade. Se voltar a ficar disponível, a preferência de visibilidade pode ser restaurada.


### Categorias e variações canônicas
- `GET /integrations/piranegocios/categories` no PDV usa o escopo `categories:read`. O Pira mantém `pdv_category_links` por empresa.
- Na entrada PDV -> Pira, categoria já mapeada vence; sem mapa, nome exatamente equivalente (normalizado) pode ser associado automaticamente; sem correspondência segura, permanece o `defaultCategorySlug` configurado.
- Na saída Pira -> PDV, o Pira reutiliza apenas um mapeamento seguro já conhecido ou equivalência exata; não cria categoria remota por adivinhação.
- Produto pai com `variations[]` vira um único anúncio. O grupo reservado `pdv-variants` possui uma opção por filho real do PDV. Não são montadas combinações cartesianas de tamanho/cor, portanto uma combinação inexistente nunca nasce artificialmente no Pira.
- Cada opção sincronizada pode carregar `externalProductId`, `sku`, `barcode`, `price`, `stockQuantity`, `attributes` e `active`.
- Webhook disparado por um filho é canonicalizado no Pira para o produto pai. Remoção de um filho força reconciliação do pai; remoção do pai segue a regra de indisponibilidade sem apagar histórico.

### Estoque de variante no checkout
- `classified_cart_items` e `classified_order_items` passam a armazenar `variantId` e `variantSnapshot`; a unicidade do carrinho/pedido considera anúncio + variante.
- Ao reservar uma variante, o Pira reduz o saldo da opção e o saldo agregado do anúncio na mesma transação. Cancelamento/rejeição devolve ambos quando a variante ainda existe no catálogo atual.
- O pedido congela a variante efetivamente comprada no snapshot, evitando que uma edição posterior troque silenciosamente o item histórico.
- Produtos com `pdv-variants` não usam o checkout unitário legado: a seleção passa pelo carrinho, que conhece a variante. O backend também bloqueia o caminho antigo, não apenas a interface.
