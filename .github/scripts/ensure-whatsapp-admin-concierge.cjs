const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

const file = 'backend/src/whatsapp/whatsapp-concierge.service.ts';
let source = fs.readFileSync(file, 'utf8');

if (source.includes('private async adminDirectReadReply(') && source.includes("AI_ASSISTANT_NAME")) {
  console.log('WhatsApp admin concierge reliability patch already applied.');
  process.exit(0);
}

const original = source;

function mustReplace(needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`WhatsApp admin patch missing ${label || needle.slice(0, 100)}`);
  }
  source = source.replace(needle, replacement);
}

if (!source.includes("import { SettingsService } from '../admin/settings.service';")) {
  mustReplace(
    "import { InjectRepository } from '@nestjs/typeorm';",
    "import { InjectRepository } from '@nestjs/typeorm';\nimport { SettingsService } from '../admin/settings.service';",
    'SettingsService import',
  );
}

if (!source.includes('private readonly settings: SettingsService')) {
  mustReplace(
    '    private readonly ai: WhatsAppAiService,\n    private readonly alerts: WhatsAppAlertService,\n  ) {}',
    '    private readonly ai: WhatsAppAiService,\n    private readonly alerts: WhatsAppAlertService,\n    private readonly settings: SettingsService,\n  ) {}',
    'SettingsService constructor injection',
  );
}

if (!source.includes('const directAdminReply = await this.adminDirectReadReply')) {
  mustReplace(
    "      const availableContext = await this.contextSnapshot(resolved.user, resolved.company, conversation.contextMode);\n      const decision = await this.ai.decide({",
    "      const availableContext = await this.contextSnapshot(resolved.user, resolved.company, conversation.contextMode);\n\n      if (conversation.contextMode === 'ADMIN') {\n        const directAdminReply = await this.adminDirectReadReply(requestText, availableContext);\n        if (directAdminReply) {\n          await this.sendText(buffer, await this.formatAdminReply(buffer, directAdminReply));\n          return;\n        }\n      }\n\n      const decision = await this.ai.decide({",
    'direct admin operational response hook',
  );
}

source = source.replace(
  "const outgoing = conversation.contextMode === 'ADMIN' ? this.formatAdminReply(buffer, reply) : reply;",
  "const outgoing = conversation.contextMode === 'ADMIN' ? await this.formatAdminReply(buffer, reply) : reply;",
);

source = source.replace(
  "return { reply: decision.reply || `${firstName}, identifiquei você como administrador. Posso usar o panorama operacional carregado nesta conversa para responder consultas administrativas de leitura.` };",
  "return { reply: decision.reply || `${firstName}, não consegui interpretar essa consulta administrativa com segurança. Tente pedir um dado objetivo, como novos cadastros, vagas ativas, novas vagas ou candidaturas recentes.` };",
);

