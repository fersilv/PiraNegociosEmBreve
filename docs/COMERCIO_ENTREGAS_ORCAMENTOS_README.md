# Comércio, carrinho, entregas e orçamentos — plano de implementação

> Estado: **rascunho para validação antes da implementação incremental**. Este documento não altera o checkout atual.

## 1. Objetivo

Evoluir os Classificados Business de compra unitária para uma operação de loja:

1. configurações comerciais globais da empresa, herdadas pelos produtos;
2. carrinho limitado a uma empresa por pedido;
3. endereços múltiplos, com endereço padrão, para comprador e empresa;
4. cálculo de entrega local por parceiros cadastrados no Admin;
5. uma cobrança online ao comprador, usando o repasse já existente do Mercado Pago;
6. despacho do parceiro, controle de saldo/fatura e repasse do entregador;
7. orçamento consultivo e versionado para serviços.

Não haverá duas cobranças para o cliente. O produto, a comissão da plataforma e o frete serão componentes do **mesmo pagamento**.

## 2. Decisões de produto

### 2.1 Carrinho por empresa

Um carrinho contém itens de apenas uma empresa. Ao adicionar item de outra empresa, o comprador pode concluir o carrinho atual ou substituí-lo. Isso evita combinar retiradas, prazos, estoque, entregadores e repasses de vendedores diferentes no mesmo pedido.

### 2.2 Configuração global com exceção por produto

Todo produto terá `INHERIT` como comportamento inicial. A empresa configura uma vez:

- recebimento online;
- Pix, cartão, descontos e parcelamento;
- retirada, entrega própria e parceiros da plataforma;
- endereço padrão de retirada/depósito;
- regras de estoque padrão;
- limites de peso/dimensão aceitos por cada serviço de entrega.

O produto pode manter a herança ou criar uma exceção explícita. A tela deve sempre informar de onde cada regra veio: “configuração da empresa” ou “exceção deste produto”.

### 2.3 Uma cobrança e repasse

Para pedido online:

```text
total cobrado do comprador = itens + frete + eventual taxa visível ao comprador
application_fee / repasse da plataforma = comissão da plataforma + frete da plataforma
líquido da empresa = itens - comissão absorvida pela empresa (quando houver)
passivo do parceiro = valor do frete devido ao motoboy/bike
```

O pedido grava cada componente em centavos e nunca recalcula valores históricos. O frete que entrou no repasse da plataforma não é receita definitiva: gera um lançamento de obrigação com o parceiro até a liquidação.

## 3. Endereços

### 3.1 Comprador

Nova entidade `delivery_addresses`:

- dono: usuário (e, futuramente, identidade Business compradora);
- apelido: Casa, Trabalho, Outro;
- CEP, rua, número, complemento, bairro, cidade, UF;
- `placeId` opcional;
- coordenadas/precisão quando permitidas pela fonte;
- `isDefault`, um endereço padrão por dono;
- ativo/inativo.

No checkout autenticado, o endereço padrão vem selecionado. A pessoa pode selecionar outro, cadastrar um novo ou marcar o novo como padrão. O pedido guarda um **snapshot** do endereço usado, para não mudar quando o cadastro for editado depois.

### 3.2 Empresa

Nova entidade `company_fulfillment_locations`:

- nome: Loja Centro, Depósito, Cozinha etc.;
- endereço completo e geolocalização;
- tipos permitidos: retirada, origem de entrega, ambos;
- `isDefaultPickup` e `isDefaultDeliveryOrigin`;
- horário/observações de retirada;
- ativo/inativo.

Um produto pode herdar a origem padrão ou escolher uma origem diferente. A empresa não pode excluir um local já referenciado por pedido; ela o desativa.

## 4. Peso e dimensões do produto

No cadastro/edição de anúncio de produto, incluir uma seção opcional “Envio e transporte”:

- peso em gramas;
- comprimento, largura e altura em centímetros;
- volume calculado;
- “não enviar por parceiro local”;
- observação de manuseio: frágil, refrigerado, grande porte etc.

Esses dados são opcionais para retirada e obrigatórios somente se uma regra/serviço de entrega exigir. O motor elimina, por exemplo, bike para uma geladeira ou item que exceda o peso/dimensão configurados pelo parceiro.

## 5. Administração: Parceiros de Frete

Nova área Admin: **Pagamentos e logística → Parceiros de frete**.

### 5.1 Parceiro

Campos principais:

