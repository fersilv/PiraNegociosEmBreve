const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, source) {
  fs.writeFileSync(file, source);
  console.log(`updated ${file}`);
}

function replaceOrThrow(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Company plans patch missing ${label || needle.slice(0, 100)}`);
  }
  return source.replace(needle, replacement);
}

function patchWhatsappAi() {
  const file = 'backend/src/whatsapp/whatsapp-ai.service.ts';
  let source = read(file);
  if (source.includes('COMPANY_PLAN_STATUS') && source.includes('CONFIRM_CANDIDATE_MESSAGE')) {
    return;
  }

  source = replaceOrThrow(
    source,
    'INTENTS DE EMPRESA:\\nLIST_COMPANY_JOBS, JOB_APPLICATION_COUNTS, JOB_MATCH_CANDIDATES, START_JOB_CREATE, CONTINUE_JOB_CREATE, CONFIRM_JOB_CREATE, START_JOB_EDIT, CONTINUE_JOB_EDIT, CONFIRM_JOB_EDIT, CANCEL_FLOW.',
    'INTENTS DE EMPRESA:\\nLIST_COMPANY_JOBS, JOB_APPLICATION_COUNTS, JOB_MATCH_CANDIDATES, COMPANY_PLAN_STATUS, JOB_ACTIVATE, JOB_DEACTIVATE, JOB_CLOSE, LIST_JOB_CANDIDATES, GET_CANDIDATE_PROFILE, UPDATE_APPLICATION_STATUS, ADD_APPLICATION_NOTE, INVITE_CANDIDATE, LIST_CANDIDATE_INVITES, CANCEL_CANDIDATE_INVITE, LIST_TALENT_FOLDERS, ADD_TALENT, REMOVE_TALENT, ADD_TALENT_NOTE, MESSAGE_CANDIDATE, CONFIRM_CANDIDATE_MESSAGE, CONFIRM_COMPANY_ACTION, RECENT_APPLICATIONS, JOB_STATS, START_JOB_CREATE, CONTINUE_JOB_CREATE, CONFIRM_JOB_CREATE, START_JOB_EDIT, CONTINUE_JOB_EDIT, CONFIRM_JOB_EDIT, CANCEL_FLOW.',
    'company intent catalog',
  );

  const rules = `\nREGRAS DE RECURSOS EMPRESARIAIS:\n- COMPANY_PLAN_STATUS quando a empresa perguntar qual plano possui, preço, recursos ou upgrade.\n- JOB_ACTIVATE, JOB_DEACTIVATE e JOB_CLOSE exigem args.jobId. Se o contexto permitir identificar inequivocamente a vaga pelo título, use o id real. Nunca invente UUID.\n- LIST_JOB_CANDIDATES exige args.jobId.\n- GET_CANDIDATE_PROFILE exige args.candidateId.\n- UPDATE_APPLICATION_STATUS exige args.applicationId e args.status. Status aceitos: PENDING, REVIEWING, DOCUMENTS_REQUESTED, DOCUMENTS_SUBMITTED, HIRED, REJECTED, WITHDRAWN.\n- ADD_APPLICATION_NOTE exige args.applicationId e args.note.\n- INVITE_CANDIDATE exige args.candidateId e args.jobId.\n- CANCEL_CANDIDATE_INVITE exige args.inviteId. LIST_CANDIDATE_INVITES lista os convites existentes.\n- LIST_TALENT_FOLDERS lista pastas. ADD_TALENT exige args.candidateId e pode usar args.folderIds/args.jobIds. REMOVE_TALENT exige args.candidateId e opcional args.folderId. ADD_TALENT_NOTE exige args.candidateId e args.note.\n- RECENT_APPLICATIONS usa args.window com hoje, ontem, 24h ou 7d quando o período estiver claro.\n- JOB_STATS usa args.jobId quando a pergunta for sobre uma vaga; sem jobId, retorna panorama das vagas da empresa.\n- MESSAGE_CANDIDATE exige args.candidateId e args.message. Nunca marque como CONFIRM_CANDIDATE_MESSAGE na primeira solicitação: o backend mostra uma prévia e pede confirmação.\n- CONFIRM_CANDIDATE_MESSAGE apenas quando houver fluxo ativo de mensagem e a pessoa confirmar explicitamente ENVIAR, CONFIRMO ou PODE ENVIAR.\n- CONFIRM_COMPANY_ACTION apenas quando houver fluxo ativo de ação empresarial destrutiva e confirmação explícita.\n- Não suponha que um recurso esteja liberado pelo plano. O backend verifica a assinatura e responderá com upgrade quando necessário.\n- Para qualquer ação que exija um id e não possa ser identificada inequivocamente pelos dados reais do contexto, responda pedindo qual vaga/candidato/candidatura deve ser usado; não invente args.\n`;

  source = replaceOrThrow(
    source,
    '\\nREGRAS DO FLUXO DE VAGA:',
    `${rules}\\nREGRAS DO FLUXO DE VAGA:`,
    'company premium rules insertion',
  );
  write(file, source);
}

function patchConcierge() {
  const file = 'backend/src/whatsapp/whatsapp-concierge.service.ts';
  let source = read(file);
  if (source.includes('private async handleCompanyPremiumDecision(') && source.includes('CompanyWhatsAppPremiumService')) {
    return;
  }

  if (!source.includes("import { CompanyPlansService } from '../company-plans/company-plans.service';")) {
    source = replaceOrThrow(
      source,
      "import { Company } from '../companies/entities/company.entity';",
      "import { Company } from '../companies/entities/company.entity';\nimport { CompanyPlansService } from '../company-plans/company-plans.service';\nimport { CompanyWhatsAppPremiumService } from '../company-plans/company-whatsapp-premium.service';",
      'company plan imports',
    );
  }

  if (!source.includes('private readonly companyPlans: CompanyPlansService')) {
    source = replaceOrThrow(
      source,
      '    private readonly alerts: WhatsAppAlertService,',
      '    private readonly alerts: WhatsAppAlertService,\n    private readonly companyPlans: CompanyPlansService,\n    private readonly companyPremium: CompanyWhatsAppPremiumService,',
      'company plan dependency injection',
    );
  }

  if (!source.includes('this.isCompanyPlanRequired(error)')) {
    source = replaceOrThrow(
      source,
      '    } catch (error) {\n      if (this.isPaymentRequired(error)) {',
      `    } catch (error) {\n      if (this.isCompanyPlanRequired(error)) {\n        const payload = this.companyPlanPayload(error);\n        const requiredPlan = String(payload?.requiredPlan || 'Plus');\n        const currentPlan = String(payload?.currentPlan || 'Free');\n        await this.sendText(\n          buffer,\n          \`Esse recurso faz parte do plano \${requiredPlan}. Sua empresa está no \${currentPlan}. Para liberar: https://piranegocios.com.br/company/planos\`,\n        ).catch(() => undefined);\n        return;\n      }\n      if (this.isPaymentRequired(error)) {`,
      'company plan forbidden handler',
    );
  }

  const companyHook = `      const premiumResult = await this.handleCompanyPremiumDecision({\n        buffer,\n        conversation,\n        user,\n        company,\n        decision,\n        requestText,\n      });\n      if (premiumResult) return premiumResult;\n`;
  if (!source.includes('const premiumResult = await this.handleCompanyPremiumDecision')) {
    source = replaceOrThrow(
      source,
      "      if (!company) return { reply: 'Não consegui localizar a empresa vinculada a esta conta.' };\n      const companyJobs = await this.jobs.find({ where: { companyId: company.id }, order: { createdAt: 'DESC' } });",
      `      if (!company) return { reply: 'Não consegui localizar a empresa vinculada a esta conta.' };\n${companyHook}      const companyJobs = await this.jobs.find({ where: { companyId: company.id }, order: { createdAt: 'DESC' } });`,
      'company premium decision hook',
    );
  }

  if (!source.includes('companyPlan: await this.companyPlans.getCompanyPlan(company.id)')) {
    source = replaceOrThrow(
      source,
      '      return {\n        user: userProfile,\n        company: {',
      '      return {\n        user: userProfile,\n        companyPlan: await this.companyPlans.getCompanyPlan(company.id),\n        company: {',
      'company plan context snapshot',
    );
  }

  const methods = `  private async handleCompanyPremiumDecision(input: {\n    buffer: BufferState;\n    conversation: WhatsAppConversation;\n    user: User;\n    company: Company;\n    decision: any;\n    requestText: string;\n  }): Promise<{ handled?: boolean; reply?: string } | null> {\n    const { buffer, conversation, user, company, decision, requestText } = input;\n    const intent = String(decision.intent || '').toUpperCase();\n    const args = decision.args && typeof decision.args === 'object' ? decision.args : {};\n    const actor = {\n      id: user.id,\n      name: String(user.socialName || user.displayName || user.fullName || user.email || 'Empresa'),\n    };\n\n    if (conversation.activeFlow === 'COMPANY_ACTION_CONFIRM') {\n      const pending = (conversation.state as any)?.pendingCompanyAction;\n      const confirmed = intent === 'CONFIRM_COMPANY_ACTION' || /^\\s*(CONFIRMO|PODE|PODE FAZER|SIM|CONFIRMAR)\\s*[.!]?\\s*$/i.test(requestText);\n      if (!confirmed) {\n        return { reply: 'A ação ainda não foi executada. Responda CONFIRMO para continuar ou CANCELAR para desistir.' };\n      }\n      if (!pending?.jobId || !['DEACTIVATE', 'CLOSE'].includes(String(pending.action))) {\n        conversation.activeFlow = null;\n        conversation.state = {};\n        await this.conversations.save(conversation);\n        return { reply: 'A confirmação anterior expirou. Faça o pedido novamente.' };\n      }\n      const result = await this.companyPremium.setJobState(company.id, String(pending.jobId), pending.action);\n      conversation.activeFlow = null;\n      conversation.state = {};\n      await this.conversations.save(conversation);\n      return { reply: pending.action === 'CLOSE' ? \`Vaga encerrada: \${result.title}.\` : \`Vaga desativada: \${result.title}.\` };\n    }\n\n    if (conversation.activeFlow === 'CANDIDATE_MESSAGE') {\n      const pending = (conversation.state as any)?.pendingCandidateMessage;\n      const confirmed = intent === 'CONFIRM_CANDIDATE_MESSAGE' || /^\\s*(ENVIAR|CONFIRMO|PODE ENVIAR|SIM,? ENVIAR)\\s*[.!]?\\s*$/i.test(requestText);\n      if (!confirmed) {\n        return { reply: 'A mensagem ainda não foi enviada. Responda ENVIAR para confirmar ou CANCELAR para desistir.' };\n      }\n      if (!pending?.chatId || !pending?.message) {\n        conversation.activeFlow = null;\n        conversation.state = {};\n        await this.conversations.save(conversation);\n        return { reply: 'A prévia da mensagem expirou. Faça o pedido novamente.' };\n      }\n      await this.companyPlans.assertFeature(company.id, 'CANDIDATE_WHATSAPP');\n      await buffer.client.sendText(String(pending.chatId), String(pending.message));\n      conversation.activeFlow = null;\n      conversation.state = {};\n      await this.conversations.save(conversation);\n      return { reply: \`Mensagem enviada para \${String(pending.candidateName || 'o candidato')}.\` };\n    }\n\n    if (intent === 'COMPANY_PLAN_STATUS') {\n      const current = await this.companyPlans.getCompanyPlan(company.id);\n      const label = current.plan === 'FREE' ? 'Free' : current.plan === 'PLUS' ? 'Plus' : 'Elite';\n      return { reply: \`A \${company.name} está no plano \${label}.\${current.currentPeriodEnd ? \` Vigente até \${new Date(current.currentPeriodEnd).toLocaleDateString('pt-BR')}.\` : ''} Você pode comparar os planos em https://piranegocios.com.br/company/planos\` };\n    }\n\n    if (intent === 'JOB_ACTIVATE') {\n      const jobId = await this.resolveCompanyJobId(company.id, args, requestText);\n      if (!jobId) return { reply: await this.companyJobChoiceReply(company.id, 'ativar') };\n      const result = await this.companyPremium.setJobState(company.id, jobId, 'ACTIVATE');\n      return { reply: \`Vaga ativada: \${result.title}.\` };\n    }\n\n    if (intent === 'JOB_DEACTIVATE' || intent === 'JOB_CLOSE') {\n      const jobId = await this.resolveCompanyJobId(company.id, args, requestText);\n      if (!jobId) return { reply: await this.companyJobChoiceReply(company.id, intent === 'JOB_CLOSE' ? 'encerrar' : 'desativar') };\n      await this.companyPlans.assertFeature(company.id, intent === 'JOB_CLOSE' ? 'JOB_CLOSE' : 'JOB_DEACTIVATE');\n      const job = await this.jobs.findOne({ where: { id: jobId, companyId: company.id } });\n      if (!job) return { reply: 'Não encontrei essa vaga na empresa.' };\n      conversation.activeFlow = 'COMPANY_ACTION_CONFIRM';\n      conversation.state = { ...(conversation.state || {}), pendingCompanyAction: { jobId, action: intent === 'JOB_CLOSE' ? 'CLOSE' : 'DEACTIVATE' } };\n      await this.conversations.save(conversation);\n      return { reply: intent === 'JOB_CLOSE'\n        ? \`Você quer ENCERRAR a vaga \"\${job.title}\"? Isso desativa a vaga e encerra o prazo. Responda CONFIRMO ou CANCELAR.\`\n        : \`Você quer DESATIVAR a vaga \"\${job.title}\"? Responda CONFIRMO ou CANCELAR.\` };\n    }\n\n    if (intent === 'LIST_JOB_CANDIDATES') {\n      const jobId = await this.resolveCompanyJobId(company.id, args, requestText);\n      if (!jobId) return { reply: await this.companyJobChoiceReply(company.id, 'listar os candidatos de') };\n      const result = await this.companyPremium.listCandidates(company.id, jobId);\n      if (!result.count) return { reply: \`A vaga \"\${result.job.title}\" ainda não possui candidaturas.\` };\n      const lines = result.candidates.map((item: any, index: number) =>\n        \`\${index + 1}. \${item.name || 'Candidato'} · \${item.status} · \${[item.city, item.state].filter(Boolean).join('/') || 'local não informado'} · candidato \${item.candidateId} · candidatura \${item.applicationId}\`,\n      );\n      return { reply: \`\${result.count} candidatura(s) em \"\${result.job.title}\":\\n\${lines.join('\\n')}\` };\n    }\n\n    if (intent === 'GET_CANDIDATE_PROFILE') {\n      const candidateId = String(args.candidateId || '').trim();\n      if (!candidateId) return { reply: 'Qual candidato você quer abrir? Peça a lista de candidatos da vaga para eu mostrar os IDs disponíveis.' };\n      const result = await this.companyPremium.candidateProfile(company.id, candidateId);\n      const c: any = result.candidate;\n      const summary = [\n        c.name,\n        [c.city, c.state].filter(Boolean).join('/'),\n        c.phone,\n        c.email,\n        Array.isArray(c.skills) && c.skills.length ? \`Habilidades: \${c.skills.slice(0, 12).join(', ')}\` : '',\n        c.bio ? \`Resumo: \${String(c.bio).slice(0, 900)}\` : '',\n        Array.isArray(c.experiences) && c.experiences.length ? \`Experiências: \${c.experiences.slice(0, 6).map((e: any) => [e.role, e.company].filter(Boolean).join(' @ ')).join('; ')}\` : '',\n        c.linkedinURL ? \`LinkedIn: \${c.linkedinURL}\` : '',\n      ].filter(Boolean);\n      if (c.resumeURL && /^https?:\\/\\//i.test(String(c.resumeURL))) {\n        summary.push(\`Currículo: \${c.resumeURL}\`);\n      }\n      return { reply: summary.join('\\n') };\n    }\n\n    if (intent === 'UPDATE_APPLICATION_STATUS') {\n      const applicationId = String(args.applicationId || '').trim();\n      const status = String(args.status || '').trim();\n      if (!applicationId || !status) return { reply: 'Informe qual candidatura e o novo status. Você pode pedir a lista de candidatos da vaga para ver os IDs.' };\n      const result = await this.companyPremium.updateApplicationStatus(company.id, applicationId, status, actor);\n      return { reply: \`Status atualizado para \${result.status} na candidatura \${result.id}.\` };\n    }\n\n    if (intent === 'ADD_APPLICATION_NOTE') {\n      const applicationId = String(args.applicationId || '').trim();\n      const note = String(args.note || '').trim();\n      if (!applicationId || !note) return { reply: 'Diga em qual candidatura deseja registrar a observação e qual é o texto.' };\n      await this.companyPremium.addApplicationNote(company.id, applicationId, note, actor);\n      return { reply: 'Observação interna registrada com seu nome e horário.' };\n    }\n\n    if (intent === 'INVITE_CANDIDATE') {\n      const candidateId = String(args.candidateId || '').trim();\n      const jobId = await this.resolveCompanyJobId(company.id, args, requestText);\n      if (!candidateId || !jobId) return { reply: 'Para enviar o convite, preciso identificar o candidato e a vaga. Peça a lista de candidatos/vagas se precisar dos IDs.' };\n      const result = await this.companyPremium.inviteCandidate(company, jobId, candidateId, user.id);\n      return { reply: \`Convite criado para \${result.candidateName} na vaga \"\${result.jobTitle}\". Status: \${result.status}.\` };\n    }\n\n    if (intent === 'LIST_CANDIDATE_INVITES') {\n      const invites: any[] = await this.companyPremium.listInvites(company.id);\n      if (!invites.length) return { reply: 'A empresa ainda não possui convites de vagas.' };\n      return { reply: invites.slice(0, 20).map((invite, index) =>\n        \`\${index + 1}. \${invite.candidateName || invite.candidateEmail || 'Candidato'} · \${invite.jobTitle} · \${invite.status} · convite \${invite.id}\`,\n      ).join('\\n') };\n    }\n\n    if (intent === 'CANCEL_CANDIDATE_INVITE') {\n      const inviteId = String(args.inviteId || '').trim();\n      if (!inviteId) return { reply: 'Qual convite deseja remover? Peça a lista de convites para eu mostrar os IDs.' };\n      await this.companyPremium.cancelInvite(company.id, inviteId);\n      return { reply: 'Convite pendente removido.' };\n    }\n\n    if (intent === 'LIST_TALENT_FOLDERS') {\n      const folders = await this.companyPremium.listTalentFolders(company.id);\n      return { reply: folders.length\n        ? \`Pastas do Banco de Talentos:\\n\${folders.map((folder, index) => \`\${index + 1}. \${folder.name} · \${folder.id}\`).join('\\n')}\`\n        : 'A empresa ainda não possui pastas no Banco de Talentos.' };\n    }\n\n    if (intent === 'ADD_TALENT') {\n      const candidateId = String(args.candidateId || '').trim();\n      if (!candidateId) return { reply: 'Qual candidato deseja salvar no Banco de Talentos?' };\n      await this.companyPremium.saveTalent(\n        company.id,\n        candidateId,\n        Array.isArray(args.folderIds) ? args.folderIds.map(String) : undefined,\n        Array.isArray(args.jobIds) ? args.jobIds.map(String) : undefined,\n      );\n      return { reply: 'Candidato salvo/atualizado no Banco de Talentos.' };\n    }\n\n    if (intent === 'REMOVE_TALENT') {\n      const candidateId = String(args.candidateId || '').trim();\n      const folderId = String(args.folderId || '').trim() || undefined;\n      if (!candidateId) return { reply: 'Qual candidato deseja remover do Banco de Talentos?' };\n      await this.companyPremium.removeTalent(company.id, candidateId, folderId);\n      return { reply: folderId ? 'Candidato removido dessa pasta.' : 'Candidato removido do Banco de Talentos da empresa.' };\n    }\n\n    if (intent === 'ADD_TALENT_NOTE') {\n      const candidateId = String(args.candidateId || '').trim();\n      const note = String(args.note || '').trim();\n      if (!candidateId || !note) return { reply: 'Informe o candidato e a observação que deseja registrar no histórico do Banco de Talentos.' };\n      await this.companyPremium.addTalentNote(company.id, candidateId, user.id, note);\n      return { reply: 'Observação registrada no histórico do candidato.' };\n    }\n\n    if (intent === 'RECENT_APPLICATIONS') {\n      const window = String(args.window || requestText || '24h');\n      const result = await this.companyPremium.recentApplications(company.id, window);\n      if (!result.count) return { reply: 'Não houve novas candidaturas nesse período.' };\n      const lines = result.applications.slice(0, 30).map((item: any, index: number) =>\n        \`\${index + 1}. \${item.candidateName} · \${item.jobTitle} · \${item.status} · candidatura \${item.applicationId}\`,\n      );\n      return { reply: \`Foram \${result.count} nova(s) candidatura(s) no período:\\n\${lines.join('\\n')}\` };\n    }\n\n    if (intent === 'JOB_STATS') {\n      const jobId = String(args.jobId || '').trim() || undefined;\n      const stats: any[] = await this.companyPremium.jobStats(company.id, jobId);\n      if (!stats.length) return { reply: 'Não encontrei vagas para calcular as estatísticas.' };\n      return { reply: stats.slice(0, 20).map((item) =>\n        \`\${item.title}: \${item.views} visualizações · \${item.applications} candidaturas · \${item.newApplications24h} nas últimas 24h · conversão \${item.conversionPercent}% · \${item.active ? 'ativa' : 'inativa'}\`,\n      ).join('\\n') };\n    }\n\n    if (intent === 'MESSAGE_CANDIDATE') {\n      const candidateId = String(args.candidateId || '').trim();\n      const message = String(args.message || '').trim().slice(0, 4000);\n      if (!candidateId || !message) return { reply: 'Informe qual candidato e a mensagem que deseja enviar.' };\n      const target = await this.companyPremium.candidateWhatsAppTarget(company.id, candidateId);\n      conversation.activeFlow = 'CANDIDATE_MESSAGE';\n      conversation.state = {\n        ...(conversation.state || {}),\n        pendingCandidateMessage: {\n          candidateId,\n          candidateName: target.candidateName,\n          chatId: target.chatId,\n          message,\n        },\n      };\n      await this.conversations.save(conversation);\n      return { reply: \`Prévia para \${target.candidateName}:\\n\"\${message}\"\\n\\nResponda ENVIAR para confirmar ou CANCELAR para desistir.\` };\n    }\n\n    return null;\n  }\n\n  private async resolveCompanyJobId(\n    companyId: string,\n    args: Record<string, any>,\n    requestText: string,\n  ) {\n    const explicit = String(args.jobId || '').trim();\n    if (explicit) {\n      const exists = await this.jobs.findOne({ where: { id: explicit, companyId } });\n      return exists?.id || null;\n    }\n    const jobs = await this.jobs.find({ where: { companyId }, order: { updatedAt: 'DESC' } });\n    if (jobs.length === 1) return jobs[0].id;\n    const hint = String(args.jobTitle || requestText || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();\n    const matches = jobs.filter((job) => {\n      const title = String(job.title || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();\n      return title && hint.includes(title);\n    });\n    return matches.length === 1 ? matches[0].id : null;\n  }\n\n  private async companyJobChoiceReply(companyId: string, action: string) {\n    const jobs = await this.jobs.find({ where: { companyId }, order: { updatedAt: 'DESC' }, take: 12 });\n    if (!jobs.length) return 'A empresa não possui vagas para essa ação.';\n    return \`Qual vaga deseja \${action}?\\n\${jobs.map((job, index) => \`\${index + 1}. \${job.title} · \${job.active ? 'ativa' : 'inativa'} · \${job.id}\`).join('\\n')}\`;\n  }\n\n`;

  if (!source.includes('private async handleCompanyPremiumDecision(')) {
    source = replaceOrThrow(
      source,
      '  private async resumeCreationFlow(',
      `${methods}  private async resumeCreationFlow(`,
      'premium company methods insertion',
    );
  }

  if (!source.includes('private isCompanyPlanRequired(')) {
    const helpers = `  private isCompanyPlanRequired(error: unknown) {\n    if (!(error instanceof ForbiddenException)) return false;\n    const payload = error.getResponse() as any;\n    return Boolean(payload && typeof payload === 'object' && payload.code === 'COMPANY_PLAN_REQUIRED');\n  }\n\n  private companyPlanPayload(error: unknown): any {\n    if (!(error instanceof ForbiddenException)) return null;\n    const payload = error.getResponse();\n    return payload && typeof payload === 'object' ? payload : null;\n  }\n\n`;
    source = replaceOrThrow(
      source,
      '  private isPaymentRequired(error: unknown) {',
      `${helpers}  private isPaymentRequired(error: unknown) {`,
      'company plan error helpers',
    );
  }

  write(file, source);
}

