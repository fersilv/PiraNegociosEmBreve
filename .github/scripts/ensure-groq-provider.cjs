const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

const sentinels = [
  ['components/AiIntegrationsPanel.tsx', 'GROQ_API_KEY'],
  ['backend/src/admin/admin-ai.controller.ts', "'GROQ'"],
  ['backend/src/admin/settings.controller.ts', 'GROQ_API_KEY'],
  ['backend/src/ai/ai.service.ts', "'GROQ'"],
  ['backend/src/ai/job-skills.service.ts', "'GROQ'"],
  ['backend/src/ai/resume-review.service.ts', "'GROQ'"],
  ['backend/src/ai/resume-improvement.service.ts', "'GROQ'"],
  ['backend/src/ai/aligned-resume-improvement.service.ts', "'GROQ'"],
  ['backend/src/ai/resume-import.service.ts', "'GROQ'"],
  ['backend/src/job-match/job-match-ai.service.ts', "'GROQ'"],
  ['backend/src/whatsapp/whatsapp-ai.service.ts', "'GROQ'"],
];

const patchTargets = [
  ...sentinels.map(([file]) => file),
  'backend/.env.example',
  '.env.example',
];

function isFullyApplied() {
  return sentinels.every(([file, marker]) => {
    try {
      const source = fs.readFileSync(file, 'utf8');
      return source.includes(marker) && !source.includes('ANTHROPIC');
    } catch {
      return false;
    }
  });
}

if (isFullyApplied()) {
  console.log('Groq provider migration already applied.');
  process.exit(0);
}

const backup = new Map();
for (const file of patchTargets) {
  if (fs.existsSync(file)) backup.set(file, fs.readFileSync(file));
}

console.log('Replacing Anthropic provider with Groq...');
try {
  require('./apply-groq-provider.cjs');
  if (!isFullyApplied()) {
    throw new Error('Groq migration finished without covering every required AI surface.');
  }
  console.log('Groq provider migration verified.');
} catch (error) {
  for (const [file, contents] of backup) {
    fs.writeFileSync(file, contents);
  }
  console.error('Groq provider migration failed; original files restored.');
  throw error;
}
