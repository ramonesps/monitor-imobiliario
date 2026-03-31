# Monitor Imobiliário

## Sobre o projeto
Sistema web pessoal que monitora anúncios de imóveis (venda e aluguel) em prédios específicos, coletando dados de múltiplas plataformas diariamente via scraping. Uso pessoal + 1-2 amigos.

## Stack
- Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui
- SQLite via Drizzle ORM
- Playwright (headless Chromium) + Cheerio para scraping
- node-cron para agendamento
- Sharp para perceptual hash de imagens
- Deploy: Docker na Oracle Cloud Free Tier

## Spec completa
Ler o arquivo `SPEC.md` na raiz do projeto para modelo de dados, endpoints, fluxo do scraper, estrutura de pastas, plataformas e lista de testes.

## Convenções
- Português BR para interface e comentários
- UUIDs como IDs em todas as tabelas
- Datas em ISO 8601
- Scraper tolerante a falhas: se uma plataforma falha, continua nas demais
- Cada plataforma implementa a interface PlatformScraper definida em src/lib/scraper/platforms/base.ts

## Fases de implementação
1. Schema + CRUD buildings + Dashboard UI + scraper ZAP
2. Scraper OLX + ImovelWeb
3. Deduplicação (fingerprint + phash) + tela de revisão de duplicatas
4. Histórico de preço + detecção de inativos + gráficos
5. Scraper Frias Neto + Miguel Imóveis
6. Docker + deploy
