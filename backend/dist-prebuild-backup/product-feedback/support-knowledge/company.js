"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPANY_SUPPORT_TOPICS = void 0;
exports.COMPANY_SUPPORT_TOPICS = [
    {
        id: 'company.home-profile',
        title: 'Visão geral e perfil da empresa',
        audiences: ['COMPANY'],
        routes: ['/company', '/company/perfil'],
        keywords: ['empresa', 'perfil da empresa', 'dados da empresa', 'verificacao', 'verificação', 'cnpj', 'cpf', 'endereco', 'endereço', 'logo', 'slug', 'nome publico'],
        summary: 'Workspace empresarial e cadastro corporativo da empresa vinculada à conta.',
        functions: [
            'Acessar a visão geral da própria empresa.',
            'Editar os dados corporativos disponibilizados em Perfil da empresa.',
            'Acompanhar o status de verificação da própria empresa.',
            'Usar o workspace pessoal separadamente quando a conta também possui área de usuário.',
        ],
        procedures: [
            {
                title: 'Atualizar dados da empresa',
                intents: ['editar empresa', 'mudar logo', 'mudar endereço', 'mudar telefone', 'mudar site'],
                steps: ['Abra Perfil da empresa.', 'Localize o dado que deseja alterar.', 'Edite o campo permitido e salve.', 'Quando a alteração também aparecer em Minha Página, abra a página empresarial e confira a prévia antes de republicar.'],
            },
            {
                title: 'Entender verificação',
                intents: ['empresa verificada', 'verificar empresa', 'selo'],
                steps: ['Abra Perfil da empresa e consulte o status atual.', 'Se houver pendência ou rejeição, siga somente as instruções mostradas para a própria empresa.', 'O selo público só deve aparecer quando o status real for VERIFIED.'],
            },
        ],
        consults: [{ label: 'Empresa vinculada', source: 'registro de companies correspondente ao companyId autenticado', rule: 'Consultar somente a empresa vinculada à conta; nunca pesquisar outra empresa para obter dados internos.' }],
        boundaries: ['Não revelar dados internos de outra empresa.', 'Não ensinar moderação/verificação administrativa; a empresa só acompanha o próprio status.', 'Não afirmar que uma empresa está verificada sem consultar o status atual.'],
        related: ['company.page', 'company.jobs', 'company.notifications'],
    },
    {
        id: 'company.jobs',
        title: 'Gestão e publicação de vagas',
        audiences: ['COMPANY'],
        routes: ['/company/vagas', '/company/vagas/nova', '/company/vagas/'],
        keywords: ['vaga', 'vagas', 'publicar vaga', 'nova vaga', 'editar vaga', 'pausar vaga', 'candidatos', 'inscritos', 'triagem', 'gerenciar candidato'],
        summary: 'Gestão de oportunidades da própria empresa, publicação de nova vaga e acompanhamento de candidaturas vinculadas às vagas empresariais.',
        functions: [
            'Listar e gerenciar vagas pertencentes à empresa autenticada.',
            'Criar uma vaga em /company/vagas/nova.',
            'Abrir o detalhe de uma vaga da empresa.',
            'Acompanhar candidatos inscritos quando a vaga usa candidatura interna.',
            'Gerenciar o processo do candidato apenas no escopo das vagas da própria empresa e respeitando os dados que o candidato tornou disponíveis ao recrutamento.',
        ],
        procedures: [
            {
                title: 'Publicar uma vaga',
                intents: ['publicar vaga', 'criar vaga', 'nova oportunidade'],
                steps: ['Abra Talentos/Vagas e escolha Publicar vaga.', 'Preencha cargo, descrição, requisitos, localização, modalidade e demais campos apresentados.', 'Revise as informações e a forma de candidatura.', 'Salve/publique usando a ação disponível.', 'Depois da publicação, abra a vaga para conferir como ela será exibida e acompanhar candidatos.'],
            },
            {
                title: 'Gerenciar candidatos de uma vaga',
                intents: ['ver candidatos', 'gerenciar candidatura', 'triagem'],
                steps: ['Abra Minhas vagas.', 'Entre na vaga desejada.', 'Abra a área/lista de candidatos inscritos.', 'Use Gerenciar para abrir a candidatura selecionada.', 'Registre observações ou altere etapas somente nos controles oferecidos para aquela candidatura.'],
                notes: ['Compatibilidade/aderência é auxílio ao recrutamento, não decisão automática de contratação.'],
            },
            {
                title: 'Editar uma vaga',
                intents: ['editar vaga', 'corrigir vaga'],
                steps: ['Abra Minhas vagas.', 'Selecione a vaga da própria empresa.', 'Use a ação de edição disponível.', 'Altere os campos necessários e salve.', 'Confira novamente a visualização pública após a alteração.'],
            },
        ],
        consults: [
            { label: 'Vagas da empresa', source: 'endpoints de jobs autenticados com companyId da sessão', rule: 'Filtrar sempre pela própria empresa.' },
            { label: 'Candidaturas', source: 'applications vinculadas à vaga da própria empresa', rule: 'Nunca consultar candidatura de vaga pertencente a outra empresa.' },
        ],
        boundaries: ['Não revelar candidatos de outra empresa.', 'Não expor dados pessoais fora do que o fluxo de recrutamento autoriza.', 'Não prometer resultado de triagem ou contratação.', 'Não executar ações administrativas de moderação de vaga.'],
        related: ['company.invites-talents', 'company.hiring', 'company.page'],
    },
    {
        id: 'company.invites-talents',
        title: 'Banco de talentos e convites',
        audiences: ['COMPANY'],
        routes: ['/company/talentos', '/company/vagas/convites'],
        keywords: ['banco de talentos', 'talentos', 'buscar candidato', 'convidar candidato', 'convite', 'pasta', 'salvar candidato', 'remover convite', 'curriculo candidato'],
        summary: 'Busca de profissionais disponíveis ao recrutamento e gestão de convites para vagas da própria empresa.',
        functions: [
            'Pesquisar perfis disponibilizados ao banco de talentos conforme as regras de privacidade do candidato.',
            'Abrir o perfil profissional disponível à empresa.',
            'Convidar um candidato para vaga elegível da própria empresa.',
            'Visualizar o estado do convite para evitar reenvio redundante.',
            'Organizar candidatos nas coleções/pastas disponibilizadas pelo produto e remover quando a ação estiver disponível.',
        ],
        procedures: [
            {
                title: 'Buscar um profissional',
                intents: ['buscar candidato', 'banco de talentos'],
                steps: ['Abra Banco de talentos.', 'Use os filtros de busca disponíveis.', 'Abra o perfil para analisar somente os dados publicados/permitidos pelo candidato.', 'Se houver uma vaga adequada, use a ação de convite vinculando uma vaga da sua empresa.'],
            },
            {
                title: 'Convidar para uma vaga',
                intents: ['mandar convite', 'convidar candidato'],
                steps: ['Abra o candidato no Banco de talentos.', 'Escolha a ação de convite.', 'Selecione uma vaga da própria empresa.', 'Antes de enviar, confira o estado mostrado para essa vaga e esse candidato.', 'Se o convite já foi enviado, respeite o estado existente em vez de orientar um segundo convite. Se ainda estiver pendente e existir a ação correspondente, o fluxo pode permitir remover/cancelar o convite.'],
            },
            {
                title: 'Organizar em pasta',
                intents: ['salvar na pasta', 'banco de talentos pasta'],
                steps: ['Abra o perfil/candidato.', 'Use a ação de salvar na coleção/pasta disponível.', 'Se ele já estiver salvo, a interface deve apresentar o estado existente e, quando permitido, a ação de remover em vez de duplicar o vínculo.'],
            },
        ],
        consults: [{ label: 'Estado do convite', source: 'convites da própria empresa + candidato/vaga selecionados', rule: 'Consultar antes de orientar reenviar ou cancelar.' }],
        boundaries: ['Não revelar currículo não publicado ou dados sensíveis não compartilhados.', 'Não inferir PcD, saúde, idade, religião ou qualquer atributo sensível.', 'Não permitir convite por vaga de outra empresa.', 'Não orientar reenvio de convite já aceito.'],
        related: ['company.jobs', 'company.hiring'],
    },
    {
        id: 'company.hiring',
        title: 'Configuração e processo de contratação',
        audiences: ['COMPANY'],
        routes: ['/company/contratacao'],
        keywords: ['contratacao', 'contratação', 'admissao', 'admissão', 'etapas', 'documentos', 'processo seletivo', 'workflow', 'configurar contratação'],
        summary: 'Configuração do processo de contratação da própria empresa e orientação das etapas disponibilizadas aos candidatos.',
        functions: [
            'Configurar opções de contratação expostas na tela empresarial.',
            'Orientar o candidato para o fluxo oficial de admissão quando uma candidatura chegar à etapa correspondente.',
            'Usar dados/documentos somente dentro do fluxo seguro da candidatura.'
        ],
        procedures: [
            {
                title: 'Configurar contratação',
                intents: ['configurar contratação', 'configurar admissao', 'documentos necessários'],
                steps: ['Abra Contratação.', 'Revise as opções e etapas oferecidas para sua empresa.', 'Defina os dados/documentos exigidos usando os controles disponíveis.', 'Salve a configuração.', 'Teste o fluxo com uma candidatura apropriada antes de depender dele em produção.'],
            },
        ],
        boundaries: ['Não pedir documentos sensíveis pelo chat quando existe campo oficial no processo.', 'Não consultar admissão de candidato de outra empresa.', 'Não afirmar que uma etapa foi concluída sem consultar o estado real.'],
        related: ['company.jobs', 'company.invites-talents', 'candidate.onboarding'],
    },
    {
        id: 'company.page',
        title: 'Minha Página da empresa',
        audiences: ['COMPANY'],
        routes: ['/company/pagina'],
        keywords: ['minha página', 'minha pagina', 'site empresa', 'microsite', 'tema', 'aurora', 'atlas', 'pulse', 'canvas', 'noir', 'html', 'css', 'codigo', 'código', 'publicar pagina', 'preview', 'categoria', 'ancora', 'âncora'],
        summary: 'Estúdio white-label para criar o microsite público da empresa. A identidade visual é da empresa; o PiraNegócios fornece infraestrutura e integração.',
        functions: [
            'Disponível para empresa verificada.',
            'Salvar rascunho, abrir prévia temporária e publicar a página.',
            'Escolher entre os temas institucionais Aurora, Atlas, Pulse, Canvas e Noir.',
            'Personalizar cores, tipografia, logo, cantos, largura, navegação, hero/capa, contatos e apresentação das vagas.',
            'Configurar largura externa e interna de seções e limites de altura quando o estúdio disponibiliza esses controles.',
            'Adicionar/editar atalhos de categorias que apontam para âncoras da própria página ou links externos.',
            'Reordenar e ocultar seções opcionais; identidade e vagas continuam requisitos integrados.',
            'Usar modo de código livre com HTML/CSS/JS mantendo os componentes obrigatórios de dados oficiais.',
        ],
        procedures: [
            {
                title: 'Criar e publicar a página',
                intents: ['criar minha pagina', 'publicar site da empresa'],
                steps: ['Abra Minha Página.', 'Escolha um tema como direção inicial.', 'Personalize marca, abertura, estrutura, vagas e contato.', 'Use a prévia ao vivo para conferir desktop e larguras menores.', 'Salve o rascunho.', 'Abra Prévia para testar a versão isolada.', 'Quando estiver pronta e a validação não apontar pendências, publique.'],
            },
            {
                title: 'Personalizar o tema',
                intents: ['mudar tema', 'mudar cores', 'mudar largura', 'mudar capa'],
                steps: ['Escolha o tema desejado; o preset inicial é aplicado no momento da escolha.', 'Depois altere cores, fonte, tamanho de logo, cantos e largura.', 'Na abertura, ajuste conteúdo, layout, imagem, posição, sobreposição e altura quando disponíveis.', 'Na estrutura da página, ajuste ordem, visibilidade e dimensões das seções.', 'As escolhas manuais do usuário devem prevalecer sobre o preset do tema.'],
            },
            {
                title: 'Criar atalhos/categorias',
                intents: ['adicionar categoria', 'link ancora', 'atalho página'],
                steps: ['Abra a configuração de Categorias/atalhos.', 'Adicione o nome do item.', 'Para navegar dentro da página, use uma âncora como #sobre, #vagas ou #contato.', 'Para sair da página, informe um endereço externo https:// válido.', 'Confira o comportamento na prévia.'],
            },
            {
                title: 'Usar o editor HTML',
                intents: ['editar html', 'modo codigo', 'css customizado'],
                steps: ['Abra Código/Editor avançado quando disponível para a empresa.', 'Edite HTML, CSS ou JavaScript dentro do ambiente isolado.', 'Mantenha os componentes obrigatórios: <pn-company-name>, <pn-company-address>, <pn-verification-badge> e <pn-jobs>.', 'Abra a prévia e valide o layout.', 'Publique somente depois de passar pela validação.'],
                notes: ['O selo renderiza visualmente apenas para empresa realmente verificada.'],
            },
        ],
        consults: [
            { label: 'Estado da página', source: 'GET /companies/:id/page da própria empresa', rule: 'Consultar rascunho, status, revisão, validação e acesso somente da empresa autenticada.' },
            { label: 'Prévia', source: 'POST /companies/:id/page/preview', rule: 'Prévia é temporária; não tratá-la como publicação definitiva.' },
        ],
        boundaries: ['Minha Página não é um perfil com identidade visual obrigatória do PiraNegócios.', 'Não remover identidade, endereço, selo integrado ou vagas dos requisitos estruturais.', 'Não liberar editor de empresa não verificada.', 'Não expor configuração de outra empresa.'],
        related: ['public.company-page', 'company.home-profile', 'company.jobs'],
    },
    {
        id: 'company.notifications',
        title: 'Notificações da empresa',
        audiences: ['COMPANY'],
        routes: ['/company/notificacoes'],
        keywords: ['notificacao empresa', 'notificação empresa', 'push empresa', 'avisos empresa'],
        summary: 'Preferências de notificações do workspace empresarial.',
        functions: ['Ativar/desativar categorias de push oferecidas à empresa.', 'Manter notificações internas do sistema separadas da permissão push do navegador.'],
        procedures: [{ title: 'Alterar notificações da empresa', intents: ['parar push', 'ativar notificacao'], steps: ['Abra Notificações.', 'Altere as categorias oferecidas.', 'Se o navegador bloqueou push, ajuste também a permissão do site no dispositivo.', 'Lembre que preferências de push não necessariamente removem o sino/notificação interna.'] }],
        boundaries: ['Não alterar notificações de outra empresa.', 'Não afirmar que a permissão do navegador está ativa sem consultar o próprio navegador.'],
    },
];
//# sourceMappingURL=company.js.map