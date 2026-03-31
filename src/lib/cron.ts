// Configuração do cron job para execução diária do scraper
// Usa CRON_SCHEDULE env var (padrão: 6h da manhã)

import cron from 'node-cron'
import { runScraper } from './scraper/runner'

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 6 * * *'

let cronJob: cron.ScheduledTask | null = null

/**
 * Inicializa o cron job do scraper.
 * Deve ser chamado uma vez na inicialização da aplicação.
 */
export function initCron(): void {
  if (cronJob) {
    console.warn('[cron] Job já está rodando. Ignorando novo initCron().')
    return
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`[cron] CRON_SCHEDULE inválido: "${CRON_SCHEDULE}". Job não será agendado.`)
    return
  }

  console.log(`[cron] Agendando scraper com schedule: "${CRON_SCHEDULE}"`)

  cronJob = cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[cron] Iniciando execução agendada do scraper...')
    try {
      const results = await runScraper()
      const success = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success).length
      console.log(`[cron] Scraper concluído. ${success} sucessos, ${failed} falhas.`)
    } catch (error) {
      console.error('[cron] Erro crítico na execução do scraper:', error)
    }
  })

  console.log('[cron] Job agendado com sucesso.')
}

/**
 * Para o cron job (útil para testes e graceful shutdown).
 */
export function stopCron(): void {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    console.log('[cron] Job parado.')
  }
}
