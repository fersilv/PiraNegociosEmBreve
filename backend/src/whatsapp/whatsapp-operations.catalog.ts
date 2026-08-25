import { Whatsapp } from '@wppconnect-team/wppconnect';

export type WppCapabilityRisk = 'read' | 'write' | 'destructive';

export type WppOperationCapability = {
  scope: string;
  method: string;
  category: string;
  label: string;
  description: string;
  risk: WppCapabilityRisk;
  signature: string;
  event?: boolean;
  experimental?: boolean;
};

// Métodos oficialmente @deprecated no WPPConnect 2.3.1. Só o substituto
// moderno é exposto no painel/MCP.
const DEPRECATED_WPP_METHODS = new Set<string>([
  'getAllChats',
  'getAllChatsWithMessages',
  'getAllGroups',
  'getChat',
  'loadEarlierMessages',
  'getNumberProfile',
  'getUnreadMessages',
  'getAllNewMessages',
  'getAllMessagesInChat',
  'loadAndGetAllMessagesInChat',
  'sendLinkPreview',
  'sendMessageWithThumb',
  'reply',
  'sendFileFromBase64',
  'forwardMessages',
  'stopRecoring',
  'setChatState',
  'onStreamChange',
]);

// Única outra exclusão: sessão/autenticação/QR/browser/token e helpers
// internos ou de filesystem do servidor. Gestão operacional fica liberável.
const SENSITIVE_OR_INTERNAL_WPP_METHODS = new Set<string>([
  'start',
  'getQrCode',
  'waitForQrCodeScan',
  'waitForInChat',
  'waitForPageLoad',
  'waitForLogin',
  'getSessionTokenBrowser',
  'takeScreenshot',
  'useHere',
  'logout',
  'close',
  'getPID',
  'decryptAndSaveFile',
  'downloadEncryptedFile',
  'log',
  'initialize',
  'afterPageLoad',
  'afterPageScriptInjected',
  'checkStart',
  'checkQrCode',
  'loginByCode',
  'checkInChat',
  'tryAutoClose',
  'startAutoClose',
  'cancelAutoClose',
  'registerEvent',
  'onBackendEvent',
]);

const FRIENDLY_LABELS: Record<string, string> = {
  getBlockList: 'Listar contatos bloqueados',
  blockContact: 'Bloquear contato',
  unblockContact: 'Desbloquear contato',
  listChats: 'Listar conversas',
  getMessages: 'Buscar histórico de mensagens',
  getMessageById: 'Consultar mensagem por ID',
  getAllUnreadMessages: 'Listar mensagens não lidas',
  getChatIsOnline: 'Verificar se contato está online',
  getLastSeen: 'Consultar último acesso',
  sendText: 'Enviar mensagem de texto',
  sendImage: 'Enviar imagem',
  sendImageFromBase64: 'Enviar imagem em Base64',
  sendFile: 'Enviar arquivo ou mídia',
  sendPtt: 'Enviar mensagem de voz',
  sendPttFromBase64: 'Enviar voz em Base64',
  sendGif: 'Enviar GIF',
  sendPollMessage: 'Enviar enquete',
  sendLocation: 'Enviar localização',
  sendPixKey: 'Enviar chave Pix',
  editMessage: 'Editar mensagem',
  deleteMessage: 'Apagar mensagem',
  forwardMessagesV2: 'Encaminhar mensagens',
  sendReactionToMessage: 'Reagir a mensagem',
  starMessage: 'Favoritar mensagem',
  archiveChat: 'Arquivar ou desarquivar conversa',
  pinChat: 'Fixar ou desafixar conversa',
  clearChat: 'Limpar conversa',
  deleteChat: 'Excluir conversa',
  getAllContacts: 'Listar contatos',
  getContact: 'Consultar contato',
  checkNumberStatus: 'Validar número no WhatsApp',
  getProfilePicFromServer: 'Consultar foto de perfil',
  getCommonGroups: 'Listar grupos em comum',
  getGroupMembers: 'Listar participantes do grupo',
  getGroupAdmins: 'Listar administradores do grupo',
  getGroupInviteLink: 'Obter link de convite',
  getGroupMembershipRequests: 'Listar solicitações de entrada',
  joinGroup: 'Entrar em grupo por convite',
  createGroup: 'Criar grupo',
  leaveGroup: 'Sair do grupo',
  addParticipant: 'Adicionar participante',
  removeParticipant: 'Remover participante',
  promoteParticipant: 'Promover participante a administrador',
  demoteParticipant: 'Rebaixar administrador',
  approveGroupMembershipRequest: 'Aprovar solicitação de entrada',
  rejectGroupMembershipRequest: 'Rejeitar solicitação de entrada',
  getAllLabels: 'Listar etiquetas',
  addOrRemoveLabels: 'Aplicar ou remover etiquetas',
  createLabel: 'Criar etiqueta',
  deleteLabel: 'Excluir etiqueta',
  getLists: 'Listar listas',
  createList: 'Criar lista',
  editList: 'Editar lista',
  deleteList: 'Excluir lista',
  addChatsToList: 'Adicionar conversas à lista',
  removeChatsFromList: 'Remover conversas da lista',
  createNewsletter: 'Criar canal',
  editNewsletter: 'Editar canal',
  deleteNewsletter: 'Excluir canal',
  muteNewsletter: 'Silenciar ou reativar canal',
  setProfilePic: 'Alterar foto do perfil',
  startTyping: 'Indicar que está digitando',
  stopTyping: 'Parar indicação de digitação',
  startRecording: 'Indicar que está gravando áudio',
  stopRecording: 'Parar indicação de gravação',
  rejectCall: 'Recusar chamada',
  downloadMedia: 'Baixar mídia de mensagem',
  decryptFile: 'Descriptografar mídia de mensagem',
  getHostDevice: 'Consultar dispositivo conectado',
  getWid: 'Consultar ID do número conectado',
  getWAVersion: 'Consultar versão do WhatsApp Web',
  getWAJSVersion: 'Consultar versão do WA-JS',
  getConnectionState: 'Consultar estado da conexão',
  isConnected: 'Verificar conexão com o aparelho',
  isOnline: 'Verificar conectividade da sessão',
  isLoggedIn: 'Verificar autenticação da sessão',
  getBatteryLevel: 'Consultar bateria do aparelho',
};

