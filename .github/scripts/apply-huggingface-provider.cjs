const fs = require('fs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content);
  console.log(`updated ${file}`);
}

function change(file, transform) {
  const before = read(file);
  const after = transform(before);
  if (after === before) throw new Error(`No changes produced for ${file}`);
  write(file, after);
}

function mustReplace(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label || needle.slice(0, 80)}`);
  }
  return source.replace(needle, replacement);
}

function addImport(source, anchor, importLine) {
  if (source.includes(importLine)) return source;
  return mustReplace(source, anchor, `${anchor}\n${importLine}`, `import anchor ${anchor}`);
}

function insertBeforeAfter(source, methodMarker, target, insertion, label) {
  if (source.includes(insertion.trim())) return source;
  const methodIndex = source.indexOf(methodMarker);
  if (methodIndex < 0) throw new Error(`Missing method ${methodMarker} (${label})`);
  const targetIndex = source.indexOf(target, methodIndex);
  if (targetIndex < 0) throw new Error(`Missing target ${target} after ${methodMarker} (${label})`);
  return `${source.slice(0, targetIndex)}${insertion}${source.slice(targetIndex)}`;
}

function addHfToProviderType(source) {
  return source
    .replaceAll("'GEMINI' | 'OPENAI' | 'ANTHROPIC'", "'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'HUGGINGFACE'")
    .replaceAll("['GEMINI', 'OPENAI', 'ANTHROPIC']", "['GEMINI', 'OPENAI', 'ANTHROPIC', 'HUGGINGFACE']");
}

// Admin: provedor geral.
change('backend/src/admin/admin-ai.controller.ts', (source) => {
  source = addHfToProviderType(source);

  const methods = `  private chooseHuggingFaceModel(models: AiModelInfo[]): string | null {\n    const ids = models.map((item) => item.id);\n    return (\n      ids.find((id) => /qwen.*vl.*instruct/i.test(id)) ||\n      ids.find((id) => /gemma-3/i.test(id)) ||\n      ids.find((id) => /vision|vl/i.test(id)) ||\n      ids[0] ||\n      null\n    );\n  }\n\n  private async listHuggingFaceModels(apiKey: string): Promise<AiModelInfo[]> {\n    const response = await fetch('https://router.huggingface.co/v1/models', {\n      headers: { Authorization: \`Bearer \${apiKey}\` },\n      signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),\n    });\n    if (!response.ok) {\n      const detail = await response.text().catch(() => '');\n      throw new Error(\`Hugging Face respondeu HTTP \${response.status}\${detail ? \`: \${detail.slice(0, 300)}\` : ''}\`);\n    }\n    const payload = (await response.json()) as {\n      data?: Array<{\n        id?: string;\n        architecture?: { input_modalities?: string[]; output_modalities?: string[] };\n        providers?: Array<{\n          status?: string;\n          context_length?: number;\n          pricing?: { input?: number; output?: number };\n        }>;\n      }>;\n    };\n    return (payload.data || [])\n      .filter((item) => {\n        const inputs = item.architecture?.input_modalities || [];\n        const outputs = item.architecture?.output_modalities || [];\n        const live = (item.providers || []).some((provider) => provider.status === 'live');\n        return Boolean(item.id && live && inputs.includes('text') && inputs.includes('image') && outputs.includes('text'));\n      })\n      .map((item) => {\n        const liveProviders = (item.providers || []).filter((provider) => provider.status === 'live');\n        const inputPrices = liveProviders.map((provider) => Number(provider.pricing?.input)).filter(Number.isFinite);\n        const outputPrices = liveProviders.map((provider) => Number(provider.pricing?.output)).filter(Number.isFinite);\n        const contexts = liveProviders.map((provider) => Number(provider.context_length)).filter(Number.isFinite);\n        return {\n          id: String(item.id),\n          name: String(item.id),\n          provider: 'Hugging Face',\n          providerId: 'HUGGINGFACE' as const,\n          inputCostPer1M: inputPrices.length ? Math.min(...inputPrices) : 0,\n          outputCostPer1M: outputPrices.length ? Math.min(...outputPrices) : 0,\n          contextWindow: contexts.length ? Math.max(...contexts) : undefined,\n        };\n      });\n  }\n\n`;
  if (!source.includes('private async listHuggingFaceModels')) {
    source = mustReplace(
      source,
      '  private async testGeminiGeneration',
      `${methods}  private async testGeminiGeneration`,
      'AdminAi Hugging Face helpers',
    );
  }

  const hfBranch = `      if (provider === 'HUGGINGFACE') {\n        const models = await this.listHuggingFaceModels(apiKey);\n        const ids = models.map((item) => item.id);\n        const model = this.selectRequestedOrSuggested(\n          ids,\n          requestedModel,\n          this.chooseHuggingFaceModel(models),\n        );\n        const huggingFace = new OpenAI({\n          apiKey,\n          baseURL: 'https://router.huggingface.co/v1',\n          timeout: PROVIDER_REQUEST_TIMEOUT_MS,\n        });\n        await huggingFace.responses.create({\n          model,\n          input: 'Responda apenas OK.',\n          max_output_tokens: 16,\n        });\n        return { model, models };\n      }\n\n`;
  source = insertBeforeAfter(source, 'private async testProvider(', "      if (provider === 'OPENAI')", hfBranch, 'AdminAi testProvider');
  return source;
});

// Admin: provedor de imagem.
change('backend/src/admin/admin-image-ai.controller.ts', (source) => {
  source = source
    .replaceAll("'GEMINI' | 'OPENAI'", "'GEMINI' | 'OPENAI' | 'HUGGINGFACE'")
    .replaceAll("['GEMINI', 'OPENAI']", "['GEMINI', 'OPENAI', 'HUGGINGFACE']");

  const method = `  private async listHuggingFaceModels(apiKey: string): Promise<ImageModelInfo[]> {\n    const response = await fetch(\n      'https://huggingface.co/api/models?inference_provider=all&pipeline_tag=image-to-image&sort=trendingScore&direction=-1&limit=100',\n      {\n        headers: { Authorization: \`Bearer \${apiKey}\` },\n        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),\n      },\n    );\n    if (!response.ok) {\n      const detail = await response.text().catch(() => '');\n      throw new Error(\`Hugging Face respondeu HTTP \${response.status}\${detail ? \`: \${detail.slice(0, 300)}\` : ''}\`);\n    }\n    const data = (await response.json()) as Array<{ id?: string; modelId?: string }>;\n    const seen = new Set<string>();\n    return data\n      .map((item) => String(item.id || item.modelId || '').trim())\n      .filter((id) => Boolean(id) && !seen.has(id) && seen.add(id))\n      .map((id) => ({\n        id,\n        name: id,\n        provider: 'Hugging Face',\n        providerId: 'HUGGINGFACE' as const,\n      }));\n  }\n\n`;
  if (!source.includes('private async listHuggingFaceModels')) {
    source = mustReplace(source, '  private async listModels(', `${method}  private async listModels(`, 'AdminImage HF list method');
  }

  source = mustReplace(
    source,
    "      return provider === 'OPENAI'\n        ? await this.listOpenAiModels(apiKey)\n        : await this.listGeminiModels(apiKey);",
    "      if (provider === 'OPENAI') return await this.listOpenAiModels(apiKey);\n      if (provider === 'HUGGINGFACE') return await this.listHuggingFaceModels(apiKey);\n      return await this.listGeminiModels(apiKey);",
    'AdminImage provider dispatch',
  );

  source = mustReplace(
    source,
    "      OPENAI: Boolean(await this.getProviderKey('OPENAI')),\n    };",
    "      OPENAI: Boolean(await this.getProviderKey('OPENAI')),\n      HUGGINGFACE: Boolean(await this.getProviderKey('HUGGINGFACE')),\n    };",
    'AdminImage configuredProviders',
  );
  return source;
});

// Alterar uma chave ativa deve desligar o respectivo escopo até novo teste.
change('backend/src/admin/settings.controller.ts', (source) => mustReplace(
  source,
  "      ANTHROPIC_API_KEY: 'ANTHROPIC',\n    };",
  "      ANTHROPIC_API_KEY: 'ANTHROPIC',\n      HUGGINGFACE_API_KEY: 'HUGGINGFACE',\n    };",
  'settings providerByKey',
));

function patchTextService(file, helperPath, methodMarker, hfBody) {
  change(file, (source) => {
    source = addHfToProviderType(source);
    source = addImport(source, "import { SettingsService }", '');
    // addImport above cannot target partial import syntax; use Anthropic import as stable anchor.
    const importLine = `import { huggingFaceGenerateText } from '${helperPath}';`;
    source = addImport(source, "import Anthropic from '@anthropic-ai/sdk';", importLine);
    const insertion = `    if (config.provider === 'HUGGINGFACE') {\n${hfBody}\n    }\n\n`;
    source = insertBeforeAfter(source, methodMarker, "    if (config.provider === 'OPENAI')", insertion, file);
    return source;
  });
}

patchTextService(
  'backend/src/ai/job-skills.service.ts',
  './huggingface.provider',
  'private async generateJson(',
  "      const response = await huggingFaceGenerateText({ apiKey: config.apiKey, model: config.model, prompt, systemInstruction, maxOutputTokens, json: true });\n      return this.parseJson(response.text || '{}');",
);

patchTextService(
  'backend/src/ai/resume-review.service.ts',
  './huggingface.provider',
  'private async generateRaw(',
  "      const response = await huggingFaceGenerateText({ apiKey: config.apiKey, model: config.model, prompt, systemInstruction, maxOutputTokens: maxTokens, json: true });\n      return response.text || '{}';",
);

patchTextService(
  'backend/src/ai/resume-improvement.service.ts',
  './huggingface.provider',
  'private async generate(config:',
  "      const response = await huggingFaceGenerateText({ apiKey: config.apiKey, model: config.model, prompt, systemInstruction: system, maxOutputTokens: 8000, json: true });\n      return this.parseJson(response.text || '{}');",
);

patchTextService(
  'backend/src/ai/aligned-resume-improvement.service.ts',
  './huggingface.provider',
  'private async generateRaw(',
  "      const response = await huggingFaceGenerateText({ apiKey: config.apiKey, model: config.model, prompt, systemInstruction: system, maxOutputTokens: maxTokens, json: true });\n      return response.text || '{}';",
);

patchTextService(
  'backend/src/job-match/job-match-ai.service.ts',
  '../ai/huggingface.provider',
  'private async rawGenerate(',
  "      const response = await huggingFaceGenerateText({ apiKey: config.apiKey, model: config.model, prompt, systemInstruction: system, maxOutputTokens: maxTokens, json: true });\n      return response.text || '';",
);

// WhatsApp também usa o provedor geral selecionado.
change('backend/src/whatsapp/whatsapp-ai.service.ts', (source) => {
  source = addHfToProviderType(source);
  source = addImport(source, "import OpenAI from 'openai';", "import { huggingFaceGenerateText } from '../ai/huggingface.provider';");
  const insertion = `    if (runtime.provider === 'HUGGINGFACE') {\n      const response = await huggingFaceGenerateText({\n        apiKey: runtime.apiKey,\n        model: runtime.model,\n        prompt,\n        systemInstruction: system,\n        maxOutputTokens: maxTokens,\n        json,\n      });\n      return response.text;\n    }\n`;
  source = insertBeforeAfter(source, 'private async generate(', "    if (runtime.provider === 'OPENAI')", insertion, 'WhatsApp generate');
  return source;
});

// Serviço central: chat de suporte, tarefas gerais e análise legada de currículo.
change('backend/src/ai/ai.service.ts', (source) => {
  source = addHfToProviderType(source);
  source = addImport(
    source,
    "import Anthropic from '@anthropic-ai/sdk';",
    "import { huggingFaceGenerateText, huggingFacePreparePdf } from './huggingface.provider';",
  );

  const resumeMethod = `  private async generateResumeWithHuggingFace(\n    config: AiRuntimeConfig,\n    cleanBase64: string,\n    cleanMimeType: string,\n    systemInstruction: string,\n  ) {\n    let prompt = RESUME_PROMPT;\n    let images: string[] = [];\n    if (cleanMimeType === 'application/pdf') {\n      const prepared = await huggingFacePreparePdf(cleanBase64, 8);\n      if (prepared.text) prompt = \`\${RESUME_PROMPT}\\n\\nTEXTO EXTRAÍDO DO PDF:\\n\${prepared.text}\`;\n      images = prepared.images;\n    } else {\n      images = [\`data:\${cleanMimeType};base64,\${cleanBase64}\`];\n    }\n    const response = await huggingFaceGenerateText({\n      apiKey: config.apiKey,\n      model: config.model,\n      prompt,\n      systemInstruction,\n      maxOutputTokens: 5000,\n      json: true,\n      images,\n    });\n    return this.parseJson(response.text || '{}');\n  }\n\n`;
  if (!source.includes('generateResumeWithHuggingFace')) {
    source = mustReplace(source, '  private async generateResumeWithOpenAi(', `${resumeMethod}  private async generateResumeWithOpenAi(`, 'AiService HF resume method');
  }

  const resumeBranch = `      if (config.provider === 'HUGGINGFACE') {\n        return await this.generateResumeWithHuggingFace(\n          config,\n          cleanBase64,\n          cleanMimeType,\n          systemInstruction,\n        );\n      }\n`;
  source = insertBeforeAfter(source, 'async analyzeResume(', "      if (config.provider === 'OPENAI')", resumeBranch, 'AiService analyzeResume');

  const generateBranch = `    if (config.provider === 'HUGGINGFACE') {\n      return (await huggingFaceGenerateText({\n        apiKey: config.apiKey,\n        model: config.model,\n        prompt,\n        systemInstruction,\n        maxOutputTokens,\n        json: options?.json !== false,\n      })).text;\n    }\n`;
  source = insertBeforeAfter(source, 'private async generateText(', "    if (config.provider === 'OPENAI')", generateBranch, 'AiService generateText');

  const supportBranch = `      if (config.provider === 'HUGGINGFACE') {\n        const result = await huggingFaceGenerateText({\n          apiKey: config.apiKey,\n          model: config.model,\n          prompt,\n          systemInstruction,\n          maxOutputTokens: 900,\n          json: false,\n          images: screenshotMatch ? [input.screenshot!.data] : [],\n        });\n        return this.usageResult(result.text, config, prompt, result.usage);\n      }\n`;
  source = insertBeforeAfter(source, 'async supportChatReply(', "      if (config.provider === 'OPENAI')", supportBranch, 'AiService supportChatReply');
  return source;
});

// Importação multi-documento, inclusive PDFs e prints.
change('backend/src/ai/resume-import.service.ts', (source) => {
  source = addHfToProviderType(source);
  source = addImport(
    source,
    "import Anthropic from '@anthropic-ai/sdk';",
    "import { huggingFaceGenerateText, huggingFacePreparePdf } from './huggingface.provider';",
  );

  const method = `  private async withHuggingFace(\n    config: RuntimeConfig,\n    documents: CleanDocument[],\n    systemInstruction: string,\n  ) {\n    const textParts: string[] = [];\n    const images: string[] = [];\n    for (const [index, document] of documents.entries()) {\n      textParts.push(\`FONTE \${index + 1}: \${document.fileName}\`);\n      if (document.kind === 'text') {\n        textParts.push(document.text.slice(0, 100_000));\n        continue;\n      }\n      if (document.mimeType === 'application/pdf') {\n        const prepared = await huggingFacePreparePdf(document.data, 8);\n        if (prepared.text) textParts.push(prepared.text.slice(0, 160_000));\n        images.push(...prepared.images);\n        continue;\n      }\n      images.push(\`data:\${document.mimeType};base64,\${document.data}\`);\n    }\n    const prompt = \`\${textParts.join('\\n\\n').slice(0, 450_000)}\\n\\n\${IMPORT_PROMPT}\`;\n    const response = await huggingFaceGenerateText({\n      apiKey: config.apiKey,\n      model: config.model,\n      prompt,\n      systemInstruction,\n      maxOutputTokens: 7000,\n      json: true,\n      images: images.slice(0, 12),\n    });\n    return this.parseJson(response.text || '{}');\n  }\n\n`;
  if (!source.includes('private async withHuggingFace')) {
    source = mustReplace(source, '  private async withGemini(', `${method}  private async withGemini(`, 'ResumeImport HF method');
  }
  source = mustReplace(
    source,
    "      const result =\n        config.provider === 'OPENAI'",
    "      const result =\n        config.provider === 'HUGGINGFACE'\n          ? await this.withHuggingFace(config, documents, systemInstruction)\n          : config.provider === 'OPENAI'",
    'ResumeImport provider dispatch',
  );
  return source;
});

// Imagem: Hugging Face Inference Providers com image-to-image.
change('backend/src/ai/photo-ai.service.ts', (source) => {
  source = addImport(source, "import { SettingsService } from '../admin/settings.service';", "import { InferenceClient } from '@huggingface/inference';");
  source = source
    .replaceAll("'GEMINI' | 'OPENAI'", "'GEMINI' | 'OPENAI' | 'HUGGINGFACE'")
    .replaceAll("['GEMINI', 'OPENAI']", "['GEMINI', 'OPENAI', 'HUGGINGFACE']");

  source = mustReplace(
    source,
    "        (provider === 'OPENAI'\n          ? this.isOpenAiEditableImageModel(model)\n          : this.isGeminiImageModel(model)),",
    "        (provider === 'OPENAI'\n          ? this.isOpenAiEditableImageModel(model)\n          : provider === 'GEMINI'\n            ? this.isGeminiImageModel(model)\n            : true),",
    'PhotoAi status compatibility',
  );
  source = mustReplace(
    source,
    "    const compatible =\n      provider === 'OPENAI'\n        ? this.isOpenAiEditableImageModel(model)\n        : this.isGeminiImageModel(model);",
    "    const compatible =\n      provider === 'OPENAI'\n        ? this.isOpenAiEditableImageModel(model)\n        : provider === 'GEMINI'\n          ? this.isGeminiImageModel(model)\n          : true;",
    'PhotoAi runtime compatibility',
  );

  const method = `  private async professionalizeWithHuggingFace(\n    config: PhotoRuntimeConfig,\n    mimeType: string,\n    base64: string,\n  ) {\n    const client = new InferenceClient(config.apiKey);\n    const bytes = new Uint8Array(Buffer.from(base64, 'base64'));\n    const generated = await client.imageToImage(\n      {\n        model: config.model,\n        inputs: new Blob([bytes], { type: mimeType }),\n        parameters: { prompt: PHOTO_PROMPT },\n      },\n      { provider: 'auto' },\n    );\n    const output = Buffer.from(await generated.arrayBuffer());\n    if (!output.length) {\n      throw new ServiceUnavailableException(\n        \`O modelo \${config.model} não devolveu uma imagem editada pelo Hugging Face.\`,\n      );\n    }\n    const outputMimeType = generated.type?.startsWith('image/')\n      ? generated.type\n      : 'image/png';\n    return {\n      image: \`data:\${outputMimeType};base64,\${output.toString('base64')}\`,\n      provider: config.provider,\n      model: config.model,\n    };\n  }\n\n`;
  if (!source.includes('professionalizeWithHuggingFace')) {
    source = mustReplace(source, '  private async professionalizeWithOpenAi(', `${method}  private async professionalizeWithOpenAi(`, 'PhotoAi HF method');
  }
  source = mustReplace(
    source,
    "      if (config.provider === 'GEMINI') {\n        return await this.professionalizeWithGemini(config, mimeType, base64);\n      }\n\n      return await this.professionalizeWithOpenAi(config, mimeType, base64);",
    "      if (config.provider === 'GEMINI') {\n        return await this.professionalizeWithGemini(config, mimeType, base64);\n      }\n      if (config.provider === 'HUGGINGFACE') {\n        return await this.professionalizeWithHuggingFace(config, mimeType, base64);\n      }\n\n      return await this.professionalizeWithOpenAi(config, mimeType, base64);",
    'PhotoAi dispatch',
  );
  return source;
});

// Frontend geral.
change('components/AiIntegrationsPanel.tsx', (source) => {
  source = source.replaceAll('"GEMINI" | "OPENAI" | "ANTHROPIC"', '"GEMINI" | "OPENAI" | "ANTHROPIC" | "HUGGINGFACE"');
  source = mustReplace(
    source,
    '  key: "GEMINI_API_KEY" | "OPENAI_API_KEY" | "ANTHROPIC_API_KEY";',
    '  key: "GEMINI_API_KEY" | "OPENAI_API_KEY" | "ANTHROPIC_API_KEY" | "HUGGINGFACE_API_KEY";',
    'frontend provider key type',
  );
  source = mustReplace(
    source,
    '  {\n    id: "ANTHROPIC",\n    label: "Anthropic",\n    key: "ANTHROPIC_API_KEY",\n    placeholder: "sk-ant-...",\n  },\n];',
    '  {\n    id: "ANTHROPIC",\n    label: "Anthropic",\n    key: "ANTHROPIC_API_KEY",\n    placeholder: "sk-ant-...",\n  },\n  {\n    id: "HUGGINGFACE",\n    label: "Hugging Face",\n    key: "HUGGINGFACE_API_KEY",\n    placeholder: "hf_...",\n  },\n];',
    'frontend providers array',
  );
  source = mustReplace(
    source,
    '    ANTHROPIC_API_KEY: "",\n  });',
    '    ANTHROPIC_API_KEY: "",\n    HUGGINGFACE_API_KEY: "",\n  });',
    'frontend keys state',
  );
  source = mustReplace(
    source,
    '        ANTHROPIC_API_KEY: settings.ANTHROPIC_API_KEY || "",\n      };',
    '        ANTHROPIC_API_KEY: settings.ANTHROPIC_API_KEY || "",\n        HUGGINGFACE_API_KEY: settings.HUGGINGFACE_API_KEY || "",\n      };',
    'frontend keys load',
  );
  return source;
});

// Frontend imagem.
change('components/AiImageEnhancementPanel.tsx', (source) => {
  source = source.replaceAll("'GEMINI' | 'OPENAI'", "'GEMINI' | 'OPENAI' | 'HUGGINGFACE'");
  source = mustReplace(
    source,
    "  {\n    id: 'GEMINI',\n    label: 'Google Gemini',\n    description: 'Modelos Gemini capazes de devolver imagem gerada.',\n  },\n];",
    "  {\n    id: 'GEMINI',\n    label: 'Google Gemini',\n    description: 'Modelos Gemini capazes de devolver imagem gerada.',\n  },\n  {\n    id: 'HUGGINGFACE',\n    label: 'Hugging Face',\n    description: 'Modelos image-to-image servidos pelos Inference Providers.',\n  },\n];",
    'image frontend providers',
  );
  source = source.replaceAll(
    'configuredProviders: { GEMINI: false, OPENAI: false },',
    'configuredProviders: { GEMINI: false, OPENAI: false, HUGGINGFACE: false },',
  );
  source = mustReplace(
    source,
    '          OPENAI: Boolean(response.data?.configuredProviders?.OPENAI),\n        },',
    '          OPENAI: Boolean(response.data?.configuredProviders?.OPENAI),\n          HUGGINGFACE: Boolean(response.data?.configuredProviders?.HUGGINGFACE),\n        },',
    'image frontend config load',
  );
  source = mustReplace(
    source,
    "      } else if (next.configuredProviders.GEMINI) {\n        setProvider('GEMINI');\n      }",
    "      } else if (next.configuredProviders.GEMINI) {\n        setProvider('GEMINI');\n      } else if (next.configuredProviders.HUGGINGFACE) {\n        setProvider('HUGGINGFACE');\n      }",
    'image frontend fallback provider',
  );
  return source;
});

// Dependências para Inference Providers de imagem e leitura de PDF no VLM.
change('backend/package.json', (source) => {
  const pkg = JSON.parse(source);
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies['@huggingface/inference'] = '^4.13.28';
  pkg.dependencies['pdf-parse'] = '^2.4.5';
  return `${JSON.stringify(pkg, null, 2)}\n`;
});

// Documentar variável quando os exemplos de ambiente existirem.
for (const file of ['backend/.env.example', '.env.example']) {
  if (!fs.existsSync(file)) continue;
  const source = read(file);
  if (source.includes('HUGGINGFACE_API_KEY=')) continue;
  const anchor = source.includes('ANTHROPIC_API_KEY=') ? 'ANTHROPIC_API_KEY=' : null;
  if (!anchor) continue;
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(anchor));
  lines.splice(index + 1, 0, 'HUGGINGFACE_API_KEY=');
  write(file, `${lines.join('\n').replace(/\n+$/, '')}\n`);
}

// Guardrail: nenhum serviço de IA pode continuar limitado ao trio antigo.
const scanRoots = ['backend/src/ai', 'backend/src/job-match', 'backend/src/whatsapp', 'backend/src/admin'];
const stale = [];
const staleProviderUnion = /'GEMINI'\s*\|\s*'OPENAI'\s*\|\s*'ANTHROPIC'(?!\s*\|\s*'HUGGINGFACE')/;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = `${dir}/${name}`;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.ts$/.test(name)) {
      const text = read(full);
      if (staleProviderUnion.test(text) || text.includes("['GEMINI', 'OPENAI', 'ANTHROPIC']")) stale.push(full);
    }
  }
}
scanRoots.forEach((root) => walk(root));
if (stale.length) throw new Error(`Provider antigo ainda encontrado em: ${stale.join(', ')}`);

console.log('Hugging Face provider patch applied successfully.');