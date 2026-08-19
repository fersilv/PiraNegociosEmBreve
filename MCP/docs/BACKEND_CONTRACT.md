# Contrato de backend necessario

## Confirmado

### Checar duplicidade
- Metodo: `POST`
- Rota: `/api/v1/jobs/check`
- Auth: `X-API-Key`
- Corpo: mesma carga usada no cadastro

### Criar vaga
- Metodo: `POST`
- Rota: `/api/v1/jobs`
- Auth: `X-API-Key`

## Ainda precisa ser confirmado no backend

Para ativar administracao completa sem fazer suposicoes, precisamos dos contratos reais de:

- listar vagas;
- consultar uma vaga por ID/codigo;
- atualizar uma vaga;
- excluir, arquivar ou despublicar uma vaga.

Para cada rota, basta informar metodo, URL, identificador aceito e formato do corpo/resposta. Depois disso, so o `.env` e, se necessario, o adaptador do modulo de vagas precisam ser ajustados.

## Campos do payload de vaga ja modelados

- `title`
- `description`
- `requirements`
- `salary`
- `city`
- `sourceUrl`
- `externalApplicationInstructions`
- `allowSimilarDuplicate`

O schema aceita campos adicionais para nao bloquear evolucao do backend.
