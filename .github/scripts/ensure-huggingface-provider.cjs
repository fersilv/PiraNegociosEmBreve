const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
process.chdir(repoRoot);

const sentinels = [
  ['components/AiIntegrationsPanel.tsx', 'HUGGINGFACE'],
  ['components/AiImageEnhancementPanel.tsx', 'HUGGINGFACE'],
  ['backend/src/admin/admin-ai.controller.ts', 'HUGGINGFACE'],
  ['backend/src/admin/admin-image-ai.controller.ts', 'HUGGINGFACE'],
  ['backend/src/ai/ai.service.ts', 'HUGGINGFACE'],
  ['backend/src/ai/job-skills.service.ts', 'HUGGINGFACE'],
  ['backend/src/ai/photo-ai.service.ts', 'HUGGINGFACE'],
  ['backend/src/job-match/job-match-ai.service.ts', 'HUGGINGFACE'],
  ['backend/src/whatsapp/whatsapp-ai.service.ts', 'HUGGINGFACE'],
];

const patchTargets = [
  'backend/src/admin/admin-ai.controller.ts',
  'backend/src/admin/admin-image-ai.controller.ts',
  'backend/src/admin/settings.controller.ts',
  'backend/src/ai/job-skills.service.ts',
  'backend/src/ai/resume-review.service.ts',
  'backend/src/ai/resume-improvement.service.ts',
  'backend/src/ai/aligned-resume-improvement.service.ts',
  'backend/src/job-match/job-match-ai.service.ts',
  'backend/src/whatsapp/whatsapp-ai.service.ts',
  'backend/src/ai/ai.service.ts',
  'backend/src/ai/resume-import.service.ts',
  'backend/src/ai/photo-ai.service.ts',
  'components/AiIntegrationsPanel.tsx',
  'components/AiImageEnhancementPanel.tsx',
  'backend/package.json',
  'backend/.env.example',
  '.env.example',
];

function isFullyApplied() {
  return sentinels.every(([file, marker]) => {
    try {
      return fs.readFileSync(file, 'utf8').includes(marker);
    } catch {
      return false;
    }
  });
}

if (isFullyApplied()) {
  console.log('Hugging Face provider integration already applied.');
  process.exit(0);
}

const backup = new Map();
for (const file of patchTargets) {
  if (fs.existsSync(file)) backup.set(file, fs.readFileSync(file));
}

console.log('Applying Hugging Face provider integration before build...');
try {
  require('./apply-huggingface-provider.cjs');
  if (!isFullyApplied()) {
    throw new Error('Hugging Face patch finished without covering every required AI surface.');
  }
  console.log('Hugging Face provider integration verified.');
} catch (error) {
  for (const [file, contents] of backup) {
    fs.writeFileSync(file, contents);
  }
  console.error('Hugging Face provider patch failed; original files restored.');
  throw error;
}
