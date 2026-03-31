// Executado uma vez na inicialização do servidor Next.js
// Cria as tabelas do banco se não existirem
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDb } = await import('./lib/db')
    await initDb()
  }
}
