// Testes E2E — Cadastro de prédio
// Cobertura: E01

import { test, expect } from '@playwright/test'

// E01: Cadastro de prédio
test.describe('E01: Cadastro de prédio', () => {
  test.skip('deve abrir o formulário de cadastro de prédio', async ({ page }) => {
    // Requer servidor rodando em localhost:3000
    await page.goto('/')
    await page.click('[data-testid="btn-novo-predio"]')
    await expect(page.locator('[data-testid="form-predio"]')).toBeVisible()
  })

  test.skip('deve criar um prédio com nome, endereço e termos de busca', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="btn-novo-predio"]')

    await page.fill('[data-testid="input-nome"]', 'Edifício Central')
    await page.fill('[data-testid="input-endereco"]', 'Rua Augusta, 1000, São Paulo SP')
    await page.fill('[data-testid="input-termos"]', 'Central, Augusta 1000, Ed. Central')

    await page.click('[data-testid="btn-salvar-predio"]')

    // Deve redirecionar para o dashboard do prédio
    await expect(page).toHaveURL(/\/buildings\/[a-z0-9-]+/)
    await expect(page.locator('h1')).toContainText('Edifício Central')
  })

  test.skip('deve mostrar erro quando nome está vazio', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="btn-novo-predio"]')
    await page.fill('[data-testid="input-endereco"]', 'Rua Augusta, 1000')
    await page.click('[data-testid="btn-salvar-predio"]')

    await expect(page.locator('[data-testid="error-nome"]')).toBeVisible()
  })
})
