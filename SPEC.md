# Monitor Imobiliário — Spec Completa para Claude Code

## 1. Visão geral

Sistema web pessoal que monitora anúncios de imóveis (venda e aluguel) em um prédio específico, coletando dados de múltiplas plataformas diariamente. Uso pessoal + 1-2 amigos.

---

## 2. Decisões de infra

| Item | Decisão |
|---|---|
| Hospedagem | Oracle Cloud Free Tier (VM ARM, 4 vCPU, 24GB RAM, 200GB disco) |
| App | Next.js 14+ (App Router) — frontend + API + cron no mesmo processo |
| Banco | SQLite via Drizzle ORM (arquivo no disco da VM) |
| Scraping | Playwright (headless Chromium) + Cheerio para parsing |
| Scheduler | node-cron rodando no mesmo processo Node |
| Fotos | Salvar no disco local da VM |
| Comparação de imagens | Sharp (perceptual hash) + hamming distance |
| HTTPS | Let's Encrypt ou Cloudflare Tunnel |
| Custo | $0/mês |

---

## 3. Plataformas de scraping

### Ordem de implementação:
1. **ZAP Imóveis** (zapimoveis.com.br) — maior base BR, venda + aluguel
2. **VivaReal** (vivareal.com.br) — mesma empresa do ZAP, compartilha anúncios
3. **OLX** (olx.com.br) — complementa com particulares
4. **ImovelWeb** (imovelweb.com.br) — cobertura adicional
5. **Frias Neto** (friasneto.com.br) — imobiliária local, scraper custom
6. **Miguel Imóveis** (miguelimoveis.com.br) — imobiliária local, scraper custom

### Interface do scraper (cada plataforma implementa):
```typescript
interface PlatformScraper {
  name: string;
  search(buildingName: string, address: string): Promise<RawListing[]>;
}

interface RawListing {
  externalId: string;
  externalUrl: string;
  platform: string;
  type: 'sale' | 'rent';
  price: number;
  floor?: string;
  area?: number;
  bedrooms?: number;
  furnished: 'full' | 'partial' | 'none' | 'unknown';
  description: string;
  agencyName?: string;
  photoUrls: string[];
}
```

---

## 4. Modelo de dados

### buildings
| Campo | Tipo |
|---|---|
| id | TEXT PK (UUID) |
| name | TEXT NOT NULL |
| address | TEXT NOT NULL |
| search_terms | TEXT (JSON array de termos alternativos) |
| created_at | TEXT (ISO timestamp) |

### listings
| Campo | Tipo |
|---|---|
| id | TEXT PK (UUID) |
| building_id | TEXT FK |
| type | TEXT ('sale' ou 'rent') |
| unit_fingerprint | TEXT (hash para dedup rápido) |
| floor | TEXT |
| area | REAL |
| bedrooms | INTEGER |
| price_current | REAL |
| price_original | REAL |
| furnished | TEXT ('full', 'partial', 'none', 'unknown') |
| description | TEXT |
| status | TEXT ('active', 'inactive', 'pending_review') |
| first_seen_at | TEXT (ISO date) |
| last_seen_at | TEXT (ISO date) |
| deactivated_at | TEXT (ISO date, nullable) |
| days_on_market | INTEGER (calculado) |
| created_at | TEXT (ISO timestamp) |

### listing_sources
| Campo | Tipo |
|---|---|
| id | TEXT PK (UUID) |
| listing_id | TEXT FK |
| platform | TEXT |
| agency_name | TEXT |
| external_url | TEXT |
| external_id | TEXT |
| first_seen_at | TEXT |
| last_seen_at | TEXT |

### price_history
| Campo | Tipo |
|---|---|
| id | TEXT PK (UUID) |
| listing_id | TEXT FK |
| price | REAL |
| source_id | TEXT FK |
| recorded_at | TEXT |

### listing_photos
| Campo | Tipo |
|---|---|
| id | TEXT PK (UUID) |
| listing_id | TEXT FK |
| url_original | TEXT |
| local_path | TEXT |
| phash | TEXT (perceptual hash 64-bit) |
| order_index | INTEGER |

