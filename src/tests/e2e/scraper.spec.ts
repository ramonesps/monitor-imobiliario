// Testes E2E — Trigger manual do scraper
// Cobertura: E06

import { test, expect } from '@playwright/test'

const BUILDING_ID = 'test-building-id'

test.describe('E06: Trigger manual do scraper', () => {
  test.skip('deve exibir botão "Atualizar agora" no dashboard', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)
    await expect(page.locator('[data-testid="btn-atualizar-agora"]')).toBeVisible()
  })

  test.skip('deve iniciar o scraper ao clicar em "Atualizar agora"', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)
    await page.click('[data-testid="btn-atualizar-agora"]')

    // Deve mostrar indicador de carregamento
    await expect(page.locator('[data-testid="scraper-loading"]')).toBeVisible({ timeout: 3000 })
  })

  test.skip('deve mostrar resultado do scraper ao finalizar', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)
    await page.click('[data-testid="btn-atualizar-agora"]')

    // Aguarda conclusão (pode demorar)
    await expect(page.locator('[data-testid="scraper-result"]')).toBeVisible({ timeout: 60000 })

    const resultText = await page.locator('[data-testid="scraper-result"]').textContent()
    expect(resultText).toMatch(/(\d+ novo|atualizado|concluído)/i)
  })

  test.skip('deve permitir filtrar por plataforma específica', async ({ page }) => {
    await page.goto(`/buildings/${BUILDING_ID}`)

    // Seleciona apenas ZAP
    await page.selectOption('[data-testid="select-plataforma"]', 'zap')
    await page.click('[data-testid="btn-atualizar-agora"]')

    await expect(page.locator('[data-testid="scraper-loading"]')).toBeVisible({ timeout: 3000 })
  })
})
