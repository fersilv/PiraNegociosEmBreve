# Cacilda — arquitetura de atendimento por subcontextos

## Objetivo

A Cacilda não recebe um manual gigantesco do PiraNegócios a cada mensagem. O backend identifica o perfil autenticado, a tela atual e a intenção da pergunta e carrega somente os subcontextos necessários.

A autorização acontece antes da chamada ao modelo. O texto da mensagem nunca concede permissão.

## Fluxo de uma mensagem

1. `ProductFeedbackWidget` envia `message`, `pagePath`, `process`, histórico implícito da conversa e screenshot opcional.
2. `SupportAssistantService` valida usuário, mensagem e captura e atualiza a tela atual da conversa.
3. `SupportContextService` calcula as capacidades reais da conta.
4. O roteador filtra os tópicos que o perfil pode receber.
5. Rota + palavras-chave + intenção pontuam os subcontextos.
6. No máximo três tópicos são selecionados.
7. O servidor busca apenas fatos vivos seguros da própria conta quando o tópico precisa deles.
8. O pacote é comprimido para cerca de 3,4 mil caracteres e colocado em `profile.supportKnowledge`.
9. `AiService.supportChatReply` usa o provedor/modelo global já selecionado. Se `AI_ENABLED` estiver desligado, o suporte inteligente continua indisponível como antes.
10. A resposta e os IDs dos contextos usados entram no log de consumo de IA.

## Regra de autorização

### Público
Pode receber apenas conhecimento de superfícies públicas.

### Candidato / usuário
Pode receber `PUBLIC` + `CANDIDATE`.
Não recebe `COMPANY` ou `ADMIN`.

### Usuário vinculado a empresa
Pode receber `PUBLIC` + `CANDIDATE` + `COMPANY`.
Isso permite que a mesma conta use Meu espaço e Workspace da empresa, mas o contexto da tela atual ganha prioridade.

### Administrador
Pode receber `PUBLIC` + `ADMIN`.
Não recebe automaticamente os manuais internos de candidato/empresa. O objetivo é não misturar papéis no prompt.

### Tentativa de forçar uma área
Se um candidato enviar manualmente `pagePath=/admin/ai`, ou pedir passos administrativos, `restrictedRequest=true` e nenhum tópico ADMIN é carregado. O mesmo vale para `/company/*` sem vínculo empresarial.

A IA deve responder apenas que aquela área é restrita e oferecer um caminho permitido, sem ensinar os passos internos.

## Fatos vivos seguros

O roteador pode carregar fatos próprios sem aceitar IDs arbitrários da mensagem:

- tipo da conta;
- existência de vínculo empresarial;
- se é administrador da própria empresa;
- status de publicação do próprio currículo;
- disponibilidade para trabalho;
- cidade/UF;
- dados públicos/operacionais mínimos da empresa ligada ao `companyId` autenticado;
- status/revisão da Minha Página da própria empresa;
- total de vagas da própria empresa quando o contexto é gestão de vagas;
- contagem dos próprios classificados por status.

Não consultar por IDs fornecidos na pergunta. Não carregar credenciais, documentos, tokens, chaves, dados bancários ou dados de terceiros.

## Mapa de subcontextos

### Público

| ID | Telas principais | Ensina |
|---|---|---|
| `public.navigation` | `/`, `/login`, `/ajuda`, `/termos` | navegação, entrada na conta e ajuda |
| `public.jobs` | `/vagas`, `/vagas-em/:cidade`, `/vagas/:slug` | busca, detalhe, salário/estimativa, candidatura pública |
| `public.classifieds` | `/classificados/*` | busca, filtros, detalhe e contato público |
| `public.resume` | `/criador-de-curriculo`, `/transferir/:id` | criação pública e transferência de arquivo |
| `public.company-page` | `/:companySlug`, termos/privacidade e preview | microsite, selo e vagas da empresa |

### Candidato

| ID | Telas principais | Ensina |
|---|---|---|
| `candidate.home` | `/user` | navegação do Meu espaço |
| `candidate.jobs` | `/user/vagas`, `/user/vaga/:id` | busca, candidatura e compatibilidade |
| `candidate.resume` | `/user/curriculo`, `/user/curriculo/evolucao` | edição, publicação, PDF, histórico e produtos de IA |
| `candidate.profile` | `/user/perfil` | perfil, foto, bio e dados profissionais |
| `candidate.preferences` | `/user/preferencias`, `/user/notificacoes` | localidades, CNH, veículo, PcD e push |
| `candidate.payments` | `/user/pagamentos` | compra, Pix/status e histórico próprio |
| `candidate.classifieds` | `/user/classificados`, `/user/classificados/novo` | criar e gerenciar anúncios/favoritos |
| `candidate.onboarding` | `/user/onboarding`, `/user/admissao/:id`, `/convites/vaga/:token` | onboarding, convite e admissão |
| `candidate.account` | `/user/configuracoes` | configurações da própria conta |

