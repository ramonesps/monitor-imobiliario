// Testes E2E — Revisão de duplicatas
// Cobertura: E05

import { test, expect } from '@playwright/test'

test.describe('E05: Revisão de duplicata (merge)', () => {
  test.skip('deve exibir a página de revisão de duplicatas', async ({ page }) => {
    await page.goto('/reviews')
    await expect(page.locator('[data-testid="reviews-page"]')).toBeVisible()
  })

  test.skip('deve mostrar cards lado a lado para revisão', async ({ page }) => {
    await page.goto('/reviews')

    // Assume que há pelo menos uma duplicata pendente
    await expect(page.locator('[data-testid="review-card"]').first()).toBeVisible()
    await expect(page.locator('[data-testid="listing-a"]')).toBeVisible()
    await expect(page.locator('[data-testid="listing-b"]')).toBeVisible()
  })

  test.skip('deve exibir score de similaridade', async ({ page }) => {
    await page.goto('/reviews')

    const scoreElement = page.locator('[data-testid="similarity-score"]').first()
    await expect(scoreElement).toBeVisible()

    const scoreText = await scoreElement.textContent()
    expect(scoreText).toMatch(/\d+%/)
  })

  test.skip('deve permitir marcar como "São diferentes"', async ({ page }) => {
    await page.goto('/reviews')

    const initialCount = await page.locator('[data-testid="review-card"]').count()
    await page.click('[data-testid="btn-sao-diferentes"]')

    // Card deve ser removido da lista após resolução
    const newCount = await page.locator('[data-testid="review-card"]').count()
    expect(newCount).toBeLessThan(initialCount)
  })

  test.skip('deve unificar listings ao clicar em "É o mesmo imóvel"', async ({ page }) => {
    await page.goto('/reviews')

    // Captura IDs antes do merge
    const listingAId = await page.locator('[data-testid="listing-a"]').getAttribute('data-listing-id')
    const listingBId = await page.locator('[data-testid="listing-b"]').getAttribute('data-listing-id')

    await page.click('[data-testid="btn-mesmo-imovel"]')

    // Deve redirecionar para o listing unificado
    await expect(page).toHaveURL(/\/listings\/[a-z0-9-]+/)
  })
})
