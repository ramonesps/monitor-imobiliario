// Executado uma vez na inicialização do servidor Next.js
// Cria as tabelas do banco e inicia o cron de scraping
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Verifica Playwright Chromium na inicialização e loga caminho real
    try {
      const { chromium } = await import('playwright')
      const execPath = chromium.executablePath()
      const fs = await import('fs')
      if (fs.existsSync(execPath)) {
        console.log(`[playwright] Chromium OK: ${execPath}`)
      } else {
        console.error(
          `[playwright] ATENÇÃO: Chromium NÃO encontrado em "${execPath}"\n` +
          `  PLAYWRIGHT_BROWSERS_PATH=${process.env.PLAYWRIGHT_BROWSERS_PATH ?? '(não definido)'}\n` +
          `  Execute: npx playwright install chromium\n` +
          (process.env.PLAYWRIGHT_BROWSERS_PATH
            ? `  Ou desative a variável PLAYWRIGHT_BROWSERS_PATH do ambiente.`
            : '')
        )
      }
    } catch (e) {
      console.warn('[playwright] Não foi possível verificar Chromium:', e)
    }

    const { initDb } = await import('./lib/db')
    await initDb()

    // Inicia o cron job apenas em produção para evitar scraping em dev
    if (process.env.NODE_ENV === 'production') {
      const { initCron } = await import('./lib/cron')
      initCron()
    }
  }
}
