# Marketplace modular multicanal (10/11/2026)

## Entregue
- Schema `marketplace` no PostgreSQL PiraNegócios, com módulos, canais, anúncios especializados e projeção pública de locações.
- `marketplace.public_catalog` combina **em tempo real** os anúncios já publicados nos Classificados PiraNegócios com as projeções especializadas, sem replicar o catálogo legado.
- GET `/api/classifieds/catalog/modules` descreve módulos, estados e filtros previstos.
- GET `/api/classifieds/catalog?channel=piranegocios|splash&module=...` retorna exclusivamente itens publicados no canal permitido. Filtros implementados: q, city, state, category, minPrice, maxPrice, guests, amenities.
- A Splash continua com reservas, calendários, planos, faturamento e moderação no seu banco.
- `backend/scripts/sync-splash-catalog.cjs`: sincronização idempotente sob demanda de propriedades publicadas e aprovadas da Splash. **Agendada via systemd a cada 2 minutos na VPS-Fainde**. Revoga anúncios despublicados/removidos. Fotos só são importadas quando têm caminho relativo.
- Endpoints existentes `/api/classifieds/listings` e `/api/classifieds/splash` permanecem operacionais.

## Não entregue ainda
- Migração integral das tabelas transacionais da Splash, cutover do banco Splash e migração de assinaturas; exigem migração reversível e testes de operação e pagamento.
- Filtro por datas disponível: por segurança rejeita consultas de data até ser ligado à disponibilidade autoritativa da Splash.
- Módulos e aplicações veículos, imóveis, serviços, restaurantes: registrados **desabilitados**, sem DNS/provisionamento/UI.
- Integrações externas/Rapi10 ainda usam contratos existentes; catálogo modular não os substituiu.
- Autorização por aplicativo/M2M, planos multi-módulo, editores especializados e painel de gestão unificado.

## Operação
1. Executar migrations em ordem: `20261110_marketplace_modular_core.sql`, `20261110_marketplace_legacy_catalog_view.sql`.
2. Sincronizar catálogo da Splash: `node backend/scripts/sync-splash-catalog.cjs` a partir da raiz do projeto (a ferramenta requer os dois bancos no host e variáveis privadas nos arquivos existentes).
3. Validar `GET /api/classifieds/catalog` e `?channel=splash`, e regressão da API antiga.
4. Não ativar canais futuros enquanto seus módulos não tiverem operações e políticas próprias.

A configuração de publicação *não* depende apenas do parâmetro `channel`: o filtro exige canal público habilitado e autorização por anúncio. Aplicações com recursos privados exigirão autenticação específica e controle de escopos, ainda não implementados.

## Segunda entrega (10/11/2026, noite)
- O filtro de datas (`checkIn`, `checkOut`) da nova API consulta `GET /api/properties?start=&end=` na Splash em tempo real, antes da paginação. Períodos inválidos e falhas de disponibilidade não produzem resultados falsamente disponíveis.
- A vitrine `SplashListingsSection` usa `/api/classifieds/catalog?module=rentals&channel=piranegocios` e recebeu campos de entrada, saída, hóspedes e comodidades.
- A sincronização agora consulta a listagem pública da Splash, que aplica as regras de aprovação e elegibilidade do anfitrião; não lê mais anúncios diretamente da tabela bruta.
- API, vitrine e serviços systemd reiniciados e verificados em produção.
- Limitação conhecida: a listagem de origem retorna no máximo 80 propriedades. A sincronização não arquiva ausentes quando a página está cheia. Próximo passo: paginação autenticada ou evento incremental para escalabilidade.
- A filtragem por datas é um indicador para pesquisa, não um bloqueio de calendário: a reserva definitiva continua validada pela Splash.
