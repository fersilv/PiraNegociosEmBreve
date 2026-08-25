import { All, Controller, Param, Req, Res, UseGuards } from '@nestjs/common';
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
        version: '1.1.0',
      });

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
            description: 'Busca diretamente no WhatsApp o histórico de um grupo. Use paginação com beforeMessageId para percorrer mensagens antigas sem depender apenas do histórico salvo no PiraNegócios.',
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
            description: 'Baixa a mídia original de uma mensagem do WhatsApp pelo messageId. Imagens são devolvidas como conteúdo visual para análise.',
            inputSchema: z.object({ messageId: z.string().min(1) }),
          },
          async ({ messageId }: { messageId: string }) => this.mediaResult(await this.whatsapp.getGroupMedia(instanceId, messageId)),
        );
      }

      if (scopes.has('groups:members:read')) {
        server.registerTool(
          'whatsapp_list_group_members',
          {
            description: 'Lista os participantes atuais de um grupo, permitindo identificar membros, administradores e dados disponíveis dos contatos.',
            inputSchema: z.object({ groupId: z.string().min(1) }),
          },
          async ({ groupId }: { groupId: string }) => this.result(await this.whatsapp.listGroupMembers(instanceId, groupId)),
        );
      }

      if (scopes.has('groups:join')) {
        server.registerTool(
          'whatsapp_join_group',
          {
            description: 'Entra em um grupo usando um link ou código de convite do WhatsApp. Não envia mensagens no grupo.',
            inputSchema: z.object({ inviteCodeOrLink: z.string().min(1) }),
          },
          async ({ inviteCodeOrLink }: { inviteCodeOrLink: string }) => this.result(await this.whatsapp.joinGroup(instanceId, inviteCodeOrLink)),
        );
      }

      if (scopes.has('groups:members:add')) {
        server.registerTool(
          'whatsapp_add_group_member',
          {
            description: 'Adiciona uma pessoa a um grupo administrado por este número. Exige permissões de administrador no próprio WhatsApp.',
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
            description: 'Remove um participante de um grupo administrado por este número. Use somente quando houver motivo de moderação claro e verificável.',
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
            description: 'Lista pedidos pendentes de entrada em um grupo que usa aprovação de participantes.',
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
            description: 'Envia texto para um grupo usando o ID ...@g.us. Esta permissão é independente das permissões de leitura e moderação.',
            inputSchema: z.object({ groupId: z.string().min(1), text: z.string().min(1) }),
          },
          async ({ groupId, text }: { groupId: string; text: string }) => this.result(await this.whatsapp.sendText(instanceId, groupId, text)),
        );
      }

      if (scopes.has('channels:read')) {
        server.registerTool(
          'whatsapp_list_channels',
          { description: 'Lista canais/newsletters visíveis para esta sessão quando o WhatsApp Web disponibilizar a função.', inputSchema: z.object({}) },
          async () => this.result(await this.whatsapp.listChannels(instanceId)),
        );
      }

      if (scopes.has('channels:publish')) {
        server.registerTool(
          'whatsapp_publish_channel',
          {
            description: 'EXPERIMENTAL: publica texto em um canal administrado pelo número. O suporte depende da versão corrente do WhatsApp Web.',
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
    return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
  }

  private mediaResult(value: { message: unknown; mimeType: string; data: string }) {
    const content: any[] = [
      {
        type: 'text',
        text: JSON.stringify({ message: value.message, mimeType: value.mimeType }, null, 2),
      },
    ];
    if (value.data && value.mimeType.startsWith('image/')) {
      content.push({ type: 'image', data: value.data, mimeType: value.mimeType });
    } else if (value.data && value.mimeType.startsWith('audio/')) {
      content.push({ type: 'audio', data: value.data, mimeType: value.mimeType });
    } else if (value.data) {
      content.push({
        type: 'text',
        text: `A mídia foi localizada (${value.mimeType}), mas este tipo não é renderizado inline por este tool.`,
      });
    }
    return { content };
  }
}
