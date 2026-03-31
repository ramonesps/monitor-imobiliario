'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { GitMerge, X } from 'lucide-react'

interface ReviewActionsProps {
  reviewId: string
}

export function ReviewActions({ reviewId }: ReviewActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<'same' | 'different' | null>(null)

  async function resolve(action: 'same' | 'different') {
    setLoading(action)
    try {
      const res = await fetch(`/api/duplicate-reviews/${reviewId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Erro ao resolver revisão')
        return
      }
      router.refresh()
    } catch {
      alert('Erro de conexão')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-2 mt-4">
      <Button
        variant="outline"
        className="flex-1 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
        onClick={() => resolve('different')}
        disabled={loading !== null}
      >
        <X className="h-4 w-4 mr-2" />
        {loading === 'different' ? 'Salvando...' : 'São diferentes'}
      </Button>
      <Button
        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
        onClick={() => resolve('same')}
        disabled={loading !== null}
      >
        <GitMerge className="h-4 w-4 mr-2" />
        {loading === 'same' ? 'Unificando...' : 'É o mesmo imóvel — unificar'}
      </Button>
    </div>
  )
}
