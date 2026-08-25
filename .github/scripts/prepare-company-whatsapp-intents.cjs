const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

const file = 'backend/src/whatsapp/whatsapp-ai.service.ts';
let source = fs.readFileSync(file, 'utf8');

const requiredIntents = [
  'LIST_COMPANY_JOBS',
  'JOB_APPLICATION_COUNTS',
  'JOB_MATCH_CANDIDATES',
  'COMPANY_PLAN_STATUS',
  'JOB_ACTIVATE',
  'JOB_DEACTIVATE',
  'JOB_CLOSE',
  'LIST_JOB_CANDIDATES',
  'GET_CANDIDATE_PROFILE',
  'UPDATE_APPLICATION_STATUS',
  'ADD_APPLICATION_NOTE',
  'INVITE_CANDIDATE',
  'LIST_CANDIDATE_INVITES',
  'CANCEL_CANDIDATE_INVITE',
  'LIST_TALENT_FOLDERS',
  'ADD_TALENT',
  'REMOVE_TALENT',
  'ADD_TALENT_NOTE',
  'MESSAGE_CANDIDATE',
  'CONFIRM_CANDIDATE_MESSAGE',
  'CONFIRM_COMPANY_ACTION',
  'RECENT_APPLICATIONS',
  'JOB_STATS',
  'START_JOB_CREATE',
  'CONTINUE_JOB_CREATE',
  'CONFIRM_JOB_CREATE',
  'START_JOB_EDIT',
  'CONTINUE_JOB_EDIT',
  'CONFIRM_JOB_EDIT',
  'CANCEL_FLOW',
];

const companyIntentBlock = `INTENTS DE EMPRESA:\n${requiredIntents.join(', ')}.`;
const intentStart = source.indexOf('INTENTS DE EMPRESA:');
const contextMarker = '\n\nREGRAS DE CONTEXTO:';
const intentEnd = intentStart >= 0 ? source.indexOf(contextMarker, intentStart) : -1;

if (intentStart < 0 || intentEnd < 0) {
  throw new Error('Não encontrei o bloco INTENTS DE EMPRESA no whatsapp-ai.service.ts.');
}

const existingIntentBlock = source.slice(intentStart, intentEnd);
if (!requiredIntents.every((intent) => existingIntentBlock.includes(intent))) {
  source = `${source.slice(0, intentStart)}${companyIntentBlock}${source.slice(intentEnd)}`;
  console.log('updated company WhatsApp intent catalog');
}

const rulesMarker = 'REGRAS DE RECURSOS EMPRESARIAIS:';
if (!source.includes(rulesMarker)) {
  const vacancyMarker = '\nREGRAS DO FLUXO DE VAGA:';
  const vacancyIndex = source.indexOf(vacancyMarker);
  if (vacancyIndex < 0) {
    throw new Error('Não encontrei REGRAS DO FLUXO DE VAGA no whatsapp-ai.service.ts.');
  }

  const rules = `\nREGRAS DE RECURSOS EMPRESARIAIS:\n- COMPANY_PLAN_STATUS quando a empresa perguntar qual plano possui, preço, recursos ou upgrade.\n- JOB_ACTIVATE, JOB_DEACTIVATE e JOB_CLOSE exigem args.jobId. Se o contexto permitir identificar inequivocamente a vaga pelo título, use o id real. Nunca invente UUID.\n- LIST_JOB_CANDIDATES exige args.jobId.\n- GET_CANDIDATE_PROFILE exige args.candidateId.\n- UPDATE_APPLICATION_STATUS exige args.applicationId e args.status. Status aceitos: PENDING, REVIEWING, DOCUMENTS_REQUESTED, DOCUMENTS_SUBMITTED, HIRED, REJECTED, WITHDRAWN.\n- ADD_APPLICATION_NOTE exige args.applicationId e args.note.\n- INVITE_CANDIDATE exige args.candidateId e args.jobId.\n- CANCEL_CANDIDATE_INVITE exige args.inviteId. LIST_CANDIDATE_INVITES lista os convites existentes.\n- LIST_TALENT_FOLDERS lista pastas. ADD_TALENT exige args.candidateId e pode usar args.folderIds/args.jobIds. REMOVE_TALENT exige args.candidateId e opcional args.folderId. ADD_TALENT_NOTE exige args.candidateId e args.note.\n- RECENT_APPLICATIONS usa args.window com hoje, ontem, 24h ou 7d quando o período estiver claro.\n- JOB_STATS usa args.jobId quando a pergunta for sobre uma vaga; sem jobId, retorna panorama das vagas da empresa.\n- MESSAGE_CANDIDATE exige args.candidateId e args.message. Nunca marque como CONFIRM_CANDIDATE_MESSAGE na primeira solicitação: o backend mostra uma prévia e pede confirmação.\n- CONFIRM_CANDIDATE_MESSAGE apenas quando houver fluxo ativo de mensagem e a pessoa confirmar explicitamente ENVIAR, CONFIRMO ou PODE ENVIAR.\n- CONFIRM_COMPANY_ACTION apenas quando houver fluxo ativo de ação empresarial destrutiva e confirmação explícita.\n- Não suponha que um recurso esteja liberado pelo plano. O backend verifica a assinatura e responderá com upgrade quando necessário.\n- Para qualquer ação que exija um id e não possa ser identificada inequivocamente pelos dados reais do contexto, responda pedindo qual vaga/candidato/candidatura deve ser usado; não invente args.\n`;
  source = `${source.slice(0, vacancyIndex)}${rules}${source.slice(vacancyIndex)}`;
  console.log('added company WhatsApp premium intent rules');
}

fs.writeFileSync(file, source);
console.log('Company WhatsApp intent preparation verified.');
