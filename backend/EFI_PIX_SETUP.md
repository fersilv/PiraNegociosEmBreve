# Efí Bank · Pix do PiraNegócios

O backend usa **somente Pix** e o provedor implementado é a **Efí Bank**.

## O que já está implementado

- Pix imediato para compras avulsas.
- QR Code e Pix copia e cola retornados pela Efí.
- Expiração da cobrança.
- Webhook idempotente por `txid`.
- Validação do valor recebido antes de liberar o benefício.
- Liquidação local do pagamento e disparo das regras já existentes de créditos/entitlements.
- Pix Automático para `PREMIUM_MONTHLY` usando a jornada com primeiro Pix + autorização da recorrência.
- Criação idempotente das cobranças mensais futuras em `/v2/cobr/:txid`.
- Renovação dos benefícios após liquidação de cada ciclo.
- Tratamento de recorrência cancelada/rejeitada/expirada e cobrança recorrente vencida.
- Modo DEV continua fora da Efí: a compra é simulada e liquidada localmente sem contabilizar receita real.
- Conta vitalícia continua sem gerar cobrança.

## 1. Banco de dados

Antes de subir o código que usa pagamentos, aplique as migrations no mesmo PostgreSQL usado pelo backend:

```bash
cd backend
npm run migrate:payments
```

Em produção o TypeORM usa `synchronize=false`; apenas publicar o código **não cria as tabelas**.

## 2. Variáveis de ambiente

Configure no ambiente protegido do backend:

```env
PIX_PROVIDER=EFI
EFI_PIX_SANDBOX=false
EFI_PIX_CLIENT_ID=...
EFI_PIX_CLIENT_SECRET=...
EFI_PIX_KEY=...
EFI_PIX_CERTIFICATE_PATH=/caminho/protegido/certificado.p12
EFI_PIX_CERTIFICATE_PASSPHRASE=
EFI_PIX_EXPIRATION_SECONDS=3600

EFI_PIX_WEBHOOK_URL=https://piranegocios.com.br/api/payments/webhooks/efi
EFI_PIX_WEBHOOK_SECRET=<segredo-aleatorio-longo>
EFI_PIX_WEBHOOK_SKIP_MTLS_CHECKING=false

EFI_PIX_AUTOMATIC_ENABLED=true
EFI_PIX_RECEIVER_AGENCY=...
EFI_PIX_RECEIVER_ACCOUNT=...
EFI_PIX_RECEIVER_ACCOUNT_TYPE=PAGAMENTO
```

Também é possível usar `EFI_PIX_CERTIFICATE_BASE64` no lugar de `EFI_PIX_CERTIFICATE_PATH`.

Nunca versionar certificado, chave privada, client secret ou `.env`.

## 3. mTLS do webhook

A API Pix da Efí usa certificado/mTLS. Em produção, o endpoint público abaixo precisa estar acessível pela Efí e o proxy/reverse proxy deve preservar a validação mTLS exigida pelo provedor:

```text
POST https://piranegocios.com.br/api/payments/webhooks/efi
```

O adaptador registra o webhook com `?ignorar=` para impedir que a Efí acrescente automaticamente `/pix`, `/rec` ou `/cobr` à URL. O `EFI_PIX_WEBHOOK_SECRET` é adicionado como uma segunda verificação da aplicação.

## 4. Verificar configuração pelo admin

Com uma conta admin autenticada:

```text
GET /api/admin/payments/provider/efi
```

A resposta informa se as credenciais básicas, webhook e dados do Pix Automático estão configurados.

Depois que certificado, credenciais e URL pública estiverem corretos:

```text
POST /api/admin/payments/provider/efi/configure-webhooks
```

Esse endpoint registra:

- webhook de Pix recebido;
- webhook de recorrência do Pix Automático;
- webhook de cobranças do Pix Automático.

## 5. Fluxo avulso

1. O usuário escolhe um produto.
2. `POST /api/payments/pix` cria o registro local PENDING.
3. O backend cria `/v2/cob` na Efí.
4. `txid`, QR Code, copia e cola e expiração são persistidos.
5. A Efí envia o webhook de Pix recebido.
6. O backend confere `txid` e valor exato.
7. O pagamento vira PAID uma única vez e o benefício é liberado.

## 6. Fluxo do Plano Destaque mensal

1. O usuário informa nome e CPF e autoriza o Pix Automático.
2. O backend cria `locrec`, o primeiro Pix e a recorrência mensal na Efí.
3. A autorização e o primeiro pagamento usam a jornada integrada da Efí.
4. Quando recorrência e primeiro pagamento estiverem confirmados, o backend prepara a próxima cobrança automática.
5. Cada ciclo recebe um `txid` determinístico derivado de `idRec + data de vencimento`.
6. Webhooks repetidos não criam ciclos duplicados.
7. Quando a cobrança mensal é liquidada, a assinatura e os entitlements são estendidos e o próximo ciclo é preparado.

## 7. DEV e vitalício

- **DEV ativo:** nenhuma chamada à Efí. O pagamento local é marcado como simulação paga, dispara os mesmos benefícios e não entra na receita real.
- **Conta vitalícia:** recursos cobertos são liberados sem criar pagamento. IA/Match respeitam o override de acesso sem consumir créditos.

## 8. Antes do primeiro Pix real

Checklist:

- [ ] `npm run migrate:payments` aplicado no banco de produção.
- [ ] Certificado Pix da Efí instalado fora do repositório.
- [ ] Client ID / Client Secret configurados.
- [ ] Chave Pix da conta Efí configurada.
- [ ] Endpoint `/api/payments/webhooks/efi` publicado com mTLS correto.
- [ ] Webhooks registrados pelo endpoint admin.
- [ ] Pix Automático habilitado na conta Efí antes de definir `EFI_PIX_AUTOMATIC_ENABLED=true`.
- [ ] Agência, conta e tipo da conta recebedora configurados para `/v2/cobr`.
- [ ] Teste de homologação feito com `EFI_PIX_SANDBOX=true` antes de produção.
