# Notas de compatibilidade

A implementação mantém o formato de `CompanyPageConfig` já persistido. Não há migração destrutiva de dados.

O Studio V3 hidrata configurações antigas e só adiciona defaults em memória quando campos não existem. A seção de identidade é garantida por ser estrutural; as demais seções são opcionais.

Os builders V2, Premium e WhiteLabel permanecem no código para referência e rollback. `pages/CompanyPageBuilder.tsx` passa a apontar para o Studio V3.

O renderer institucional existente é mantido para os cinco temas institucionais já maduros. Loja, novos modelos e temas de referência usam o renderer flexível para garantir o mesmo contrato de ordem, visibilidade e dimensionamento.
