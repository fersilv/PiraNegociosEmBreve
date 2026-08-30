# Fase 0 — contrato Mercado Pago para comércio e entrega

Data de validação: 2026-08-28.

Este registro documenta o contrato externo que sustenta o desenho de pagamento único descrito em `COMERCIO_ENTREGAS_ORCAMENTOS_README.md`.

## Modelo confirmado

O PiraNegócios usa o modelo Marketplace / Split de Pagamentos 1:1 com Checkout Transparente/Bricks:

- a Public Key usada no frontend é da conta integradora;
- o backend cria o pagamento com o Access Token do vendedor obtido por OAuth;
- o pagamento é criado em `POST /v1/payments`;
- a remuneração do marketplace é informada em `application_fee`;
- `application_fee` é um valor monetário, não uma porcentagem enviada ao provedor;
- o Mercado Pago faz o split entre vendedor e marketplace;
- a comissão/tarifa própria do Mercado Pago é descontada do valor do vendedor antes da comissão do marketplace;
- `application_fee` não pode ser negativo nem maior que `transaction_amount`;
- o uso de `application_fee` exige Access Token obtido por OAuth;
- `X-Idempotency-Key` é obrigatório na criação do pagamento;
- em reembolsos, os valores são devolvidos proporcionalmente pelas partes do split e há restrições caso o vendedor não tenha saldo suficiente.

## Aplicação no PiraNegócios

Para um pedido futuro com entrega parceira:

```text
transaction_amount = itens + frete + eventual taxa visível ao comprador
application_fee    = comissão PiraNegócios + parcela de frete que deve ficar temporariamente na plataforma
```

O valor de frete recebido pela plataforma não deve ser tratado como receita definitiva. Ele cria uma obrigação em centavos com o parceiro de entrega e só deixa de ser passivo quando houver liquidação/reconciliação.

Antes de enviar ao Mercado Pago, o servidor deve garantir:

```text
0 <= application_fee <= transaction_amount
```

Todos os componentes internos são persistidos como centavos inteiros. Conversão para reais ocorre apenas na fronteira da API do provedor.

## Fontes oficiais

- Split Payments 1:1, integração de marketplace: https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- Pré-requisitos do Split Payments 1:1: https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/prerequisites
- Referência da API de pagamentos e erros de `application_fee`: https://www.mercadopago.com.br/developers/pt/reference

## Limites que continuam sob teste de integração

A documentação pública confirma as regras acima, mas limites comerciais adicionais podem depender da conta/aplicação e do produto habilitado. Por isso, antes da liberação da Fase 3 em produção, a matriz de testes deverá cobrir Pix, cartão, parcelamento, reembolso total/parcial, seller sem saldo e falhas de webhook usando contas de teste do marketplace.
