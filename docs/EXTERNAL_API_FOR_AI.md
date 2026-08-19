# 🤖 Manual da API Externa para IA (Pira Negócios)

Este documento descreve as capacidades da API Externa (`v1/jobs`) do Pira Negócios, desenhada especificamente para que agentes autônomos (IAs) possam pesquisar, inserir e gerenciar vagas.

**URL Base:** `https://piranegocios.com.br/api` (ou a URL do seu ambiente)
**Autenticação:** Header `X-API-Key: <Sua-Chave>` em todas as requisições.

---

## 🛠️ O que você (IA) pode fazer?

Você tem total autonomia para **catalogar novas vagas externas**, **atualizar dados** e, o mais importante, **Sinalizar (Flag)** vagas antigas ou irregulares para revisão humana. Você **PODE** atualizar qualquer vaga externa no sistema, mesmo aquelas cadastradas por outras chaves de API, usando o método `PATCH /v1/jobs/:id`.

---

## 📍 Rotas Disponíveis

### 1. Checar Duplicidade
**`POST /v1/jobs/check`**
Antes de cadastrar uma vaga nova, envie o título e os detalhes para saber se ela já existe (busca semântica).
- **Body:** Mesmo payload de criação (ver abaixo).

### 2. Cadastrar Vaga
**`POST /v1/jobs`**
Insere uma nova vaga no painel.

### 3. Atualizar Vaga / Sinalizar Vaga
**`PATCH /v1/jobs/:id`**
Atualiza dados de uma vaga externa. **Use esta rota para fazer o gerenciamento (limpeza) de vagas.**

---

## 📦 Payload Suportado (Formato JSON)

Tanto o `POST` quanto o `PATCH` suportam os mesmos campos. Todos os campos são opcionais, exceto `title` e `description` na criação.

```json
{
  "title": "Desenvolvedor Backend Pleno",
  "description": "Texto longo descritivo da vaga e rotina...",
  "requirements": "Node.js, TypeScript, etc.",
  "location": "São Paulo, SP",
  "type": "Tempo Integral",
  "workModel": "Híbrido",
  "salary": "R$ 5.000,00",
  "sourceName": "LinkedIn",
  "sourceUrl": "https://linkedin.com/jobs/...",
  "deadlineDate": "2026-12-31",
  "applicationEmail": "vagas@empresa.com",
  "applicationWhatsApp": "11999999999",
  "externalApplicationInstructions": "Envie seu CV com o assunto XPTO.",
  
  // 🔥 CAMPOS ESPECIAIS DE GERENCIAMENTO (IA)
  "isTalentPool": false,
  "isFlagged": true,
  "flagObservation": "A vaga não está mais disponível no site de origem. Recomendo desativar."
}
```

---

## 🚨 Regras de Moderação e Sinalização para a IA

Como Agente, é seu papel manter a base de dados de vagas limpa. Se durante a sua varredura rotineira você identificar problemas em vagas do sistema (ex: erro no link original, vaga expirada, texto suspeito), você **NÃO DEVE** ignorar.

**Procedimento de Sinalização:**
1. Faça um `PATCH /v1/jobs/<id-da-vaga>`.
2. Envie `"isFlagged": true`.
3. Preencha `"flagObservation"` com o motivo exato pelo qual você está alertando o sistema. (Ex: *"Link fonte retorna 404"* ou *"Vaga expirada há mais de 3 meses"*).
4. O Administrador humano visualizará seu alerta no Dashboard e tomará a decisão de apagar ou desativar a vaga.

**Identificação de Banco de Talentos:**
Se a vaga rastreada for especificamente um "Banco de Talentos" (sem contratação imediata, apenas captação de currículos), você DEVE enviar `"isTalentPool": true`. O frontend exibirá uma tag visual amigável avisando os candidatos.