const methods = `  private normalizeAdminQuery(value: string) {\n    return String(value || '')\n      .normalize('NFD')\n      .replace(/[\\u0300-\\u036f]/g, '')\n      .toLowerCase()\n      .replace(/\\s+/g, ' ')\n      .trim();\n  }\n\n  private adminWindow(query: string) {\n    const now = new Date();\n    if (/\\bhoje\\b/.test(query)) {\n      const parts = new Intl.DateTimeFormat('en-US', {\n        timeZone: 'America/Sao_Paulo',\n        year: 'numeric',\n        month: '2-digit',\n        day: '2-digit',\n      }).formatToParts(now);\n      const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));\n      return {\n        since: new Date(\\`${'${value.year}'}-${'${value.month}'}-${'${value.day}'}T00:00:00-03:00\\`),\n        label: 'hoje',\n      };\n    }\n    if (/\\b(7 dias|ultima semana|ultimos 7 dias|semana)\\b/.test(query)) {\n      return { since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), label: 'nos últimos 7 dias' };\n    }\n    if (/\\b(30 dias|ultimo mes|ultimos 30 dias|mes)\\b/.test(query)) {\n      return { since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), label: 'nos últimos 30 dias' };\n    }\n    return { since: new Date(now.getTime() - 24 * 60 * 60 * 1000), label: 'nas últimas 24 horas' };\n  }\n\n  private formatAdminDate(value: unknown) {\n    if (!value) return '';\n    const date = value instanceof Date ? value : new Date(String(value));\n    if (Number.isNaN(date.getTime())) return '';\n    return new Intl.DateTimeFormat('pt-BR', {\n      timeZone: 'America/Sao_Paulo',\n      day: '2-digit',\n      month: '2-digit',\n      hour: '2-digit',\n      minute: '2-digit',\n    }).format(date);\n  }\n\n  private async adminDirectReadReply(\n    requestText: string,\n    availableContext: Record<string, unknown>,\n  ): Promise<string | null> {\n    const query = this.normalizeAdminQuery(requestText);\n    if (!query) return null;\n\n    const registrationIntent =\n      /\\b(cadastro|cadastros|cadastrado|cadastrados|registro|registros)\\b/.test(query) ||\n      /\\b(nov[oa]s?|recentes?)\\b.*\\b(usuarios?|empresas?|contas?)\\b/.test(query);\n    if (registrationIntent) return this.adminRegistrationReply(query);\n\n    const totals = (availableContext?.platformTotals || {}) as Record<string, unknown>;\n    const asksJobStatus = /\\bvagas?\\b/.test(query) && /\\b(ativas?|inativas?|desativadas?)\\b/.test(query);\n    if (asksJobStatus) {\n      return \\`No sistema há ${'${Number(totals.activeJobs || 0)}'} vagas ativas e ${'${Number(totals.inactiveJobs || 0)}'} vagas inativas. Total: ${'${Number(totals.jobs || 0)}'} vagas.\\`;\n    }\n\n    const asksTotals = /\\b(quantos?|quantas?|total|panorama|resumo)\\b/.test(query) &&\n      /\\b(usuarios?|empresas?|vagas?|candidaturas?)\\b/.test(query);\n    if (asksTotals) {\n      return \\`Panorama atual: ${'${Number(totals.users || 0)}'} usuários, ${'${Number(totals.companies || 0)}'} empresas, ${'${Number(totals.jobs || 0)}'} vagas (${ '${Number(totals.activeJobs || 0)}' } ativas) e ${'${Number(totals.applications || 0)}'} candidaturas.\\`;\n    }\n\n    const recentJobIntent = /\\bvagas?\\b/.test(query) && /\\b(nov[oa]s?|recentes?|hoje|24h|semana)\\b/.test(query);\n    if (recentJobIntent) return this.adminRecentJobsReply(query);\n\n    const recentApplicationIntent = /\\b(candidaturas?|inscricoes?|aplicacoes?)\\b/.test(query) && /\\b(nov[oa]s?|recentes?|hoje|24h|semana)\\b/.test(query);\n    if (recentApplicationIntent) return this.adminRecentApplicationsReply(query);\n\n    return null;\n  }\n\n  private async adminRegistrationReply(query: string) {\n    const { since, label } = this.adminWindow(query);\n    const mentionsUsers = /\\b(usuarios?|pessoas?|candidatos?|contas?)\\b/.test(query);\n    const mentionsCompanies = /\\b(empresas?|negocios?|estabelecimentos?)\\b/.test(query);\n    const includeUsers = mentionsUsers || !mentionsCompanies;\n    const includeCompanies = mentionsCompanies || !mentionsUsers;\n\n    const userBase = () =>\n      this.users\n        .createQueryBuilder('user')\n        .where('user.\\"createdAt\\" >= :since', { since })\n        .andWhere('user.type <> :adminType', { adminType: UserType.ADMIN });\n    const companyBase = () =>\n      this.companies\n        .createQueryBuilder('company')\n        .where('company.\\"createdAt\\" >= :since', { since });\n\n    const [userCount, companyCount, users, companies] = await Promise.all([\n      includeUsers ? userBase().getCount() : Promise.resolve(0),\n      includeCompanies ? companyBase().getCount() : Promise.resolve(0),\n      includeUsers\n        ? userBase().orderBy('user.\\"createdAt\\"', 'DESC').take(8).getMany()\n        : Promise.resolve([] as User[]),\n      includeCompanies\n        ? companyBase().orderBy('company.\\"createdAt\\"', 'DESC').take(8).getMany()\n        : Promise.resolve([] as Company[]),\n    ]);\n\n    const total = userCount + companyCount;\n    if (!total) {\n      const subject = includeUsers && includeCompanies\n        ? 'cadastros de usuários ou empresas'\n        : includeUsers\n          ? 'cadastros de usuários'\n          : 'cadastros de empresas';\n      return \\`Não houve novos ${'${subject}'} ${'${label}'}.\\`;\n    }\n\n    const lines = [\n      \\`Sim. ${'${label.charAt(0).toUpperCase() + label.slice(1)}'} houve ${'${total}'} novo${'${total === 1 ? "" : "s"}'} cadastro${'${total === 1 ? "" : "s"}'}: ${'${userCount}'} usuário${'${userCount === 1 ? "" : "s"}'} e ${'${companyCount}'} empresa${'${companyCount === 1 ? "" : "s"}'}.\\`,\n    ];\n\n    if (users.length) {\n      lines.push(\n        'Usuários: ' +\n          users\n            .map((item) => {\n              const name = String(item.socialName || item.fullName || item.displayName || item.email || 'Usuário').trim();\n              const place = [item.city, item.state].filter(Boolean).join('/');\n              const when = this.formatAdminDate(item.createdAt);\n              return [name, place, when].filter(Boolean).join(' · ');\n            })\n            .join('; '),\n      );\n    }\n\n    if (companies.length) {\n      lines.push(\n        'Empresas: ' +\n          companies\n            .map((item) => {\n              const place = [item.city, item.state].filter(Boolean).join('/');\n              const when = this.formatAdminDate(item.createdAt);\n              return [item.name, place, when].filter(Boolean).join(' · ');\n            })\n            .join('; '),\n      );\n    }\n\n    return lines.join('\\n');\n  }\n\n  private async adminRecentJobsReply(query: string) {\n    const { since, label } = this.adminWindow(query);\n    const base = () => this.jobs.createQueryBuilder('job').where('job.\\"createdAt\\" >= :since', { since });\n    const [count, jobs] = await Promise.all([\n      base().getCount(),\n      base().orderBy('job.\\"createdAt\\"', 'DESC').take(10).getMany(),\n    ]);\n    if (!count) return \\`Não houve novas vagas ${'${label}'}.\\`;\n    const details = jobs.map((job) => {\n      const place = [job.city, job.state].filter(Boolean).join('/');\n      return [job.title, job.companyName, place, this.formatAdminDate(job.createdAt)].filter(Boolean).join(' · ');\n    });\n    return \\`Foram cadastradas ${'${count}'} nova${'${count === 1 ? "" : "s"}'} vaga${'${count === 1 ? "" : "s"}'} ${'${label}'}.\\n${'${details.join("; ")}' }\\`;\n  }\n\n  private async adminRecentApplicationsReply(query: string) {\n    const { since, label } = this.adminWindow(query);\n    const base = () => this.applications.createQueryBuilder('application').where('application.\\"createdAt\\" >= :since', { since });\n    const [count, applications] = await Promise.all([\n      base().getCount(),\n      base().orderBy('application.\\"createdAt\\"', 'DESC').take(10).getMany(),\n    ]);\n    if (!count) return \\`Não houve novas candidaturas ${'${label}'}.\\`;\n    const details = applications.map((item) =>\n      [item.jobTitle, item.companyName, item.status, this.formatAdminDate(item.createdAt)].filter(Boolean).join(' · '),\n    );\n    return \\`Foram registradas ${'${count}'} nova${'${count === 1 ? "" : "s"}'} candidatura${'${count === 1 ? "" : "s"}'} ${'${label}'}.\\n${'${details.join("; ")}' }\\`;\n  }\n\n`;