- nome, tipo (`MOTOBOY`, `BIKE`, `TRANSPORTADORA`, `MELHOR_ENVIO` futuro);
- status, cidades atendidas e prioridade;
- limites de peso, dimensão e volume;
- cobrança por corrida simples e corrida com retorno;
- canal operacional: WhatsApp individual, grupo integrado, grupo manual ou integração futura;
- chave/conta Pix do parceiro ou regra de liquidação;
- prazo de pagamento, inicialmente 24 horas;
- permite saldo pré-pago da empresa;
- responsável e observações operacionais.

### 5.2 Regras de preço

Cada parceiro pode ter várias tabelas versionadas, com data de início e fim:

- faixas de distância: `0–2 km`, `2–5 km`, `5–8 km` etc.;
- valor mínimo;
- valor fixo por bairro;
- faixa de CEP;
- adicional por peso/dimensão;
- ida e volta, quando aplicável;
- disponibilidade por cidade.

A primeira regra compatível e mais vantajosa para o cliente não deve ser escolhida silenciosamente: o checkout apresenta as opções elegíveis com preço e prazo.

### 5.3 Habilitação pela empresa

Na configuração de entrega Business, a empresa escolhe:

- retirada;
- entrega própria;
- entrega por parceiro da plataforma;
- quais parceiros globais ela aceita usar;
- origem padrão, horários e instruções de coleta;
- se prefere saldo pré-pago ou fatura de parceiro.

A empresa só visualiza parceiros compatíveis com suas cidades/origens e produtos.

## 6. Motor de cotação

### Entrada

- empresa, itens e quantidades;
- endereço/origem de retirada;
- endereço de destino;
- modalidade: entrega, retirada, ida e volta;
- peso e dimensões agregados;
- parceiro/serviço selecionado, quando houver.

### Saída

Cada cotação retorna:

- parceiro, serviço e tipo de entrega;
- valor em centavos, prazo e mensagens de restrição;
- regra/tabela/versionamento aplicados;
- distância/faixa somente quando disponível;
- expiração curta da cotação;
- elegível ou motivo da inelegibilidade.

### Cache e Google Maps

O motor local não precisa chamar uma API externa quando bairro, cidade, CEP e regras internas já determinarem o preço.

Quando for necessário calcular distância/rota, o cache deve guardar **nossa cotação derivada** (`valor`, `faixa`, `versão da regra`, `expira em`) e não a resposta bruta do Google. A chave será composta por origem, destino normalizado, serviço, ida/volta, peso/dimensão e versão da tabela.

`place_id` pode ser persistido. Conteúdo e resultados de Places/Geocoding não serão armazenados indefinidamente; dados de origem Google seguem o prazo e as políticas aplicáveis. O snapshot financeiro do pedido preserva o preço de frete e a regra aplicada, não uma cópia de rota/resposta do provedor.

## 7. Checkout de carrinho

Fluxo proposto:

```text
Produto → Adicionar ao carrinho
Carrinho → revisar itens / estoque / quantidades
Entrega → selecionar endereço e retirada ou cotar parceiros
Revisão → itens + frete + total + condições
Pagamento → Brick Mercado Pago
Pedido pago → empresa chama parceiro → entrega / confirmação / liquidação
```

O servidor recalcula preço, estoque e frete imediatamente antes de criar o pagamento. O cliente nunca envia valor de frete como fonte confiável.

Estruturas novas:

- `classified_carts` e `classified_cart_items`;
- `classified_orders` passa a ter subtotal de itens, frete, comissão da plataforma, líquido da empresa e snapshot de cotação;
- `classified_order_items` para permitir vários produtos;
- compatibilidade: pedidos atuais de item único continuam legíveis como pedido com um item.

## 8. Operação de entrega e financeiro

### 8.1 Entrega parceira online

Depois da aprovação do pagamento, aparece a aba **Entrega parceira** para a empresa:

1. revisar coleta, destino e cotação aprovada;
2. clicar em “Chamar parceiro”;
3. o sistema cria uma corrida e envia a mensagem ao WhatsApp/configuração integrada;
4. registrar aceite, coleta, em rota, entregue, cancelada ou com problema;
5. ao concluir, gerar o lançamento de repasse do parceiro.

### 8.2 Pagamento presencial

Pode usar o mesmo motor de cotação e despacho. Como o frete não entrou no pagamento online, a corrida gera:

- débito da empresa contra o parceiro;
- uso de saldo pré-pago, se disponível; ou
- fatura Pix com vencimento de 24 horas.

### 8.3 Livro-caixa obrigatório

Novas entidades:

