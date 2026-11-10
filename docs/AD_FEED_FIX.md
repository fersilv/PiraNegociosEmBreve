# Publicidade na vitrine: API, contadores e testes

Atualizado em 10/11/2026.

## Problema e correção

O componente `FeedMonetizationSlot` consultava `GET /api/ads/active`, mas o
backend só oferecia `GET /api/ads`. Por isso o navegador recebia HTTP 404
e os espaços de publicidade ficavam vazios.

A API agora oferece:

- `GET /api/ads/active`: retorna somente anúncios ativos e vigentes,
  com `id`, `title`, `description`, `imageUrl`, `link` e `buttonText`.
  Não retorna preço, contratante, dados pessoais ou condições comerciais.
- `POST /api/ads/:id/impression` e `POST /api/ads/:id/click`:
  aceitam `{ "placement": "jobs-feed", "slot": 0 }`, validam campos e
  somente contabilizam anúncios ativos/vigentes; retornam HTTP 204.
- O frontend atualiza os anúncios a cada 60 segundos e recomeça a consulta
  se houver indisponibilidade temporária. Cliques usam `fetch` com
  `keepalive` para reduzir perda da requisição durante a navegação.

## Banco

`backend/migrations/20261110_ad_daily_stats.sql` cria a tabela
`ad_daily_stats`, com contagem diária agregada por anúncio/posição.

O esquema **não guarda IP, e-mail, Firebase UID, cookies nem fingerprints**.
As contagens são eventos brutos, não métricas auditadas para faturamento:
não usar como prova de exibição humana sem antifraude e critérios adicionais.

No ambiente VPS-Fainde, a tabela foi aplicada e pertence ao papel
`piranegocios_app`. Em ambientes novos, executar a migração como o usuário
de aplicação que deverá operar a tabela.

## Verificações

- API pública retorna HTTP 200 e três anúncios ativos na amostra.
- A resposta não expõe dados do contratante nem valores.
- Uma impressão e um clique de QA produziram respectivamente contagem 1/1;
  a posição `qa_splash_integration` foi excluída imediatamente após o teste.
- Entrada malformada foi rejeitada com HTTP 400.
- QA no Chrome separado do `pc-fer-loja` percorreu 15 rotas públicas sem
  erros HTTP, exceções JavaScript ou imagens quebradas na amostra final.
- Os demais projetos e domínios da VPS-Fainde não foram alterados.