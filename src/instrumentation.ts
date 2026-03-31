// Executado uma vez na inicialização do servidor Next.js
// Cria as tabelas do banco e inicia o cron de scraping
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDb } = await import('./lib/db')
    await initDb()

    // Inicia o cron job apenas em produção para evitar scraping em dev
    if (process.env.NODE_ENV === 'production') {
      const { initCron } = await import('./lib/cron')
      initCron()
    }
  }
}
