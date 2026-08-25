import type { SupportKnowledgeTopic } from '../support-knowledge.types';

export const SHARED_SUPPORT_TOPICS: SupportKnowledgeTopic[] = [
  {
    id: 'shared.support-widget',
    title: 'Ajuda, Cacilda e sugestões',
    audiences: ['CANDIDATE', 'COMPANY', 'ADMIN'],
    routes: [],
    keywords: ['cacilda', 'suporte', 'ajuda com ia', 'assistente', 'anexar captura', 'screenshot', 'sugerir melhoria', 'feedback', 'melhoria que pedi'],
    summary: 'Widget autenticado de ajuda e sugestões presente na plataforma. A aba de IA só fica disponível quando a IA global está realmente habilitada.',
    functions: [
      'Conversar com a assistente de suporte usando o contexto da tela atual.',
      'Anexar captura PNG/JPG/WebP de até 2 MB.',
      'Enviar sugestão de melhoria; página e processo são identificados automaticamente.',
      'Responder se uma melhoria entregue atendeu, atendeu em parte ou não atendeu à expectativa.',
      'Receber respostas da equipe no mesmo histórico quando o atendimento humano assumir uma conversa.',
    ],
    procedures: [
      { title: 'Pedir ajuda sobre a tela atual', intents: ['pedir ajuda', 'falar com cacilda', 'ajuda com ia'], steps: ['Abra o botão de ajuda e suporte.', 'Use a aba Ajuda com IA quando ela estiver disponível.', 'Descreva o que quer fazer ou o que aconteceu.', 'Se a imagem ajudar, anexe uma captura.', 'A assistente usa a rota atual e seu perfil para carregar apenas o manual autorizado daquela área.'] },
      { title: 'Enviar sugestão de melhoria', intents: ['sugerir melhoria', 'mandar feedback'], steps: ['Abra o botão de ajuda e suporte.', 'Entre em Sugerir melhoria.', 'Explique o que deveria mudar.', 'Anexe uma captura se necessário.', 'Envie. A solicitação fica associada à página e ao processo em que foi criada.'] },
    ],
    boundaries: ['Screenshot não concede permissão a uma área restrita.', 'A assistente não pode afirmar que alterou dados ou executou ações que não foram executadas pelo sistema.', 'Quando IA global está desligada, não orientar o cliente como se o atendimento inteligente estivesse disponível.'],
  },
];
