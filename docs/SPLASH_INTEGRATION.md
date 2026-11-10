# Integração PiraNegócios ↔ Splash (10/11/2026)

## Identidade compartilhada

O PiraNegócios é a fonte de autenticação Firebase, projeto `piranegocios`.
A rota `/splash/entrar` recebe a sessão atual do Firebase; sem usuário, redireciona para
`/login?returnTo=/splash/entrar`. Após autenticação, obtém um ID token curto pelo SDK do Firebase
e envia exclusivamente via POST HTTPS, nunca em query string, para
`https://splash.piranegocios.com.br/api/auth/piranegocios` com `credentials:include`.
O Splash verifica assinatura RSA Google, issuer, audience, email verificado e identidade UID
e emite sua própria sessão HttpOnly. Não compartilhar cookies ou privilégios administrativos.
Contas Splash existentes só são vinculadas após autenticar no próprio Splash e escolher
**Vincular minha conta PiraNegócios** no perfil. Mesmo e-mail sem posse comprovada da sessão
não autoriza assumir uma conta antiga.

## Classificados de imóveis Splash

Endpoint `GET /api/classifieds/splash` no backend PiraNegócios consulta exclusivamente o
endpoint público de imóveis aprovados do Splash na porta interna 3194.
Origem e URL de reserva são fixas. Cache de 60 segundos; filtros públicos por q, cidade e UF;
respostas saneadas sem e-mails ou documentos.
Componente `SplashListingsSection` aparece em Classificados Home, busca pública e
Explorar autenticado. Imóveis não são copiados para tabela de classificados; o Splash mantém
preço, moderação, reservas, pagamento e calendário. Quando não existem imóveis aprovados,
exibe convite de cadastro em vez de inventar anúncios.
Teste isolado (dados sintéticos **somente no mock do fetch**):
`node scripts/test-splash-feed.cjs`.

## Testes e operação

- `npm run typecheck`, `npm run build`, `npm --prefix backend run build`.
- Acesso real do Pira para Splash validado com usuário de QA criado e excluído no Firebase:
  `ENABLE_REAL_FIREBASE_QA=YES node backend/scripts/test-splash-firebase-real.cjs`.
- QA no Chrome mobile do `pc-fer-loja`: 15 rotas públicas, nenhuma exceção JavaScript ou
  recurso HTTP falho na amostra. As funções autenticadas não foram testadas pela sessão do usuário.
- Erro concreto corrigido: `identity_verifications.relationship` é varchar; usar `$2::varchar`
  tanto na atribuição quanto no CASE, pois PostgreSQL relatava 42P08.
- Classificados: falhas de busca agora mostram erro e opção de nova tentativa, evitando Promise
  rejeitada sem tratamento.
- Login: o parâmetro `returnTo` aceita somente caminhos relativos internos.

## Migração VPS-Fainde

Projeto, banco 147 tabelas, uploads e sessão WhatsApp migrados; serviço backend e web via systemd,
Cloudflare dedicado ao domínio principal. VPS antiga mantém somente proxy de contingência
temporário para DNS antigo. **WhatsApp está aguardando leitura de QR Code para reconexão**:
nunca declarar conexão ativa apenas porque o Chrome abriu.
O servidor novo usa usuário exclusivo `piranegocios`; não incluir .env,
chaves privadas, sessões WhatsApp, arquivos de identidade ou uploads no Git.

## Navegação autenticada validada após migração

No dia 10/11/2026, um teste end-to-end com um usuário de QA criado no Firebase
navegou por 16 rotas autenticadas em Chrome mobile: perfil, classificados,
publicação, favoritos, mensagens, compras, avaliações, métricas e configurações.
O formulário de login autenticou normalmente; a rota de integração abriu
`https://splash.piranegocios.com.br/perfil` com sessão já criada.
Nenhuma exceção JavaScript e nenhum HTTP 4xx/5xx durante a navegação amostrada.
O usuário de QA foi removido do Firebase, do banco PiraNegócios e do banco Splash.

**Correção detectada pelo teste**: usuários recém-autenticados sem telefone eram
redirecionados de `/vagas` para o onboarding mesmo para consultar oportunidades.
Agora `/vagas` mantém a navegação pública enquanto o perfil não está completo.
O onboarding continua exigido para ações que realmente dependem do cadastro.

Execução administrativa opcional: `ENABLE_AUTH_QA=YES node backend/scripts/qa-authenticated-navigation.cjs`.
O teste cria uma conta temporária com e-mail de domínio inválido, usa Chrome
separado, não publica anúncios nem faz pagamentos, e limpa os três cadastros.