if (!source.includes('private async adminDirectReadReply(')) {
  mustReplace(
    '  private async collectResumeDocuments(buffer: BufferState): Promise<ResumeSourceDocumentInput[]> {',
    `${methods}  private async collectResumeDocuments(buffer: BufferState): Promise<ResumeSourceDocumentInput[]> {`,
    'admin direct reply methods insertion point',
  );
}

if (!source.includes("await this.settings.getValue('AI_ASSISTANT_NAME'")) {
  const oldMethod = `  private formatAdminReply(buffer: BufferState, text: string) {\n    const clean = String(text || '').trim();\n    if (!clean || clean.startsWith('🤖 *')) return clean;\n    const name = String(buffer.instance.name || 'PiraNegócios').trim() || 'PiraNegócios';\n    return \\`🤖 *${'${name}'}*:\\n${'${clean}'}\\`;\n  }`;
  const newMethod = `  private async formatAdminReply(_buffer: BufferState, text: string) {\n    const clean = String(text || '').trim();\n    if (!clean || clean.startsWith('🤖 *')) return clean;\n    const configuredName = String(\n      (await this.settings.getValue('AI_ASSISTANT_NAME', '')) || '',\n    ).trim();\n    const name = configuredName || 'PiraNegócios';\n    return \\`🤖 *${'${name}'}*:\\n${'${clean}'}\\`;\n  }`;
  mustReplace(oldMethod, newMethod, 'admin reply formatter');
}

if (source === original) {
  console.log('WhatsApp admin concierge reliability patch already applied.');
  process.exit(0);
}

fs.writeFileSync(file, source);
console.log('WhatsApp admin concierge reliability patch applied.');
