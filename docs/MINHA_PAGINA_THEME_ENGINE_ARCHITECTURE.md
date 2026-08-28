# Roteamento de renderização

`CompanySiteRenderer` é a fachada pública única.

- modo `code`: renderer legado isolado;
- temas institucionais maduros (`aurora`, `atlas`, `pulse`, `canvas`, `noir`): renderer institucional existente;
- Loja, temas de referência e novos modelos: `FlexibleCompanyThemeRenderer`;
- todos os caminhos terminam no mesmo rodapé de integração.

Esse desenho permite evoluir a apresentação sem criar regras concorrentes para a composição da página.
