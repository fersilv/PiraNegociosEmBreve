# 🤖 Manual da API Externa para IA (Pira Negócios)

Este documento descreve as capacidades da API Externa (`v1/jobs`) do Pira Negócios, desenhada especificamente para que agentes autônomos (IAs) possam pesquisar, inserir e gerenciar vagas.

**URL Base:** `https://piranegocios.com.br/api` (ou a URL do seu ambiente)
**Autenticação:** Header `X-API-Key: <Sua-Chave>` em todas as requisições.

---

## 🛠️ O que você (IA) pode fazer?

Você tem total autonomia para **catalogar novas vagas externas**, **atualizar dados**, verificar o status (se continuam ativas) e **Sinalizar (Flag)** vagas antigas ou irregulares para revisão humana. Você **PODE** atualizar qualquer vaga externa no sistema, mesmo aquelas cadastradas por outras chaves de API, usando o método `PATCH /v1/jobs/:id` ou verificá-las via `POST /v1/jobs/:id/verification`.

---

## 📍 Rotas Disponíveis

### 1. Checar Duplicidade
**`POST /v1/jobs/check`**
Antes de cadastrar uma vaga nova, envie os detalhes para saber se ela já existe. O motor avaliará por `sourceExternalId` (EXACT) ou fará busca semântica (LIKELY/SIMILAR).
O retorno de `check` traz um objeto `signals` indicando os parâmetros de semelhança.

### 2. Cadastrar Vaga
**`POST /v1/jobs`**
Insere uma nova vaga no painel.

### 3. Atualizar Vaga Externa
**`PATCH /v1/jobs/:id`**
Atualiza dados (ex: salário, descrição, flag) de uma vaga externa sem modificar os outros. 

### 4. Verificar Atividade da Vaga (Novo!)
**`POST /v1/jobs/:id/verification`**
Use para relatar o monitoramento diário da vaga.
- **Body:** `{ "status": "AVAILABLE" | "CLOSED" | "EXPIRED" | "NOT_FOUND" | "UNCERTAIN", "observation": "String opcional" }`
- **Ação:** Isso alimentará o `lastVerifiedAt` da vaga. Se for mandado `AVAILABLE`, as flags de erro antigas da vaga serão limpas automaticamente. Se for mandado `CLOSED` ou `EXPIRED`, a vaga será desativada e sinalizada automaticamente.

---

## 📦 Payload Suportado (POST/PATCH)

Todos os campos são opcionais no `PATCH`. No `POST`, `title` e `description` são obrigatórios.

```json
{
  "title": "Desenvolvedor Backend Pleno",
  "description": "Texto longo descritivo da vaga e rotina...",
  "requirements": "Node.js, TypeScript, etc.",
  
  // Nomes Desacoplados (Obrigatório para melhor inteligência)
  "companyName": "Empresa XPTO",
  "sourceName": "PAT Limeira - Prefeitura",
  
  // Identificadores (Fortemente recomendados)
  "sourceExternalId": "9198385", 
  "sourceUrl": "https://pat.limeira.sp.gov.br/...",
  
  "city": "São Paulo",
  "state": "SP",
  
  // Deixe em branco se não houver certeza para que caia em "Não informado"
  "type": "Tempo Integral",
  "workModel": "Híbrido",
  
  "salary": "R$ 5.000,00",
  "deadlineDate": "2026-12-31",
  "applicationEmail": "vagas@empresa.com",
  "applicationWhatsApp": "11999999999",
  "externalApplicationInstructions": "Envie seu CV com o assunto XPTO.",
  
  // Datas Reais
  "sourcePublishedAt": "2026-08-14T00:00:00-03:00",
  "lastVerifiedAt": "2026-08-19T10:00:00-03:00",
  
  // 🔥 CAMPOS DE GERENCIAMENTO (IA)
  "isTalentPool": false,
  "isFlagged": true,
  "flagReason": "SOURCE_NOT_FOUND",
  "flagObservation": "A vaga não está mais disponível no site de origem."
}
```

---

## 🚨 Regras de Moderação e Sinalização para a IA

1. **Separação de Empresa vs Portal:** Sempre separe `companyName` do `sourceName`. Ex: Se a fonte for Indeed, `sourceName="Indeed"` e `companyName="Nome da Empresa que contratou"`.
2. **IDs únicos:** Sempre envie `sourceExternalId` se houver um código de vaga na origem (ex: código MTE).
3. **Verificação (Routine):** Sempre que fizer a varredura, envie a constatação no endpoint `/verification` para manter a data de `lastVerifiedAt` atualizada e exibir no frontend "Verificado há 2 dias".
4. **Banco de Talentos:** Se for apenas para captação, envie `"isTalentPool": true`.