### duplicate_reviews
| Campo | Tipo |
|---|---|
| id | TEXT PK (UUID) |
| listing_a_id | TEXT FK |
| listing_b_id | TEXT FK |
| similarity_score | REAL |
| status | TEXT ('pending', 'confirmed_same', 'confirmed_different') |
| created_at | TEXT |

---

## 5. Fluxo do scraper (job diário)

```
1. Para cada building cadastrado:
   a. Montar queries de busca (name + address + search_terms)
   b. Para cada plataforma habilitada:
      - Buscar listagens com Playwright
      - Extrair dados via interface RawListing
      - Tratar erros por plataforma (se uma falha, continua nas demais)
   c. Para cada anúncio encontrado:
      - Checar se external_url já existe em listing_sources → só atualizar last_seen_at
      - Gerar perceptual hash das fotos (baixar + Sharp)
      - Comparar com listings existentes do mesmo building:
        * Fingerprint match (andar + preço ±10% + tipo) = filtro rápido
        * Phash: hamming distance < 10 (de 64 bits) = provável mesmo imóvel
      - Se match >= 90%: vincular como nova source do listing existente
      - Se match 60-89%: criar duplicate_review (pending)
      - Se match < 60%: criar novo listing
      - Se preço mudou: registrar em price_history
   d. Para listings ativos não encontrados hoje em nenhuma source:
      - Ausente 1 dia: manter ativo
      - Ausente 2+ dias: marcar inactive, setar deactivated_at
      - Calcular days_on_market = deactivated_at - first_seen_at
```

---

## 6. Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| POST | /api/buildings | Cadastrar prédio (name, address, search_terms) |
| GET | /api/buildings | Listar prédios |
| GET | /api/buildings/:id | Detalhe de um prédio |
| GET | /api/buildings/:id/listings | Listar imóveis (filtros: type, status, furnished, price_min, price_max) |
| GET | /api/listings/:id | Detalhe de um imóvel (inclui sources, photos, price_history) |
| GET | /api/duplicate-reviews | Listar duplicatas pendentes |
| POST | /api/duplicate-reviews/:id | Resolver: { action: 'same' | 'different' } |
| POST | /api/scraper/run | Trigger manual (opcional: platform filter) |
| GET | /api/stats/:building_id | Estatísticas (média, mediana, min, max preço, tempo médio mercado) |

---

