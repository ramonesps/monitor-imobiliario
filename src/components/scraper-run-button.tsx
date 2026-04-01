'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

/** Converte erros técnicos em mensagem curta legível (hover mostra mensagem completa) */
function friendlyError(error?: string): string {
  if (!error) return 'erro'
  if (error.includes("Executable doesn't exist") || error.includes('browserType.launch')) {
    return 'Chromium não instalado'
  }
  if (error.includes('net::ERR') || error.includes('timeout')) return 'timeout/rede'
  if (error.includes('429') || error.includes('rate limit')) return 'rate limit'
  return error.slice(0, 30)
}

interface ScraperResult {
  platform: string
  success: boolean
  newListings: number
  updatedListings: number
  deactivatedListings: number
  error?: string
}

interface ScraperRunButtonProps {
  buildingId: string
}

export function ScraperRunButton({ buildingId }: ScraperRunButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ScraperResult[] | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  async function handleRun() {
    setLoading(true)
    setResults(null)
    setShowDetails(false)
    try {
      const res = await fetch('/api/scraper/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingIds: [buildingId] }),
      })
      const data = await res.json()
      if (Array.isArray(data.results)) {
        setResults(data.results)
        setShowDetails(true)
      }
      // Recarrega os dados da página após a atualização
      router.refresh()
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const successCount = results?.filter((r) => r.success).length ?? 0
  const failCount = results?.filter((r) => !r.success).length ?? 0

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="outline" size="sm" onClick={handleRun} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Atualizando...' : 'Atualizar agora'}
      </Button>

      {results !== null && (
        <div>
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {failCount === 0 ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className="text-green-600 font-medium">{successCount} ok</span>
            {failCount > 0 && (
              <span className="text-red-600 font-medium">{failCount} erro</span>
            )}
            {showDetails ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {showDetails && (
            <div className="mt-1.5 rounded-md border bg-card p-2.5 space-y-1.5 min-w-[220px]">
              {results.map((r) => (
                <div key={r.platform} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    {r.success ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    <span className="font-medium">{r.platform}</span>
                  </div>
                  {r.success ? (
                    <span className="text-muted-foreground">
                      +{r.newListings} novo · ↻{r.updatedListings} atual
                    </span>
                  ) : (
                    <span
                      className="text-red-500 cursor-help"
                      title={r.error}
                    >
                      {friendlyError(r.error)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
