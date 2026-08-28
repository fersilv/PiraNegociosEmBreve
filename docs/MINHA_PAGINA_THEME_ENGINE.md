# Minha Página: contrato de temas

A página pública da empresa é tratada como o site próprio da empresa dentro da infraestrutura do PiraNegócios.

## Regras

- O tema decide **como** o conteúdo é desenhado.
- A configuração da empresa decide **o que** aparece, **em qual ordem** e **com quais conteúdos**.
- Seções removidas ou desativadas não podem ser recriadas pelo renderer.
- `identity` é a única seção estrutural obrigatória no editor visual.
- `jobs` é opcional. Remover a seção não remove as vagas cadastradas.
- Temas devem consultar `CompanyThemeCapabilities` antes de expor controles específicos.
- Configurações antigas continuam sendo hidratadas sem migração destrutiva.
- A página pública não deve herdar identidade visual do portal PiraNegócios.
- A identificação da plataforma fica no rodapé padronizado, com a marca PiraNegócios.

## Famílias

O motor suporta famílias institucionais, comércio/loja, marketplace/classificados, serviços, gastronomia, moda e criativas.

## Novos modelos

- Marketplace
- Catálogo
- Classificados Pro
- Institucional Pro
- Serviços Pro

Além deles, Loja e os temas de referência passam pelo renderer flexível, que respeita ordem, visibilidade, categorias e dimensão de seção.