## 7. Estrutura de pastas

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Dashboard (lista de prédios)
│   │   ├── buildings/
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Prédio: stats + lista de imóveis
│   │   ├── listings/
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Detalhe do imóvel
│   │   ├── reviews/
│   │   │   └── page.tsx                # Revisão de duplicatas
│   │   └── api/
│   │       ├── buildings/
│   │       │   └── route.ts
│   │       ├── buildings/[id]/
│   │       │   ├── route.ts
│   │       │   └── listings/route.ts
│   │       ├── listings/[id]/
│   │       │   └── route.ts
│   │       ├── duplicate-reviews/
│   │       │   └── route.ts
│   │       ├── scraper/
│   │       │   └── run/route.ts
│   │       └── stats/[buildingId]/
│   │           └── route.ts
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts              # Drizzle schema (todas as tabelas)
│   │   │   ├── index.ts               # Conexão SQLite
│   │   │   └── migrations/
│   │   ├── scraper/
│   │   │   ├── platforms/
│   │   │   │   ├── base.ts            # Interface PlatformScraper
│   │   │   │   ├── zap.ts
│   │   │   │   ├── vivareal.ts
│   │   │   │   ├── olx.ts
│   │   │   │   ├── imovelweb.ts
│   │   │   │   ├── frias-neto.ts
│   │   │   │   └── miguel-imoveis.ts
│   │   │   ├── dedup.ts               # Lógica de deduplicação (fingerprint + phash)
│   │   │   ├── phash.ts               # Perceptual hashing com Sharp
│   │   │   ├── photo-downloader.ts    # Baixar e salvar fotos
│   │   │   └── runner.ts              # Orquestrador: roda todas plataformas + dedup
│   │   ├── cron.ts                    # node-cron setup (roda runner diariamente)
│   │   └── utils/
│   │       └── id.ts                  # UUID generator
│   ├── components/
│   │   ├── listing-card.tsx
│   │   ├── price-chart.tsx
│   │   ├── stats-panel.tsx
│   │   ├── duplicate-review-card.tsx
│   │   ├── building-form.tsx
│   │   ├── photo-gallery.tsx
│   │   └── filters.tsx
│   └── types/
│       └── index.ts
├── data/                               # SQLite DB + fotos (gitignore)
│   ├── monitor.db
│   └── photos/
├── drizzle.config.ts
├── package.json
├── Dockerfile                          # Para deploy na Oracle Cloud
└── docker-compose.yml
```

---

## 8. Telas da interface (referência dos mockups)

### 8.1 Dashboard do prédio (tela principal)
- Header: nome do prédio + endereço + botão "Atualizar agora"
- Alerta de duplicatas pendentes (se houver)
- 4 cards de stats: anúncios ativos, aluguel médio, venda médio/m², tempo médio no mercado
- Tabs: Todos / Aluguel / Venda / Inativos
- Filtros: andar, mobília, preço alterado
- Lista de imóveis: thumb de foto, badges (tipo + plataformas), andar/área/quartos, preço + variação, dias no mercado, imobiliária

### 8.2 Detalhe do imóvel
- Galeria de fotos
- Dados: andar, área, quartos, mobília, primeiro anúncio, dias no mercado
- Gráfico de histórico de preço (line chart)
- Lista de fontes: plataforma + imobiliária + link externo + status
- Timeline de alterações (preço, nova source, detecção)

### 8.3 Revisão de duplicatas
- Cards lado a lado: Anúncio A vs Anúncio B
- Fotos mini de cada um
- Comparação de campos (preço, andar, área, mobília, imobiliária)
- Score de similaridade + detalhes (hamming distance, diferença de preço)
- Botões: "São diferentes" / "É o mesmo imóvel — unificar"

### 8.4 Cadastro de prédio
- Form: nome do prédio, endereço completo, termos alternativos de busca

---

## 9. Lista de testes

### Unitários (10)
- U01: phash generation — hash de imagem conhecida
- U02: phash comparison — mesmo imóvel → distance < 10
- U03: phash different — imóveis distintos → distance > 30
- U04: fingerprint generation — mesmo andar+preço+tipo → mesmo hash
- U05: price change detection — preço novo ≠ anterior → cria history
- U06: days on market — deactivated_at - first_seen_at
- U07: furnished parsing — "Mobiliado" → full, "Semi" → partial
- U08: floor extraction — "12º andar" → "12"
- U09: dedup score — match perfeito=100%, parcial=60-89%, nenhum=<60%
- U10: status transition — active → inactive após 2 dias ausente

### Integração (13)
- I01-I06: scraper de cada plataforma (mock HTML → campos corretos)
- I08: novo listing flow completo
- I09: update listing com preço novo
- I10: deactivation flow
- I11: dedup merge (mesmo imóvel, 2 plataformas → 1 listing, 2 sources)
- I12: dedup review (score ambíguo → pending)
- I13: API CRUD + filtros

### E2E (8)
- E01: cadastro de prédio
- E02: visualização de listings
- E03: detalhe do imóvel com fotos e histórico
- E04: gráfico de preço renderiza
- E05: revisão de duplicata (merge)
- E06: trigger manual do scraper
- E07: filtros funcionam
- E08: link externo abre

### Resiliência (5)
- R01: plataforma fora do ar → continua nas demais
- R02: HTML mudou (seletores quebrados) → log, não crash
- R03: foto 404 → pula, continua
- R04: rate limiting → retry com backoff
- R05: cron roda 2x no dia → idempotente

---

## 10. Docker para Oracle Cloud

```dockerfile
FROM node:20-slim
RUN npx playwright install --with-deps chromium
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
VOLUME /app/data
EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  monitor:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/monitor.db
      - PHOTOS_DIR=/app/data/photos
      - CRON_SCHEDULE=0 6 * * *  # 6h da manhã
```
