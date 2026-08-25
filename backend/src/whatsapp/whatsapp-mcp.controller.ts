import { All, Controller, Param, Req, Res, UseGuards } from '@nestjs/common';
import {
  publishChannelLink,
  publishChannelMedia,
  publishChannelTextWithLink,
} from './whatsapp-channel-publisher';
import { executeWppOperation } from './whatsapp-operation-runner';
import { WPP_OPERATION_CAPABILITIES } from './whatsapp-operations.catalog';
import { WhatsAppOAuthGuard } from './whatsapp-oauth.guard';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp/mcp/:instanceId')
@UseGuards(WhatsAppOAuthGuard)
export class WhatsAppMcpController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @All()
  async handle(@Param('instanceId') instanceId: string, @Req() req: any, @Res() res: any) {
    const [{ createMcpHandler, McpServer }, { toNodeHandler }, z] = await Promise.all([
      import('@modelcontextprotocol/server'),
      import('@modelcontextprotocol/node'),
      import('zod/v4'),
    ]);
    const scopes = new Set<string>(req.whatsappOAuth?.scopes || []);

    const handler = createMcpHandler(() => {
      const server = new McpServer({
        name: `PiraNegocios WhatsApp - ${instanceId}`,
        version: '2.3.0',
      });

      // Ferramentas semânticas antigas permanecem para não quebrar integrações já criadas.
      if (scopes.has('connection:read')) {
        server.registerTool(
          'whatsapp_connection_status',
          { description: 'Consulta o estado da conexão deste número do WhatsApp.', inputSchema: z.object({}) },
          async () => this.result(await this.safeConnectionStatus(instanceId)),
        );
      }

      if (scopes.has('messages:read')) {
        server.registerTool(
          'whatsapp_list_messages',
          {
            description: 'Lista mensagens recentes capturadas pelo PiraNegócios desde que a sessão passou a monitorar o WhatsApp.',
            inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
          },
          async ({ limit }: { limit?: number }) => this.result(await this.whatsapp.listMessages(instanceId, limit || 50)),
        );
      }

      if (scopes.has('messages:send')) {
        server.registerTool(
          'whatsapp_send_message',
          {
            description: 'Envia uma mensagem por este número. Use telefone com DDI ou um chatId do WhatsApp.',
            inputSchema: z.object({ target: z.string().min(1), text: z.string().min(1) }),
          },
          async ({ target, text }: { target: string; text: string }) => this.result(await this.whatsapp.sendText(instanceId, target, text)),
        );
      }

      if (scopes.has('contacts:read')) {
        server.registerTool(
          'whatsapp_list_contacts',
          { description: 'Lista os contatos visíveis nesta sessão do WhatsApp.', inputSchema: z.object({}) },
          async () => this.result(await this.whatsapp.listContacts(instanceId)),
        );
      }

      if (scopes.has('contacts:write')) {
        server.registerTool(
          'whatsapp_save_contact',
          {
            description: 'Salva um contato no diretório interno do PiraNegócios vinculado a este número.',
            inputSchema: z.object({ phoneNumber: z.string().min(8), name: z.string().min(1), notes: z.string().optional() }),
          },
          async (args: { phoneNumber: string; name: string; notes?: string }) => this.result(await this.whatsapp.saveContact(instanceId, args)),
        );
      }

      if (scopes.has('groups:read')) {
        server.registerTool(
          'whatsapp_list_groups',
          { description: 'Lista grupos visíveis para este número, incluindo seus IDs @g.us.', inputSchema: z.object({}) },
          async () => this.result(await this.whatsapp.listGroups(instanceId)),
        );
      }

      if (scopes.has('groups:history')) {
        server.registerTool(
          'whatsapp_get_group_history',
          {
            description: 'Busca diretamente no WhatsApp o histórico de um grupo com paginação por beforeMessageId.',
            inputSchema: z.object({
              groupId: z.string().min(1),
              count: z.number().int().min(1).max(500).optional(),
              beforeMessageId: z.string().min(1).optional(),
              media: z.enum(['all', 'image', 'document', 'url']).optional(),
            }),
          },
          async (args: { groupId: string; count?: number; beforeMessageId?: string; media?: 'all' | 'image' | 'document' | 'url' }) =>
            this.result(await this.whatsapp.getGroupHistory(instanceId, args.groupId, args)),
        );
      }

      if (scopes.has('groups:media')) {
        server.registerTool(
          'whatsapp_get_group_media',
          {
            description: 'Baixa a mídia original de uma mensagem pelo messageId. Imagens são devolvidas como conteúdo visual para análise.',
            inputSchema: z.object({ messageId: z.string().min(1) }),
          },
          async ({ messageId }: { messageId: string }) => this.mediaResult(await this.whatsapp.getGroupMedia(instanceId, messageId)),
        );
      }

      if (scopes.has('groups:members:read')) {
        server.registerTool(
          'whatsapp_list_group_members',
          {
            description: 'Lista participantes atuais de um grupo.',
            inputSchema: z.object({ groupId: z.string().min(1) }),
          },
          async ({ groupId }: { groupId: string }) => this.result(await this.whatsapp.listGroupMembers(instanceId, groupId)),
        );
      }

      if (scopes.has('groups:join')) {
        server.registerTool(
          'whatsapp_join_group',
          {
            description: 'Entra em um grupo usando link ou código de convite.',
            inputSchema: z.object({ inviteCodeOrLink: z.string().min(1) }),
          },
          async ({ inviteCodeOrLink }: { inviteCodeOrLink: string }) => this.result(await this.whatsapp.joinGroup(instanceId, inviteCodeOrLink)),
        );
      }

      if (scopes.has('groups:members:add')) {
        server.registerTool(
          'whatsapp_add_group_member',
          {
            description: 'Adiciona uma pessoa a um grupo administrado por este número.',
            inputSchema: z.object({ groupId: z.string().min(1), participantId: z.string().min(1) }),
          },
          async ({ groupId, participantId }: { groupId: string; participantId: string }) =>
            this.result(await this.whatsapp.addGroupParticipant(instanceId, groupId, participantId)),
        );
      }

      if (scopes.has('groups:members:remove')) {
        server.registerTool(
          'whatsapp_remove_group_member',
          {
            description: 'Remove participante de um grupo. A ação é administrativa e deve ser usada com critério.',
            inputSchema: z.object({ groupId: z.string().min(1), participantId: z.string().min(1) }),
          },
          async ({ groupId, participantId }: { groupId: string; participantId: string }) =>
            this.result(await this.whatsapp.removeGroupParticipant(instanceId, groupId, participantId)),
        );
      }

      if (scopes.has('groups:requests:read')) {
        server.registerTool(
          'whatsapp_list_group_join_requests',
          {
            description: 'Lista pedidos pendentes de entrada em um grupo.',
            inputSchema: z.object({ groupId: z.string().min(1) }),
          },
          async ({ groupId }: { groupId: string }) => this.result(await this.whatsapp.listGroupMembershipRequests(instanceId, groupId)),
        );
      }

      if (scopes.has('groups:requests:write')) {
        server.registerTool(
          'whatsapp_approve_group_join_request',
          {
            description: 'Aprova um pedido pendente de entrada no grupo.',
            inputSchema: z.object({ groupId: z.string().min(1), participantId: z.string().min(1) }),
          },
          async ({ groupId, participantId }: { groupId: string; participantId: string }) =>
            this.result(await this.whatsapp.approveGroupMembershipRequest(instanceId, groupId, participantId)),
        );
        server.registerTool(
          'whatsapp_reject_group_join_request',
          {
            description: 'Rejeita um pedido pendente de entrada no grupo.',
            inputSchema: z.object({ groupId: z.string().min(1), participantId: z.string().min(1) }),
          },
          async ({ groupId, participantId }: { groupId: string; participantId: string }) =>
            this.result(await this.whatsapp.rejectGroupMembershipRequest(instanceId, groupId, participantId)),
        );
      }

      if (scopes.has('groups:send')) {
        server.registerTool(
          'whatsapp_send_group_message',
          {
            description: 'Envia texto novo para um grupo. É independente das permissões de leitura/moderação.',
            inputSchema: z.object({ groupId: z.string().min(1), text: z.string().min(1) }),
          },
          async ({ groupId, text }: { groupId: string; text: string }) => this.result(await this.whatsapp.sendText(instanceId, groupId, text)),
        );
      }

      // Moderação granular: permite agir em contexto sem liberar mensagem avulsa.
      if (scopes.has('groups:reply')) {
        server.registerTool(
          'whatsapp_reply_group_message',
          {
            description: 'Responde uma mensagem específica de um grupo sem conceder permissão para criar mensagem avulsa no grupo.',
            inputSchema: z.object({ groupId: z.string().min(1), messageId: z.string().min(1), text: z.string().min(1) }),
          },
          async ({ groupId, messageId, text }: { groupId: string; messageId: string; text: string }) =>
            this.result(await executeWppOperation(this.whatsapp, instanceId, 'groups:reply', [groupId, messageId, text])),
        );
      }

      if (scopes.has('groups:reaction')) {
        server.registerTool(
          'whatsapp_react_group_message',
          {
            description: 'Reage a uma mensagem específica do grupo com emoji, ou remove a reação com reaction=false.',
            inputSchema: z.object({ messageId: z.string().min(1), reaction: z.union([z.string().min(1), z.literal(false)]) }),
          },
          async ({ messageId, reaction }: { messageId: string; reaction: string | false }) =>
            this.result(await executeWppOperation(this.whatsapp, instanceId, 'groups:reaction', [messageId, reaction])),
        );
      }

      if (scopes.has('groups:message:delete')) {
        server.registerTool(
          'whatsapp_delete_group_message',
          {
            description: 'Remove uma mensagem específica do grupo quando o WhatsApp e as permissões administrativas permitirem. AÇÃO DESTRUTIVA.',
            inputSchema: z.object({ groupId: z.string().min(1), messageId: z.string().min(1), onlyLocal: z.boolean().optional() }),
          },
          async ({ groupId, messageId, onlyLocal }: { groupId: string; messageId: string; onlyLocal?: boolean }) =>
            this.result(await executeWppOperation(this.whatsapp, instanceId, 'groups:message:delete', [groupId, messageId, onlyLocal ?? false])),
        );
      }

      if (scopes.has('channels:read')) {
        server.registerTool(
          'whatsapp_list_channels',
          { description: 'Lista canais/newsletters já carregados nesta sessão do WhatsApp.', inputSchema: z.object({}) },
          async () => this.result(await this.whatsapp.listChannels(instanceId)),
        );
        server.registerTool(
          'whatsapp_search_channels',
          {
            description: 'Pesquisa canais/newsletters no diretório do WhatsApp pelo nome e devolve os IDs @newsletter encontrados.',
            inputSchema: z.object({
              query: z.string().min(1),
              limit: z.number().int().min(1).max(50).optional(),
            }),
          },
          async ({ query, limit }: { query: string; limit?: number }) =>
            this.result(await executeWppOperation(this.whatsapp, instanceId, 'channels:search', [query, limit || 20])),
        );
      }

      if (scopes.has('channels:publish:text')) {
        server.registerTool(
          'whatsapp_publish_channel_text',
          {
            description: 'Publica uma mensagem de texto diretamente em um canal/newsletter administrado por esta sessão. Use o ID terminado em @newsletter.',
            inputSchema: z.object({
              newsletterId: z.string().min(1),
              text: z.string().min(1).max(4096),
            }),
          },
          async ({ newsletterId, text }: { newsletterId: string; text: string }) =>
            this.result(await executeWppOperation(this.whatsapp, instanceId, 'channels:publish:text', [newsletterId, text])),
        );
      }

      if (scopes.has('channels:publish:image')) {
        server.registerTool(
          'whatsapp_publish_channel_image',
          {
            description: 'EXPERIMENTAL: publica imagem sem legenda em canal/newsletter. media aceita URL pública http/https, data URL ou Base64; não aceita caminho local do servidor.',
            inputSchema: z.object({
              newsletterId: z.string().min(1),
              media: z.string().min(1),
              filename: z.string().min(1).max(180).optional(),
              mimetype: z.string().min(1).max(120).optional(),
            }),
          },
          async (args: { newsletterId: string; media: string; filename?: string; mimetype?: string }) =>
            this.result(await publishChannelMedia(this.whatsapp, instanceId, args.newsletterId, {
              media: args.media,
              type: 'image',
              filename: args.filename,
              mimetype: args.mimetype,
            })),
        );
      }

      if (scopes.has('channels:publish:image-caption')) {
        server.registerTool(
          'whatsapp_publish_channel_image_with_caption',
          {
            description: 'EXPERIMENTAL: publica imagem com legenda em canal/newsletter. media aceita URL pública http/https, data URL ou Base64.',
            inputSchema: z.object({
              newsletterId: z.string().min(1),
              media: z.string().min(1),
              caption: z.string().min(1).max(4096),
              filename: z.string().min(1).max(180).optional(),
              mimetype: z.string().min(1).max(120).optional(),
            }),
          },
          async (args: { newsletterId: string; media: string; caption: string; filename?: string; mimetype?: string }) =>
            this.result(await publishChannelMedia(this.whatsapp, instanceId, args.newsletterId, {
              media: args.media,
              type: 'image',
              caption: args.caption,
              filename: args.filename,
              mimetype: args.mimetype,
            })),
        );
      }

      if (scopes.has('channels:publish:link')) {
        server.registerTool(
          'whatsapp_publish_channel_link',
          {
            description: 'Publica um link em canal/newsletter e tenta gerar a prévia nativa do WhatsApp.',
            inputSchema: z.object({ newsletterId: z.string().min(1), url: z.string().min(1).max(2048) }),
          },
          async ({ newsletterId, url }: { newsletterId: string; url: string }) =>
            this.result(await publishChannelLink(this.whatsapp, instanceId, newsletterId, url)),
        );
      }

      if (scopes.has('channels:publish:text-link')) {
        server.registerTool(
          'whatsapp_publish_channel_text_with_link',
          {
            description: 'Publica texto seguido de URL em canal/newsletter e tenta gerar a prévia nativa do WhatsApp.',
            inputSchema: z.object({
              newsletterId: z.string().min(1),
              text: z.string().min(1).max(4000),
              url: z.string().min(1).max(2048),
            }),
          },
          async ({ newsletterId, text, url }: { newsletterId: string; text: string; url: string }) =>
            this.result(await publishChannelTextWithLink(this.whatsapp, instanceId, newsletterId, text, url)),
        );
      }

      if (scopes.has('channels:publish:file')) {
        server.registerTool(
          'whatsapp_publish_channel_file',
          {
            description: 'EXPERIMENTAL: publica documento/arquivo em canal/newsletter com legenda opcional. media aceita URL pública, data URL ou Base64.',
            inputSchema: z.object({
              newsletterId: z.string().min(1),
              media: z.string().min(1),
              filename: z.string().min(1).max(180),
              caption: z.string().max(4096).optional(),
              mimetype: z.string().min(1).max(120).optional(),
            }),
          },
          async (args: { newsletterId: string; media: string; filename: string; caption?: string; mimetype?: string }) =>
            this.result(await publishChannelMedia(this.whatsapp, instanceId, args.newsletterId, {
              media: args.media,
              type: 'document',
              caption: args.caption,
              filename: args.filename,
              mimetype: args.mimetype,
            })),
        );
      }

      if (scopes.has('channels:publish:audio')) {
        server.registerTool(
          'whatsapp_publish_channel_audio',
          {
            description: 'EXPERIMENTAL: publica áudio em canal/newsletter. asVoice solicita PTT/voz; o suporte final depende do WhatsApp para canais.',
            inputSchema: z.object({
              newsletterId: z.string().min(1),
              media: z.string().min(1),
              filename: z.string().min(1).max(180).optional(),
              mimetype: z.string().min(1).max(120).optional(),
              asVoice: z.boolean().optional(),
            }),
          },
          async (args: { newsletterId: string; media: string; filename?: string; mimetype?: string; asVoice?: boolean }) =>
            this.result(await publishChannelMedia(this.whatsapp, instanceId, args.newsletterId, {
              media: args.media,
              type: 'audio',
              filename: args.filename,
              mimetype: args.mimetype,
              asVoice: args.asVoice,
            })),
        );
      }

      if (scopes.has('channels:publish:video')) {
        server.registerTool(
          'whatsapp_publish_channel_video',
          {
            description: 'EXPERIMENTAL: publica vídeo em canal/newsletter com legenda opcional. media aceita URL pública, data URL ou Base64.',
            inputSchema: z.object({
              newsletterId: z.string().min(1),
              media: z.string().min(1),
              caption: z.string().max(4096).optional(),
              filename: z.string().min(1).max(180).optional(),
              mimetype: z.string().min(1).max(120).optional(),
            }),
          },
          async (args: { newsletterId: string; media: string; caption?: string; filename?: string; mimetype?: string }) =>
            this.result(await publishChannelMedia(this.whatsapp, instanceId, args.newsletterId, {
              media: args.media,
              type: 'video',
              caption: args.caption,
              filename: args.filename,
              mimetype: args.mimetype,
            })),
        );
      }

      if (scopes.has('channels:publish')) {
        server.registerTool(
          'whatsapp_publish_channel',
          {
            description: 'EXPERIMENTAL/LEGADO: publica texto em um canal usando o envio genérico. Prefira whatsapp_publish_channel_text quando disponível.',
            inputSchema: z.object({ channelId: z.string().min(1), text: z.string().min(1) }),
          },
          async ({ channelId, text }: { channelId: string; text: string }) => this.result(await this.whatsapp.publishChannel(instanceId, channelId, text)),
        );
      }

      if (scopes.has('status:publish')) {
        server.registerTool(
          'whatsapp_publish_status',
          {
            description: 'Publica um status/story de texto ou mídia neste número.',
            inputSchema: z.object({ text: z.string().optional(), media: z.string().optional(), caption: z.string().optional() }),
          },
          async (args: { text?: string; media?: string; caption?: string }) => this.result(await this.whatsapp.publishStatus(instanceId, args)),
        );
      }

      // Catálogo operacional por função. Somente métodos explicitamente
      // allowlisted aparecem, e apenas quando o token OAuth possui o scope.
      for (const capability of WPP_OPERATION_CAPABILITIES) {
        if (!scopes.has(capability.scope)) continue;
        const toolName = `whatsapp_wpp_${capability.method}`;
        const riskNotice = capability.risk === 'destructive'
          ? ' AÇÃO SENSÍVEL/DESTRUTIVA: confirme a intenção e os identificadores antes de executar.'
          : '';
        server.registerTool(
          toolName,
          {
            description: `${capability.description} Assinatura: ${capability.signature}.${riskNotice} Passe os parâmetros posicionais no array arguments exatamente na ordem da assinatura.`,
            inputSchema: z.object({ arguments: z.array(z.any()).max(20).optional() }),
          },
          async ({ arguments: args }: { arguments?: unknown[] }) =>
            this.result(await executeWppOperation(this.whatsapp, instanceId, capability.scope, args || [])),
        );
      }

      return server;
    });

    const nodeHandler = toNodeHandler(handler);
    await nodeHandler(req, res, req.body);
  }

  private async safeConnectionStatus(instanceId: string) {
    const value: any = await this.whatsapp.status(instanceId);
    return {
      id: value.id,
      name: value.name,
      purpose: value.purpose,
      phoneNumber: value.phoneNumber,
      provider: value.provider,
      status: value.status,
      active: value.active,
      connected: value.connected,
      lastConnectedAt: value.lastConnectedAt,
      lastSeenAt: value.lastSeenAt,
      runtimeDetail: value.runtimeDetail,
      capabilities: value.capabilities,
    };
  }

  private result(value: unknown) {
    return { content: [{ type: 'text' as const, text: this.safeStringify(value) }] };
  }

  private mediaResult(value: { message: unknown; mimeType: string; data: string }) {
    const content: any[] = [
      {
        type: 'text',
        text: this.safeStringify({ message: value.message, mimeType: value.mimeType }),
      },
    ];
    if (value.data && value.mimeType.startsWith('image/')) {
      content.push({ type: 'image', data: value.data, mimeType: value.mimeType });
    } else if (value.data && value.mimeType.startsWith('audio/')) {
      content.push({ type: 'audio', data: value.data, mimeType: value.mimeType });
    } else if (value.data) {
      content.push({ type: 'text', text: `Mídia localizada (${value.mimeType}), mas este tipo não é renderizado inline por este tool.` });
    }
    return { content };
  }

  private safeStringify(value: unknown) {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, nested) => {
      if (typeof nested === 'bigint') return nested.toString();
      if (Buffer.isBuffer(nested)) return { type: 'buffer', base64: nested.toString('base64') };
      if (nested && typeof nested === 'object') {
        if (seen.has(nested)) return '[circular]';
        seen.add(nested);
      }
      if (typeof nested === 'function') return undefined;
      return nested;
    }, 2);
  }
}
