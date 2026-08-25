import { All, Controller, Param, Req, Res, UseGuards } from '@nestjs/common';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WhatsAppApiKeyGuard } from './whatsapp-key.guard';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp/mcp/:instanceId')
@UseGuards(WhatsAppApiKeyGuard)
export class WhatsAppMcpController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @All()
  async handle(@Param('instanceId') instanceId: string, @Req() req: any, @Res() res: any) {
    const [{ createMcpHandler, McpServer }, { toNodeHandler }, z] = await Promise.all([
      import('@modelcontextprotocol/server'),
      import('@modelcontextprotocol/node'),
      import('zod/v4'),
    ]);
    const key = req.whatsappApiKey as WhatsAppApiKey;
    const scopes = new Set(key.scopes);

    const handler = createMcpHandler(() => {
      const server = new McpServer({
        name: `PiraNegocios WhatsApp - ${instanceId}`,
        version: '1.0.0',
      });

      if (scopes.has('connection:read')) {
        server.registerTool(
          'whatsapp_connection_status',
          { description: 'Consulta o estado da conexão deste número do WhatsApp.', inputSchema: z.object({}) },
          async () => this.result(await this.whatsapp.status(instanceId)),
        );
      }
      if (scopes.has('messages:read')) {
        server.registerTool(
          'whatsapp_list_messages',
          {
            description: 'Lista mensagens recentes recebidas e enviadas por este número.',
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
          { description: 'Lista grupos visíveis para este número.', inputSchema: z.object({}) },
          async () => this.result(await this.whatsapp.listGroups(instanceId)),
        );
      }
      if (scopes.has('groups:send')) {
        server.registerTool(
          'whatsapp_send_group_message',
          {
            description: 'Envia texto para um grupo usando o ID ...@g.us.',
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

  private result(value: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
  }
}
