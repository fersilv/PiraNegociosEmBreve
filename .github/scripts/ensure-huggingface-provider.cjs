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

const fullyApplied = sentinels.every(([file, marker]) => {
  try {
    return fs.readFileSync(file, 'utf8').includes(marker);
  } catch {
    return false;
  }
});

if (fullyApplied) {
  console.log('Hugging Face provider integration already applied.');
  process.exit(0);
}

console.log('Applying Hugging Face provider integration before build...');
require('./apply-huggingface-provider.cjs');
