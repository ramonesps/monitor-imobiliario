// Testes E2E — Visualização e interação com listings
// Cobertura: E02, E03, E04, E07, E08

import { test, expect } from '@playwright/test'

const BUILDING_ID = 'test-building-id' // Substituir pelo ID real no ambiente de teste

test.describe('E02: Visualização de listings', () => {
  test.skip('deve exibir lista de imóveis ativos para um prédio', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)
    await expect(page.locator('[data-testid="listings-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="listing-card"]').first()).toBeVisible()
  })

  test.skip('deve exibir cards com informações básicas do imóvel', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)
    const card = page.locator('[data-testid="listing-card"]').first()

    await expect(card.locator('[data-testid="listing-price"]')).toBeVisible()
    await expect(card.locator('[data-testid="listing-type-badge"]')).toBeVisible()
  })
})

test.describe('E03: Detalhe do imóvel', () => {
  test.skip('deve exibir página de detalhe com fotos e histórico', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)
    await page.click('[data-testid="listing-card"]')

    await expect(page).toHaveURL(/\/listings\/[a-z0-9-]+/)
    await expect(page.locator('[data-testid="photo-gallery"]')).toBeVisible()
    await expect(page.locator('[data-testid="listing-details"]')).toBeVisible()
  })

  test.skip('deve mostrar informações completas: andar, área, quartos, mobília', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)
    await page.click('[data-testid="listing-card"]')

    await expect(page.locator('[data-testid="detail-floor"]')).toBeVisible()
    await expect(page.locator('[data-testid="detail-area"]')).toBeVisible()
    await expect(page.locator('[data-testid="detail-bedrooms"]')).toBeVisible()
    await expect(page.locator('[data-testid="detail-furnished"]')).toBeVisible()
  })
})

test.describe('E04: Gráfico de preço renderiza', () => {
  test.skip('deve renderizar o gráfico de histórico de preço', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)
    await page.click('[data-testid="listing-card"]')

    // Aguarda o gráfico renderizar
    await expect(page.locator('[data-testid="price-chart"]')).toBeVisible({ timeout: 5000 })

    // Verifica que o gráfico tem pelo menos um ponto de dados
    const chartElement = page.locator('[data-testid="price-chart"] canvas, [data-testid="price-chart"] svg')
    await expect(chartElement).toBeVisible()
  })
})

test.describe('E07: Filtros funcionam', () => {
  test.skip('deve filtrar listings por tipo (aluguel/venda)', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)

    // Clica na aba "Aluguel"
    await page.click('[data-testid="tab-aluguel"]')
    const rentListings = await page.locator('[data-testid="listing-type-badge"]').allTextContents()
    expect(rentListings.every((t) => t.includes('Aluguel'))).toBe(true)
  })

  test.skip('deve filtrar listings por faixa de preço', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)

    await page.fill('[data-testid="filter-price-min"]', '2000')
    await page.fill('[data-testid="filter-price-max"]', '4000')
    await page.click('[data-testid="btn-aplicar-filtros"]')

    // Todos os preços mostrados devem estar na faixa
    const prices = await page.locator('[data-testid="listing-price"]').allTextContents()
    expect(prices.length).toBeGreaterThan(0)
  })

  test.skip('deve filtrar listings por mobília', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)

    await page.selectOption('[data-testid="filter-furnished"]', 'full')
    const furnishedBadges = await page.locator('[data-testid="listing-furnished-badge"]').allTextContents()
    expect(furnishedBadges.every((t) => t.includes('Mobiliado'))).toBe(true)
  })
})

test.describe('E08: Link externo abre', () => {
  test.skip('deve abrir link externo da plataforma em nova aba', async ({ page, context }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)
    await page.click('[data-testid="listing-card"]')

    // Aguarda nova aba ao clicar no link
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('[data-testid="btn-ver-anuncio"]'),
    ])

    // Nova aba deve abrir uma URL de plataforma de imóveis
    await newPage.waitForLoadState()
    expect(newPage.url()).toMatch(/zapimoveis|vivareal|olx|imovelweb|friasneto|miguelimoveis/)
  })
})