function patchDashboardRouter() {
  const file = 'pages/DashboardRouter.tsx';
  let source = read(file);
  if (!source.includes('CompanyPlansPage')) {
    source = replaceOrThrow(
      source,
      'import { CompanyHiringConfig } from "./CompanyHiringConfig";',
      'import { CompanyHiringConfig } from "./CompanyHiringConfig";\nimport { CompanyPlansPage } from "./CompanyPlansPage";',
      'CompanyPlansPage import',
    );
  }
  if (!source.includes('path="planos"')) {
    source = replaceOrThrow(
      source,
      '      <Route path="contratacao" element={companyOnly(<CompanyHiringConfig />)} />',
      '      <Route path="contratacao" element={companyOnly(<CompanyHiringConfig />)} />\n      <Route path="planos" element={companyOnly(<CompanyPlansPage />)} />',
      'company plans route',
    );
  }
  write(file, source);
}

function patchWorkspaceNav() {
  const file = 'components/WorkspaceLayout.tsx';
  let source = read(file);
  if (!source.includes('CreditCard,')) {
    source = replaceOrThrow(
      source,
      '  ChevronDown,\n  FileText,',
      '  ChevronDown,\n  CreditCard,\n  FileText,',
      'CreditCard icon import',
    );
  }
  if (!source.includes('to: "/company/planos"')) {
    source = replaceOrThrow(
      source,
      '  { to: "/company/contratacao", label: "Contratação", icon: <Settings2 className="h-5 w-5" /> },',
      '  { to: "/company/contratacao", label: "Contratação", icon: <Settings2 className="h-5 w-5" /> },\n  { to: "/company/planos", label: "Planos", icon: <CreditCard className="h-5 w-5" /> },',
      'company plans navigation',
    );
  }
  write(file, source);
}

patchWhatsappAi();
patchConcierge();
patchDashboardRouter();
patchWorkspaceNav();
console.log('Company business plans integration verified.');