const DESTRUCTIVE_PREFIXES = ['delete', 'remove', 'leave', 'block', 'reject', 'clear', 'revoke', 'demote', 'cancel'];
const READ_PREFIXES = ['get', 'list', 'check', 'is', 'has', 'are', 'download', 'decrypt', 'query', 'find'];

function collectPublicMethods(): Array<{ method: string; fn: Function }> {
  const methods = new Map<string, Function>();
  let prototype: object | null = Whatsapp.prototype;

  while (prototype && prototype !== Object.prototype) {
    for (const method of Object.getOwnPropertyNames(prototype)) {
      if (method === 'constructor' || methods.has(method)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
      if (typeof descriptor?.value === 'function') methods.set(method, descriptor.value);
    }
    prototype = Object.getPrototypeOf(prototype);
  }

  return [...methods.entries()].map(([method, fn]) => ({ method, fn }));
}

function isSensitiveOrInternal(method: string) {
  if (SENSITIVE_OR_INTERNAL_WPP_METHODS.has(method)) return true;
  const lower = method.toLowerCase();
  return lower.includes('sessiontoken') || lower.includes('qrcode') || lower === 'wapage' || lower.includes('browserpage');
}

function riskFor(method: string, event: boolean): WppCapabilityRisk {
  if (event) return 'read';
  const lower = method.toLowerCase();
  if (DESTRUCTIVE_PREFIXES.some((prefix) => lower.startsWith(prefix))) return 'destructive';
  if (READ_PREFIXES.some((prefix) => lower.startsWith(prefix))) return 'read';
  return 'write';
}

function categoryFor(method: string, event: boolean): string {
  if (event) return 'Eventos · Monitoramento';
  const lower = method.toLowerCase();
  if (lower.includes('newsletter')) return 'Canais';
  if (lower.includes('community')) return 'Comunidades';
  if (lower.includes('group') || lower.includes('participant') || lower.includes('membership')) return 'Grupos';
  if (lower.includes('label')) return 'Etiquetas';
  if (lower.includes('catalog') || lower.includes('product') || lower.includes('collection')) return 'Catálogo';
  if (lower.includes('business') || lower.includes('order') || lower.includes('payment') || lower.includes('pix')) return 'WhatsApp Business';
  if (lower.includes('status')) return 'Status';
  if (lower.includes('profile') || lower.includes('pic')) return 'Perfil';
  if (lower.includes('presence') || lower.includes('typing') || lower.includes('recording') || lower.includes('online')) return 'Presença';
  if (lower.includes('call')) return 'Chamadas';
  if (lower.includes('contact') || lower.includes('block')) return 'Contatos';
  if (lower.includes('list')) return 'Listas';
  if (lower.includes('message') || lower.includes('chat') || lower.startsWith('send') || lower.includes('reaction') || lower.includes('vote')) return 'Mensagens e conversas';
  if (lower.includes('host') || lower.includes('version') || lower.includes('connection') || lower.includes('battery') || lower.includes('wid') || lower.includes('logged')) return 'Conexão · Consulta';
  return 'Outras operações';
}

function splitCamelCase(method: string) {
  return method
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function labelFor(method: string, event: boolean) {
  if (FRIENDLY_LABELS[method]) return FRIENDLY_LABELS[method];
  const words = splitCamelCase(method);
  if (event) return `Monitorar ${words.replace(/^on\s+/i, '')}`;

  const verbs: Array<[RegExp, string]> = [
    [/^get\s+/i, 'Consultar '],
    [/^list\s+/i, 'Listar '],
    [/^send\s+/i, 'Enviar '],
    [/^set\s+/i, 'Definir '],
    [/^create\s+/i, 'Criar '],
    [/^delete\s+/i, 'Excluir '],
    [/^remove\s+/i, 'Remover '],
    [/^add\s+/i, 'Adicionar '],
    [/^edit\s+/i, 'Editar '],
    [/^update\s+/i, 'Atualizar '],
    [/^check\s+/i, 'Verificar '],
    [/^mark\s+/i, 'Marcar '],
    [/^start\s+/i, 'Iniciar '],
    [/^stop\s+/i, 'Parar '],
    [/^join\s+/i, 'Entrar em '],
    [/^leave\s+/i, 'Sair de '],
    [/^approve\s+/i, 'Aprovar '],
    [/^reject\s+/i, 'Rejeitar '],
    [/^block\s+/i, 'Bloquear '],
    [/^unblock\s+/i, 'Desbloquear '],
    [/^archive\s+/i, 'Arquivar '],
    [/^pin\s+/i, 'Fixar '],
    [/^download\s+/i, 'Baixar '],
    [/^decrypt\s+/i, 'Descriptografar '],
  ];

  for (const [pattern, replacement] of verbs) {
    if (pattern.test(words)) return words.replace(pattern, replacement);
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function signatureFor(method: string, fn: Function, event: boolean) {
  if (event) return `${method}(callback) → eventos recentes no MCP`;
  try {
    const source = Function.prototype.toString.call(fn).replace(/\n/g, ' ');
    const match = source.match(/^[^(]*\(([^)]*)\)/);
    const params = match?.[1]?.replace(/\s+/g, ' ').trim();
    if (params !== undefined) return `${method}(${params})`;
  } catch {}
  return `${method}(...args)`;
}

function descriptionFor(method: string, risk: WppCapabilityRisk, event: boolean) {
  if (event) {
    return `Monitora o evento público ${method} do WPPConnect. O backend registra as ocorrências e o MCP consulta os eventos recentes sem receber callbacks executáveis.`;
  }
  if (method === 'listChats') return 'Consulta conversas com filtros modernos do WPPConnect, incluindo usuários, grupos, newsletters, etiquetas e paginação.';
  if (method === 'getMessages') return 'Busca mensagens diretamente no WhatsApp com paginação, direção, mensagem de referência e filtros de mídia.';
  if (method === 'sendText') return 'Envia texto para qualquer destino suportado pelo WPPConnect usando as opções modernas de envio.';
  if (method === 'sendFile') return 'Envia arquivo ou mídia usando caminho, URL ou Base64 e as opções suportadas pelo WPPConnect.';
  if (method === 'downloadMedia') return 'Obtém a mídia original vinculada a uma mensagem e a devolve em Base64.';
  if (method === 'checkNumberStatus') return 'Verifica se o identificador corresponde a um número disponível no WhatsApp.';
  if (method === 'addOrRemoveLabels') return 'Aplica ou remove etiquetas do WhatsApp Business em conversas ou contatos.';
  if (method === 'removeParticipant') return 'Remove um participante quando o número possui permissão administrativa no grupo.';
  if (risk === 'read') return `Executa ${method}, método público de consulta do WPPConnect, sem alterar o conteúdo da conta.`;
  if (risk === 'destructive') return `Executa ${method}, método público do WPPConnect que pode remover, rejeitar ou apagar dados. Exige autorização explícita.`;
  return `Executa ${method}, método público do WPPConnect para enviar, alterar ou administrar dados do WhatsApp.`;
}

function buildCapabilities(): WppOperationCapability[] {
  const capabilities: WppOperationCapability[] = collectPublicMethods()
    .filter(({ method }) => !DEPRECATED_WPP_METHODS.has(method))
    .filter(({ method }) => !isSensitiveOrInternal(method))
    .map(({ method, fn }) => {
      const event = method.startsWith('on');
      const risk = riskFor(method, event);
      return {
        scope: `wpp:${method}`,
        method,
        category: categoryFor(method, event),
        label: labelFor(method, event),
        description: descriptionFor(method, risk, event),
        risk,
        signature: signatureFor(method, fn, event),
        event: event || undefined,
      } satisfies WppOperationCapability;
    });

  capabilities.push({
    scope: 'channels:search',
    method: 'searchChannels',
    category: 'Canais',
    label: 'Pesquisar canais',
    description: 'Pesquisa canais/newsletters no diretório do WhatsApp pelo nome e retorna os IDs @newsletter encontrados.',
    risk: 'read',
    signature: 'searchChannels(query, limit?)',
    experimental: true,
  });

  return capabilities.sort(
    (a, b) =>
      a.category.localeCompare(b.category, 'pt-BR') ||
      a.label.localeCompare(b.label, 'pt-BR'),
  );
}

export const WPP_OPERATION_CAPABILITIES: WppOperationCapability[] = buildCapabilities();
export const WPP_DEPRECATED_METHODS = [...DEPRECATED_WPP_METHODS].sort();
export const WPP_SENSITIVE_METHODS = [...SENSITIVE_OR_INTERNAL_WPP_METHODS].sort();
