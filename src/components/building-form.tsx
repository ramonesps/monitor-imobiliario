'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface BuildingFormProps {
  onSuccess: () => void
}

export function BuildingForm({ onSuccess }: BuildingFormProps) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [searchTerms, setSearchTerms] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          searchTerms: searchTerms
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao cadastrar prédio')
      }

      setName('')
      setAddress('')
      setSearchTerms('')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Adicionar prédio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Nome do prédio</Label>
            <Input
              id="name"
              placeholder="Ex: Residencial Aurora"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Endereço completo</Label>
            <Input
              id="address"
              placeholder="Ex: Rua das Flores, 500, Campinas SP"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="searchTerms">
              Termos alternativos de busca{' '}
              <span className="text-muted-foreground">(separados por vírgula)</span>
            </Label>
            <Input
              id="searchTerms"
              placeholder="Ex: Aurora, Flores 500, Condomínio Aurora"
              value={searchTerms}
              onChange={(e) => setSearchTerms(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Cadastrar prédio'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
