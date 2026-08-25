const fs = require('fs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content);
  console.log(`updated ${file}`);
}

function replaceMethod(source, marker, replacement, label) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${label || marker}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`Missing opening brace for ${label || marker}`);
  let depth = 0;
  let end = -1;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`Missing closing brace for ${label || marker}`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function transformProviderSource(source, compatImport) {
  let next = source
    .replaceAll('ANTHROPIC', 'GROQ')
    .replaceAll('Anthropic', 'Groq')
    .replaceAll('anthropic', 'groq');

  const badImport = "import Groq from '@groq-ai/sdk';";
  if (next.includes(badImport)) {
    next = next.replace(
      badImport,
      `import { GroqCompat as Groq } from '${compatImport}';`,
    );
  }
  return next;
}

const providerFiles = [
  ['backend/src/admin/admin-ai.controller.ts', '../ai/groq-anthropic-compat'],
  ['backend/src/ai/ai.service.ts', './groq-anthropic-compat'],
  ['backend/src/ai/job-skills.service.ts', './groq-anthropic-compat'],
  ['backend/src/ai/resume-review.service.ts', './groq-anthropic-compat'],
  ['backend/src/ai/resume-improvement.service.ts', './groq-anthropic-compat'],
  ['backend/src/ai/aligned-resume-improvement.service.ts', './groq-anthropic-compat'],
  ['backend/src/ai/resume-import.service.ts', './groq-anthropic-compat'],
  ['backend/src/job-match/job-match-ai.service.ts', '../ai/groq-anthropic-compat'],
  ['backend/src/whatsapp/whatsapp-ai.service.ts', '../ai/groq-anthropic-compat'],
];

for (const [file, compatImport] of providerFiles) {
  let source = read(file);
  source = transformProviderSource(source, compatImport);

  if (file.endsWith('admin-ai.controller.ts')) {
    const groqMethods = `  private isGroqTextModel(id: string): boolean {\n    return Boolean(id) && !/(whisper|tts|guard|moderation|audio|speech|transcribe)/i.test(id);\n  }\n\n  private chooseGroqModel(ids: string[]): string | null {\n    const compatible = ids.filter((id) => this.isGroqTextModel(id));\n    const priorities = [\n      'openai/gpt-oss-20b',\n      'llama-3.1-8b-instant',\n      'qwen/qwen3.6-27b',\n      'openai/gpt-oss-120b',\n    ];\n    return (\n      priorities.find((id) => compatible.includes(id)) ||\n      compatible.find((id) => /instant|8b|20b|mini/i.test(id)) ||\n      compatible[0] ||\n      null\n    );\n  }`;
    source = replaceMethod(
      source,
      '  private chooseGroqModel(',
      groqMethods,
      'AdminAi chooseGroqModel',
    );
    source = source.replace(
      'const compatibleIds = ids.filter((id) => /^claude-/i.test(id));',
      'const compatibleIds = ids.filter((id) => this.isGroqTextModel(id));',
    );
  }

  write(file, source);
}

// Frontend: Anthropic sai da matriz e Groq ocupa o quarto provedor textual.
{
  const file = 'components/AiIntegrationsPanel.tsx';
  let source = read(file)
    .replaceAll('ANTHROPIC', 'GROQ')
    .replaceAll('Anthropic', 'Groq')
    .replaceAll('anthropic', 'groq')
    .replaceAll('sk-ant-...', 'gsk_...');
  write(file, source);
}

// Salvar uma nova chave do Groq invalida o teste anterior do provedor ativo.
{
  const file = 'backend/src/admin/settings.controller.ts';
  let source = read(file)
    .replaceAll('ANTHROPIC', 'GROQ')
    .replaceAll('Anthropic', 'Groq')
    .replaceAll('anthropic', 'groq');
  write(file, source);
}

// Exemplos de ambiente passam a documentar a chave gratuita do Groq.
for (const file of ['backend/.env.example', '.env.example']) {
  if (!fs.existsSync(file)) continue;
  let source = read(file)
    .replaceAll('ANTHROPIC_API_KEY', 'GROQ_API_KEY')
    .replaceAll('Anthropic', 'Groq')
    .replaceAll('anthropic', 'groq');
  if (!source.includes('GROQ_API_KEY=')) {
    const lines = source.split(/\r?\n/);
    const openAiIndex = lines.findIndex((line) => line.startsWith('OPENAI_API_KEY='));
    lines.splice(openAiIndex >= 0 ? openAiIndex + 1 : lines.length, 0, 'GROQ_API_KEY=');
    source = `${lines.join('\n').replace(/\n+$/, '')}\n`;
  }
  write(file, source);
}

// Guardrail: nenhum runtime textual deve continuar oferecendo Anthropic.
const scanFiles = [
  ...providerFiles.map(([file]) => file),
  'components/AiIntegrationsPanel.tsx',
  'backend/src/admin/settings.controller.ts',
];
const stale = scanFiles.filter((file) => /ANTHROPIC|Anthropic API|@anthropic-ai\/sdk/.test(read(file)));
if (stale.length) {
  throw new Error(`Anthropic ainda encontrado em superfícies ativas: ${stale.join(', ')}`);
}

console.log('Groq provider migration applied successfully.');
