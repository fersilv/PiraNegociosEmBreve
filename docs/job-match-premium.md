# Match premium de vagas

## Problema atual

A tela `user/vagas` calcula a compatibilidade localmente no frontend, sem usar como fonte principal o endpoint de matching por IA do backend.

O cálculo atual aceita sobreposição parcial de palavras em cargos como evidência forte demais. Exemplo: cargos diferentes que compartilham somente `Operador` podem receber similaridade alta e, em vagas sem skills estruturadas, o peso de cargo sozinho pode gerar aproximadamente 45 pontos.

Uma pontuação paga não pode usar essa régua.

## Princípios da nova pontuação

A compatibilidade deve explicar aderência profissional, não semelhança textual.

Dimensões sugeridas:

- 35% aderência ocupacional / família de cargo
- 30% requisitos técnicos e competências essenciais
- 20% evidência na experiência profissional
- 10% formação, cursos e certificações quando pertinentes
- 5% preferências objetivas, como modelo/localidade, sem transformar localização em competência profissional

Competências comportamentais genéricas não podem, sozinhas, produzir compatibilidade média ou alta.

## Regras de segurança da nota

- Sem evidência ocupacional nem técnica relevante: máximo 20/100.
- Apenas palavras genéricas de cargo em comum, como `operador`, `auxiliar`, `assistente`, `analista`, não comprovam aderência.
- Requisito obrigatório ausente deve aparecer explicitamente como lacuna e pode impor teto à nota.
- Skill comportamental genérica não pode compensar ausência de requisito técnico central.
- A IA nunca deve inferir curso, habilitação, experiência, certificação ou competência que não esteja no currículo.
- A nota deve ser acompanhada de evidências e lacunas, não apenas de um percentual.

## Saída esperada

```json
{
  "score": 18,
  "occupationalScore": 5,
  "technicalScore": 10,
  "experienceScore": 15,
  "educationScore": 40,
  "preferenceScore": 100,
  "confidence": "HIGH",
  "evidence": ["..."],
  "missingRequirements": ["Experiência com colhedora"],
  "reason": "O perfil não apresenta experiência ou competências técnicas relacionadas à operação de colhedoras."
}
```

## Casos de teste obrigatórios

1. Candidato administrativo x Operador de Colhedora: deve permanecer em compatibilidade baixa, mesmo que ambos os textos contenham termos genéricos como operação, equipe, segurança ou atendimento.
2. Operador de Caixa x Operador de Colhedora: compartilhar `Operador` não deve produzir aderência ocupacional relevante.
3. Operador de Máquinas Agrícolas x Operador de Colhedora: pode existir aderência parcial/alta dependendo das experiências, equipamentos e requisitos comprovados.
4. Vaga que exige CNH/certificação específica ausente: a ausência deve ser mostrada e limitar a nota.
5. Candidato com muitas soft skills e nenhuma competência técnica da vaga: a nota não deve ultrapassar a faixa baixa.

## Produto premium proposto

Nome provisório: **Match Inteligente 30 dias**.

Preço inicial para teste: **R$ 2,99 por 30 dias**, administrável pelo painel. O produto não deve ser ativado antes da validação da nova régua.

### Gratuito

- continuar vendo e pesquisando todas as vagas;
- recomendações básicas por localização, preferências e filtros;
- nenhuma vaga escondida por falta de pagamento.

### Premium

- percentual de compatibilidade confiável;
- explicação de por que combina;
- competências/requisitos comprovados que ajudaram na nota;
- requisitos importantes ausentes;
- filtro por compatibilidade;
- ranking inteligente personalizado.

## Viabilidade financeira

R$ 2,99/30 dias só é seguro se o matching for cacheado. Não devemos chamar IA novamente a cada abertura da tela.

A chave de cache deve considerar, no mínimo:

- usuário;
- fingerprint/versão do currículo analisado;
- vaga e versão/updatedAt da vaga;
- versão do algoritmo de matching.

O resultado só é recalculado quando currículo, vaga ou algoritmo mudar. Isso transforma o produto de `IA por pageview` em `IA por mudança relevante`, mantendo custo previsível.

## Ficha de Match fornecida pela API externa

Fontes que já usam IA para estruturar a vaga podem enviar opcionalmente `matchProfile` no `POST /v1/jobs`, no `PATCH /v1/jobs/:id` e, quando necessário, na verificação. Quando a ficha é válida, ela é persistida como `READY` com o fingerprint atual da vaga e evita uma nova chamada da IA interna.

O endpoint autenticado `GET /v1/jobs/match-profile-schema` devolve o schema e um exemplo atualizado para agentes de ingestão.

Estrutura aceita:

```json
{
  "matchProfile": {
    "canonicalRole": "Operador de Colhedora",
    "occupationalFamily": "Operação de máquinas agrícolas e colheita mecanizada",
    "occupationKeywords": ["colhedora", "máquinas agrícolas", "colheita mecanizada"],
    "technicalSkills": [
      {
        "name": "Operação de colhedora",
        "required": true,
        "weight": 2,
        "evidenceTerms": ["colhedora", "máquina de colheita"]
      }
    ],
    "requirements": [
      {
        "label": "Experiência com operação de colhedora",
        "type": "EXPERIENCE",
        "required": true,
        "weight": 2,
        "evidenceTerms": ["operação de colhedora", "colheita mecanizada"]
      }
    ],
    "softSkills": ["Trabalho em equipe"],
    "summary": "Perfil para operação segura de colhedoras e apoio à colheita mecanizada."
  }
}
```

`canonicalRole` e `occupationalFamily` são obrigatórios quando `matchProfile` for enviado. A ficha descreve somente a vaga. Ela nunca pode enviar ou definir score de candidato; a compatibilidade continua sendo calculada pelo PiraNegócios contra cada currículo.

Se a ficha externa for inválida, ela é rejeitada e o fluxo interno continua disponível como fallback. Em atualização de vaga ativa, a ficha fornecida é preparada antes do subscriber para evitar uma chamada duplicada quando for válida.

## Próximo passo técnico

Criar `job_match_results` com score estruturado, explicações, hashes/versões e timestamps. Depois substituir a nota local do frontend pelos resultados persistidos do backend e só então ativar o produto de 30 dias.