- `delivery_partner_jobs` — a corrida e suas transições;
- `delivery_partner_ledger_entries` — crédito/débito imutável;
- `company_delivery_wallets` e movimentos de saldo;
- `company_delivery_invoices` — cobrança de corrida presencial/saldo insuficiente;
- `delivery_partner_payouts` — lote/transferência Pix e reconciliação.

Nada deve depender apenas de status textual de WhatsApp. Toda ação operacional precisa ter ator, data e trilha de auditoria.

## 9. Orçamentos consultivos para serviços

Novo módulo de propostas para anúncios de serviço:

- cliente solicita orçamento com escopo e anexos/fotos, se habilitado;
- empresa cria uma proposta com itens, valor, prazo, condições e validade;
- propostas possuem versões imutáveis (`v1`, `v2`...);
- cliente aprova, reprova, pede ajuste ou negocia pelo chat;
- proposta expirada não pode ser aprovada sem nova versão;
- aprovação cria uma contratação/pedido de serviço, preservando o snapshot;
- pagamentos online poderão ser adicionados depois sem reescrever o histórico da proposta.

Estados mínimos:

```text
REQUESTED → DRAFT → SENT → NEGOTIATING → ACCEPTED | DECLINED | EXPIRED | CANCELED
```

## 10. Ordem de implementação

### Fase 0 — preparação e regras

- [ ] Confirmar contratos/limites do Mercado Pago para o `application_fee` que inclui comissão + frete.
- [ ] Criar feature flags: carrinho, parceiro local, saldo, orçamento consultivo.
- [ ] Criar migrações, auditoria e testes de arredondamento em centavos.
- [ ] Definir termos de marketplace, entrega e política de privacidade atualizados.

### Fase 1 — configurações globais e endereços

- [ ] Criar configuração comercial global da empresa com herança/exceção por produto.
- [ ] Criar endereços do cliente e locais de retirada/depósito da empresa.
- [ ] Adicionar peso/dimensões ao produto como dados opcionais.
- [ ] Ajustar telas de publicação, edição e comercial.

### Fase 2 — Admin e cotação local

- [ ] Criar cadastro de parceiros, cidades, tabelas, limites e canais WhatsApp.
- [ ] Criar motor determinístico por bairro/CEP/faixa de km e cache de cotação derivada.
- [ ] Criar tela Business para habilitar parceiros e entrega própria.
- [ ] Testar regras de peso, cidade, ida/volta, mínimo e expiração.

### Fase 3 — carrinho e pagamento único

- [ ] Criar carrinho por empresa e reserva de estoque por item.
- [ ] Criar itens de pedido e snapshots de frete/endereço.
- [ ] Migrar checkout para as etapas carrinho → entrega → revisão → pagamento.
- [ ] Calcular `application_fee` com comissão + frete e registrar os componentes no livro-caixa.
- [ ] Reconciliar webhook e liberar/estornar estoque e obrigação de frete corretamente.

### Fase 4 — despacho e repasses

- [ ] Criar aba Entrega parceira e máquina de estados da corrida.
- [ ] Disparar WhatsApp individual/grupo com dados mínimos necessários.
- [ ] Criar saldo, faturas em 24 horas, Pix de liquidação e reconciliação.
- [ ] Criar painel Admin de pendências, corridas e repasses.

### Fase 5 — propostas de serviço

- [ ] Criar solicitação, proposta, versão e negociação.
- [ ] Criar interface de aprovação/reprovação e validade.
- [ ] Integrar chat, notificações, auditoria e futura cobrança.

## 11. Critérios de aceite principais

- Produto novo herda o padrão comercial sem intervenção manual.
- Cliente logado vê e pode trocar seu endereço padrão.
- Empresa escolhe local de retirada sem editar cada item.
- Geladeira não recebe opção de bike se exceder o limite configurado.
- CEP/bairro atendido mostra somente parceiros elegíveis e valor consistente.
- Um pagamento online contém itens e frete, com líquido da empresa e obrigação do parceiro corretos.
- Corrida presencial gera saldo ou fatura, nunca altera um pagamento já aprovado.
- Uma proposta de serviço aprovada referencia uma versão imutável.
- Alterar tabela de frete não altera pedido, corrida, fatura ou proposta já registrados.

## 12. Fora do escopo inicial

- carrinho com várias empresas;
- roteirização automática de múltiplas paradas;
- rastreamento GPS contínuo do entregador;
- integração operacional com Melhor Envio antes do motor local estar estável;
- pagamento automático ao motoboy sem reconciliação e trilha financeira.
