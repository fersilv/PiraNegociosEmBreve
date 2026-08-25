export type WhatsAppCapabilityRisk = 'read' | 'write' | 'destructive';

export type WhatsAppCapability = {
  scope: string;
  category: string;
  label: string;
  description: string;
  risk: WhatsAppCapabilityRisk;
  experimental?: boolean;
};

export const WHATSAPP_CAPABILITIES: WhatsAppCapability[] = [
  { scope: 'connection:read', category: 'Conexão', label: 'Consultar conexão', description: 'Ver estado da sessão, número, dispositivo e informações operacionais básicas.', risk: 'read' },

  { scope: 'chats:read', category: 'Conversas', label: 'Listar conversas', description: 'Listar chats individuais, grupos, canais e metadados visíveis na conta.', risk: 'read' },
  { scope: 'chats:archive', category: 'Conversas', label: 'Arquivar conversas', description: 'Arquivar e desarquivar chats.', risk: 'write' },
  { scope: 'chats:pin', category: 'Conversas', label: 'Fixar conversas', description: 'Fixar e desafixar chats na lista de conversas.', risk: 'write' },
  { scope: 'chats:mute', category: 'Conversas', label: 'Silenciar conversas', description: 'Silenciar ou remover o silêncio de chats por período determinado.', risk: 'write' },
  { scope: 'chats:seen', category: 'Conversas', label: 'Marcar como lida', description: 'Marcar mensagens de um chat como vistas ou marcar a conversa como não lida.', risk: 'write' },
  { scope: 'chats:temporary', category: 'Conversas', label: 'Mensagens temporárias', description: 'Ativar ou desativar mensagens temporárias em chats e grupos.', risk: 'write' },
  { scope: 'chats:clear', category: 'Conversas', label: 'Limpar conversa', description: 'Limpar o conteúdo local de uma conversa.', risk: 'destructive' },
  { scope: 'chats:delete', category: 'Conversas', label: 'Excluir conversa', description: 'Excluir um chat da conta conectada.', risk: 'destructive' },

  { scope: 'messages:read', category: 'Mensagens', label: 'Ler mensagens monitoradas', description: 'Consultar mensagens capturadas e persistidas pelo PiraNegócios.', risk: 'read' },
  { scope: 'messages:history', category: 'Mensagens', label: 'Consultar histórico do WhatsApp', description: 'Buscar mensagens antigas diretamente no WhatsApp com paginação.', risk: 'read' },
  { scope: 'messages:media', category: 'Mensagens', label: 'Abrir mídias', description: 'Baixar imagens, áudios e outras mídias vinculadas a mensagens.', risk: 'read' },
  { scope: 'messages:send', category: 'Mensagens', label: 'Enviar texto', description: 'Enviar novas mensagens de texto para contatos.', risk: 'write' },
  { scope: 'messages:media:send', category: 'Mensagens', label: 'Enviar mídia e arquivos', description: 'Enviar imagens, vídeos, documentos, GIFs e arquivos.', risk: 'write' },
  { scope: 'messages:audio:send', category: 'Mensagens', label: 'Enviar áudio', description: 'Enviar áudio ou mensagem de voz PTT.', risk: 'write' },
  { scope: 'messages:reply', category: 'Mensagens', label: 'Responder mensagem', description: 'Responder diretamente uma mensagem específica sem iniciar uma mensagem solta.', risk: 'write' },
  { scope: 'messages:edit', category: 'Mensagens', label: 'Editar mensagem', description: 'Editar mensagem enviada quando o WhatsApp permitir.', risk: 'write' },
  { scope: 'messages:delete', category: 'Mensagens', label: 'Apagar mensagem', description: 'Apagar mensagem enviada ou remover mensagem conforme suporte do WhatsApp.', risk: 'destructive' },
  { scope: 'messages:forward', category: 'Mensagens', label: 'Encaminhar mensagem', description: 'Encaminhar uma ou mais mensagens para outro chat.', risk: 'write' },
  { scope: 'messages:react', category: 'Mensagens', label: 'Reagir a mensagem', description: 'Adicionar ou remover reação por emoji em uma mensagem.', risk: 'write' },
  { scope: 'messages:poll', category: 'Mensagens', label: 'Criar enquete', description: 'Criar enquete em conversa ou grupo.', risk: 'write' },
  { scope: 'messages:location', category: 'Mensagens', label: 'Enviar localização', description: 'Enviar localização geográfica para uma conversa.', risk: 'write' },
  { scope: 'messages:contact', category: 'Mensagens', label: 'Enviar contato', description: 'Enviar cartão de contato/vCard.', risk: 'write' },
  { scope: 'messages:star', category: 'Mensagens', label: 'Favoritar mensagem', description: 'Marcar ou desmarcar mensagem com estrela.', risk: 'write' },

  { scope: 'contacts:read', category: 'Contatos', label: 'Consultar contatos', description: 'Listar contatos, consultar cadastro, foto, status e verificar números.', risk: 'read' },
  { scope: 'contacts:write', category: 'Contatos', label: 'Salvar contatos internos', description: 'Salvar contatos no diretório interno do PiraNegócios.', risk: 'write' },
  { scope: 'contacts:blocklist:read', category: 'Contatos', label: 'Consultar bloqueados', description: 'Consultar a lista de contatos bloqueados.', risk: 'read' },
  { scope: 'contacts:block', category: 'Contatos', label: 'Bloquear contato', description: 'Bloquear um contato no WhatsApp.', risk: 'destructive' },
  { scope: 'contacts:unblock', category: 'Contatos', label: 'Desbloquear contato', description: 'Remover um contato da lista de bloqueados.', risk: 'write' },

  { scope: 'groups:read', category: 'Grupos', label: 'Listar grupos', description: 'Listar grupos, IDs e metadados visíveis para a conta.', risk: 'read' },
  { scope: 'groups:history', category: 'Grupos', label: 'Histórico completo', description: 'Percorrer o histórico do grupo diretamente no WhatsApp com paginação.', risk: 'read' },
  { scope: 'groups:media', category: 'Grupos', label: 'Ver mídias do grupo', description: 'Abrir imagens, áudios e outras mídias publicadas em grupos.', risk: 'read' },
  { scope: 'groups:members:read', category: 'Grupos', label: 'Ver participantes', description: 'Listar participantes, administradores e IDs dos membros.', risk: 'read' },
  { scope: 'groups:join', category: 'Grupos', label: 'Entrar por convite', description: 'Entrar em grupo por link ou código de convite.', risk: 'write' },
  { scope: 'groups:create', category: 'Grupos', label: 'Criar grupo', description: 'Criar um novo grupo e incluir participantes iniciais.', risk: 'write' },
  { scope: 'groups:leave', category: 'Grupos', label: 'Sair de grupo', description: 'Remover este número de um grupo.', risk: 'destructive' },
  { scope: 'groups:send', category: 'Grupos', label: 'Enviar mensagem no grupo', description: 'Publicar novas mensagens de texto em grupos.', risk: 'write' },
  { scope: 'groups:members:add', category: 'Grupos', label: 'Adicionar participantes', description: 'Adicionar pessoas ao grupo quando este número tiver permissão.', risk: 'write' },
  { scope: 'groups:members:remove', category: 'Grupos', label: 'Remover participantes', description: 'Remover participantes do grupo para fins de administração/moderação.', risk: 'destructive' },
  { scope: 'groups:members:promote', category: 'Grupos', label: 'Promover administrador', description: 'Promover participante a administrador do grupo.', risk: 'write' },
  { scope: 'groups:members:demote', category: 'Grupos', label: 'Remover administrador', description: 'Remover privilégios de administrador de um participante.', risk: 'destructive' },
  { scope: 'groups:requests:read', category: 'Grupos', label: 'Ver pedidos de entrada', description: 'Consultar pedidos pendentes de participação no grupo.', risk: 'read' },
  { scope: 'groups:requests:approve', category: 'Grupos', label: 'Aprovar entrada', description: 'Aprovar pedido de entrada de participante.', risk: 'write' },
  { scope: 'groups:requests:reject', category: 'Grupos', label: 'Rejeitar entrada', description: 'Rejeitar pedido de entrada de participante.', risk: 'destructive' },
  { scope: 'groups:invite:read', category: 'Grupos', label: 'Consultar convite', description: 'Obter link de convite e consultar informações de convite do grupo.', risk: 'read' },
  { scope: 'groups:invite:revoke', category: 'Grupos', label: 'Revogar convite', description: 'Revogar o link atual de convite do grupo.', risk: 'destructive' },
  { scope: 'groups:settings:subject', category: 'Grupos', label: 'Alterar nome do grupo', description: 'Alterar o assunto/nome exibido do grupo.', risk: 'write' },
  { scope: 'groups:settings:description', category: 'Grupos', label: 'Alterar descrição', description: 'Alterar a descrição do grupo.', risk: 'write' },
  { scope: 'groups:settings:icon', category: 'Grupos', label: 'Alterar imagem do grupo', description: 'Definir ou remover a imagem/ícone do grupo.', risk: 'write' },
  { scope: 'groups:settings:admins-only', category: 'Grupos', label: 'Mensagens somente admins', description: 'Ativar ou desativar o modo em que apenas administradores enviam mensagens.', risk: 'write' },
  { scope: 'groups:settings:property', category: 'Grupos', label: 'Propriedades do grupo', description: 'Alterar propriedades administrativas suportadas pelo WhatsApp.', risk: 'write' },
  { scope: 'groups:common:read', category: 'Grupos', label: 'Grupos em comum', description: 'Consultar grupos em comum com um contato.', risk: 'read' },

  { scope: 'communities:read', category: 'Comunidades', label: 'Consultar comunidade', description: 'Consultar participantes e estrutura de comunidades.', risk: 'read' },
  { scope: 'communities:create', category: 'Comunidades', label: 'Criar comunidade', description: 'Criar nova comunidade.', risk: 'write' },
  { scope: 'communities:manage', category: 'Comunidades', label: 'Administrar comunidade', description: 'Adicionar/remover subgrupos e promover/rebaixar participantes.', risk: 'destructive' },
  { scope: 'communities:deactivate', category: 'Comunidades', label: 'Desativar comunidade', description: 'Desativar uma comunidade administrada pela conta.', risk: 'destructive' },

  { scope: 'labels:read', category: 'Organização', label: 'Consultar etiquetas', description: 'Listar labels/etiquetas do WhatsApp Business.', risk: 'read' },
  { scope: 'labels:create', category: 'Organização', label: 'Criar etiqueta', description: 'Criar nova etiqueta para organização de conversas.', risk: 'write' },
  { scope: 'labels:assign', category: 'Organização', label: 'Aplicar/remover etiqueta', description: 'Adicionar ou remover etiquetas de chats.', risk: 'write' },
  { scope: 'labels:delete', category: 'Organização', label: 'Excluir etiqueta', description: 'Excluir etiquetas existentes.', risk: 'destructive' },
  { scope: 'lists:read', category: 'Organização', label: 'Consultar listas', description: 'Listar listas de organização e seus chats.', risk: 'read' },
  { scope: 'lists:create', category: 'Organização', label: 'Criar lista', description: 'Criar uma nova lista e opcionalmente incluir chats.', risk: 'write' },
  { scope: 'lists:manage', category: 'Organização', label: 'Administrar lista', description: 'Renomear lista e adicionar/remover chats.', risk: 'write' },
  { scope: 'lists:delete', category: 'Organização', label: 'Excluir lista', description: 'Excluir lista de organização.', risk: 'destructive' },

  { scope: 'channels:read', category: 'Canais', label: 'Consultar canais', description: 'Consultar canais/newsletters visíveis para a conta.', risk: 'read', experimental: true },
  { scope: 'channels:create', category: 'Canais', label: 'Criar canal', description: 'Criar uma newsletter/canal.', risk: 'write', experimental: true },
  { scope: 'channels:manage', category: 'Canais', label: 'Editar canal', description: 'Editar nome, descrição, foto e silêncio do canal.', risk: 'write', experimental: true },
  { scope: 'channels:publish', category: 'Canais', label: 'Publicar no canal', description: 'Publicar conteúdo em canal administrado pela conta.', risk: 'write', experimental: true },
  { scope: 'channels:delete', category: 'Canais', label: 'Excluir canal', description: 'Destruir uma newsletter/canal.', risk: 'destructive', experimental: true },

  { scope: 'profile:read', category: 'Perfil', label: 'Consultar perfil', description: 'Consultar nome, recado/status e foto do próprio perfil.', risk: 'read' },
  { scope: 'profile:write', category: 'Perfil', label: 'Editar perfil', description: 'Alterar nome, recado/status e foto do próprio perfil.', risk: 'write' },
  { scope: 'business:read', category: 'Negócio', label: 'Consultar perfil comercial', description: 'Consultar perfil comercial e produtos associados.', risk: 'read' },
  { scope: 'business:write', category: 'Negócio', label: 'Editar perfil comercial', description: 'Alterar informações do perfil comercial quando suportado.', risk: 'write' },

  { scope: 'catalog:read', category: 'Catálogo', label: 'Consultar catálogo', description: 'Consultar produtos, coleções e detalhes do catálogo comercial.', risk: 'read' },
  { scope: 'catalog:products:write', category: 'Catálogo', label: 'Criar/editar produto', description: 'Criar e editar produtos, imagens e visibilidade.', risk: 'write' },
  { scope: 'catalog:products:delete', category: 'Catálogo', label: 'Excluir produto', description: 'Excluir produtos do catálogo.', risk: 'destructive' },
  { scope: 'catalog:collections:write', category: 'Catálogo', label: 'Criar/editar coleção', description: 'Criar e editar coleções de produtos.', risk: 'write' },
  { scope: 'catalog:collections:delete', category: 'Catálogo', label: 'Excluir coleção', description: 'Excluir coleção do catálogo.', risk: 'destructive' },
  { scope: 'catalog:cart:write', category: 'Catálogo', label: 'Configurar carrinho', description: 'Ativar ou desativar carrinho de compras do catálogo.', risk: 'write' },

  { scope: 'status:publish', category: 'Status', label: 'Publicar status', description: 'Publicar status/story de texto, imagem ou vídeo.', risk: 'write' },
  { scope: 'status:read-receipt', category: 'Status', label: 'Confirmar leitura de status', description: 'Enviar confirmação de leitura de um status.', risk: 'write' },

  { scope: 'presence:read', category: 'Presença', label: 'Consultar presença', description: 'Consultar online/último acesso e assinar atualizações de presença quando disponível.', risk: 'read' },
  { scope: 'presence:write', category: 'Presença', label: 'Alterar presença', description: 'Definir online/offline e estados digitando/gravando em conversas.', risk: 'write' },

  { scope: 'orders:read', category: 'Pedidos', label: 'Consultar pedidos', description: 'Consultar pedido comercial associado a uma mensagem.', risk: 'read' },
  { scope: 'calls:reject', category: 'Chamadas', label: 'Rejeitar chamadas', description: 'Rejeitar chamadas de áudio/vídeo recebidas pela conta.', risk: 'write' },
  { scope: 'broadcasts:read', category: 'Listas de transmissão', label: 'Consultar transmissões', description: 'Consultar listas de transmissão visíveis para a conta.', risk: 'read' },
];

export const WHATSAPP_SCOPES = WHATSAPP_CAPABILITIES.map((capability) => capability.scope);
export type WhatsAppScope = string;

export const DEFAULT_WHATSAPP_SCOPES: WhatsAppScope[] = [
  'connection:read',
  'messages:read',
  'contacts:read',
  'groups:read',
];

export function sanitizeWhatsAppScopes(value: unknown): WhatsAppScope[] {
  if (!Array.isArray(value)) return [...DEFAULT_WHATSAPP_SCOPES];
  const allowed = new Set<string>(WHATSAPP_SCOPES);
  return Array.from(new Set(value.map(String).filter((scope) => allowed.has(scope))));
}

export function getWhatsAppCapability(scope: string) {
  return WHATSAPP_CAPABILITIES.find((capability) => capability.scope === scope) || null;
}
