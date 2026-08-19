# Arquitetura e expansao

## Objetivo

O Pira MCP e uma camada de ferramentas sobre a API existente do Pira Negocios. Ele nao substitui o backend e nao acessa o banco diretamente. Isso mantem uma unica fonte de verdade e reaproveita validacoes, regras de negocio e autenticacao ja existentes na API.

## Camadas

1. **Transporte MCP**: `/mcp` via Streamable HTTP.
2. **Autenticacao do MCP**: bearer no MVP; OAuth/OIDC e a evolucao indicada.
3. **Registro de modulos**: `src/modules/index.ts`.
4. **Modulo de dominio**: schemas e ferramentas, como `modules/jobs`.
5. **Cliente da API**: `PiraApiClient`, responsavel por X-API-Key, timeout, rate limit e respostas.
6. **Auditoria**: JSONL sem registrar chaves ou corpos das requisicoes.

## Convencao para novos modulos

Cada dominio deve ter `schema.ts` e `tools.ts`, expor uma funcao `registerXTools(server)` e ser adicionado ao registro central.

## Politica de ferramentas

- leitura: `readOnlyHint: true`;
- criacao: `readOnlyHint: false`, normalmente nao destrutiva;
- atualizacao: idempotente quando o contrato permitir;
- exclusao: `destructiveHint: true` e motivo obrigatorio quando aplicavel.

## Proximas capacidades recomendadas

### Vagas
- confirmar contratos REST de list/get/update/delete;
- arquivar/despublicar em vez de excluir quando o backend suportar;
- filtro por cidade, status, empresa e data;
- endpoint de alteracoes recentes para sincronizacao.

### Empresas
- listar/consultar/criar/atualizar;
- vincular vagas a empresas;
- status de verificacao.

### Eventos e anuncios
- CRUD;
- publicacao/despublicacao;
- data de expiracao;
- moderacao.

### Auditoria e permissoes
- OAuth 2.1/OIDC;
- scopes por modulo (`jobs:read`, `jobs:write`, `jobs:delete`);
- audit log persistente no banco ou observabilidade central;
- identificacao do usuario/cliente que realizou cada acao.