### Empresa

| ID | Telas principais | Ensina |
|---|---|---|
| `company.home-profile` | `/company`, `/company/perfil` | visão geral, dados e verificação |
| `company.jobs` | `/company/vagas*` | publicação/edição de vagas e candidatos da empresa |
| `company.invites-talents` | `/company/talentos`, `/company/vagas/convites` | banco de talentos, pastas e convites |
| `company.hiring` | `/company/contratacao` | configuração de contratação/admissão |
| `company.page` | `/company/pagina` | Minha Página visual + HTML, preview e publicação |
| `company.notifications` | `/company/notificacoes` | preferências de notificação empresarial |

### Administração

| ID | Telas principais | Ensina |
|---|---|---|
| `admin.overview` | `/admin` | navegação do workspace administrativo |
| `admin.companies-users` | `/admin/empresas`, `/usuarios`, `/vinculos`, `/cadastros` | moderação e relações administrativas |
| `admin.jobs` | `/admin/vagas*` | moderação e vagas sinalizadas |
| `admin.content-growth` | `/admin/publicidade`, `/admin/criador-publico` | publicidade e criador público |
| `admin.payments` | `/admin/pagamentos*` | pagamentos, provedores e suporte de cobrança |
| `admin.ai-api` | `/admin/ai`, `/admin/api` | IA global/imagem e API v1 |
| `admin.whatsapp` | `/admin/whatsapp` | instâncias, QR, scopes, MCP/REST e chaves |
| `admin.feedback-notifications` | `/admin/solicitacoes`, `/admin/notificacoes` | suporte, feedback, FAQ, métricas e notificações |
| `admin.account` | `/admin/conta`, `/admin/onboarding` | conta administrativa |

## Como cada tópico deve ser escrito

Cada arquivo de conhecimento deve conter:

- `routes`: telas cobertas;
- `keywords`: termos de seleção;
- `summary`: o que aquela área é;
- `functions`: o que realmente existe;
- `procedures`: intenção + passo a passo;
- `consults`: de onde obter um estado real quando a resposta depende de dados;
- `boundaries`: o que nunca inferir/revelar;
- `related`: contextos que podem ser úteis em continuidade.

Não escrever marketing. O conteúdo é um manual operacional para a IA.

## Como adicionar uma nova tela

1. Confirme a rota real no frontend/router.
2. Leia a página e os endpoints usados por ela.
3. Escolha o arquivo do papel correto em `support-knowledge/`.
4. Crie ou atualize um tópico com funções e procedimentos reais.
5. Adicione `consults` somente quando existir uma fonte segura.
6. Adicione limites de privacidade/permissão.
7. Crie teste de roteamento se o novo módulo muda fronteiras de acesso.
8. Não coloque o manual inteiro no prompt base da IA.

## Política para IA e produtos pagos

- Cacilda usa o mesmo `AI_ENABLED`, provedor e modelo selecionados centralmente.
- Não existe fallback secreto para outro provedor.
- Um recurso de IA para usuário só pode ser explicado como utilizável quando ele estiver visível/habilitado para aquele usuário.
- IA de imagem exige IA global + configuração específica de imagem.
- `/admin/ai` é exceção de interface: precisa continuar acessível ao administrador mesmo com IA global desligada, pois é a tela usada para configurá-la/reativá-la.
- Direitos de uso, limites e pagamentos precisam ser consultados no estado atual do produto/conta; nunca presumidos pela IA.

## Escalonamento humano

Conversas com status `ESCALATED` ou `WAITING_USER` não voltam para a IA automaticamente. Mensagens novas permanecem na fila humana. Isso evita a Cacilda entrar no meio de um atendimento já assumido pela equipe.

## Screenshots

Capturas continuam opcionais e limitadas a PNG/JPG/WebP de até 2 MB. Elas podem ser enviadas ao modelo ativo no suporte, mas não substituem autorização: uma imagem mostrando uma tela administrativa não concede acesso administrativo ao usuário.
