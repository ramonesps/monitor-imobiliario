'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface BuildingFormProps {
  onSuccess: () => void
  /** Quando passado, exibe o formulário em modo de edição */
  initialData?: {
    id: string
    name: string
    address: string
    city: string | null
    searchTerms: string[]
    areaMin: number | null
    areaMax: number | null
    rentPriceMin: number | null
    rentPriceMax: number | null
    salePriceMin: number | null
    salePriceMax: number | null
  }
}

export function BuildingForm({ onSuccess, initialData }: BuildingFormProps) {
  const isEditing = !!initialData

  const [name, setName] = useState(initialData?.name ?? '')
  const [address, setAddress] = useState(initialData?.address ?? '')
  const [city, setCity] = useState(initialData?.city ?? '')
  const [searchTerms, setSearchTerms] = useState(initialData?.searchTerms.join(', ') ?? '')
  const [areaMin, setAreaMin] = useState(initialData?.areaMin?.toString() ?? '')
  const [areaMax, setAreaMax] = useState(initialData?.areaMax?.toString() ?? '')
  const [rentPriceMin, setRentPriceMin] = useState(initialData?.rentPriceMin?.toString() ?? '')
  const [rentPriceMax, setRentPriceMax] = useState(initialData?.rentPriceMax?.toString() ?? '')
  const [salePriceMin, setSalePriceMin] = useState(initialData?.salePriceMin?.toString() ?? '')
  const [salePriceMax, setSalePriceMax] = useState(initialData?.salePriceMax?.toString() ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const payload = {
      name: name.trim(),
      address: address.trim(),
      city: city.trim() || null,
      searchTerms: searchTerms
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      areaMin: areaMin ? Number(areaMin) : null,
      areaMax: areaMax ? Number(areaMax) : null,
      rentPriceMin: rentPriceMin ? Number(rentPriceMin) : null,
      rentPriceMax: rentPriceMax ? Number(rentPriceMax) : null,
      salePriceMin: salePriceMin ? Number(salePriceMin) : null,
      salePriceMax: salePriceMax ? Number(salePriceMax) : null,
    }

    try {
      const url = isEditing ? `/api/buildings/${initialData.id}` : '/api/buildings'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar prédio')
      }

      if (!isEditing) {
        setName('')
        setAddress('')
        setCity('')
        setSearchTerms('')
        setAreaMin('')
        setAreaMax('')
        setRentPriceMin('')
        setRentPriceMax('')
        setSalePriceMin('')
        setSalePriceMax('')
      }
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
        <CardTitle className="text-lg">
          {isEditing ? 'Editar prédio' : 'Adicionar prédio'}
        </CardTitle>
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
            <Label htmlFor="address">
              Endereço completo{' '}
              <span className="text-muted-foreground text-xs">(rua, número, bairro, CEP)</span>
            </Label>
            <Input
              id="address"
              placeholder="Ex: Rua das Flores, 500, Centro, 13010-000"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="city">
              Cidade{' '}
              <span className="text-muted-foreground text-xs">
                (filtra anúncios de outras cidades)
              </span>
            </Label>
            <Input
              id="city"
              placeholder="Ex: Campinas"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="searchTerms">
              Termos alternativos de busca{' '}
              <span className="text-muted-foreground text-xs">(separados por vírgula)</span>
            </Label>
            <Input
              id="searchTerms"
              placeholder="Ex: Aurora, Flores 500, Condomínio Aurora"
              value={searchTerms}
              onChange={(e) => setSearchTerms(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="areaMin">
                Área mín. (m²){' '}
                <span className="text-muted-foreground text-xs">opcional</span>
              </Label>
              <Input
                id="areaMin"
                type="number"
                min={0}
                placeholder="Ex: 50"
                value={areaMin}
                onChange={(e) => setAreaMin(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="areaMax">
                Área máx. (m²){' '}
                <span className="text-muted-foreground text-xs">opcional</span>
              </Label>
              <Input
                id="areaMax"
                type="number"
                min={0}
                placeholder="Ex: 120"
                value={areaMax}
                onChange={(e) => setAreaMax(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Filtro de preço — Aluguel{' '}
              <span className="font-normal normal-case">(opcional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rentPriceMin">Mínimo (R$)</Label>
                <Input
                  id="rentPriceMin"
                  type="number"
                  min={0}
                  placeholder="Ex: 1500"
                  value={rentPriceMin}
                  onChange={(e) => setRentPriceMin(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rentPriceMax">Máximo (R$)</Label>
                <Input
                  id="rentPriceMax"
                  type="number"
                  min={0}
                  placeholder="Ex: 5000"
                  value={rentPriceMax}
                  onChange={(e) => setRentPriceMax(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Filtro de preço — Venda{' '}
              <span className="font-normal normal-case">(opcional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="salePriceMin">Mínimo (R$)</Label>
                <Input
                  id="salePriceMin"
                  type="number"
                  min={0}
                  placeholder="Ex: 300000"
                  value={salePriceMin}
                  onChange={(e) => setSalePriceMin(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="salePriceMax">Máximo (R$)</Label>
                <Input
                  id="salePriceMax"
                  type="number"
                  min={0}
                  placeholder="Ex: 800000"
                  value={salePriceMax}
                  onChange={(e) => setSalePriceMax(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar prédio'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
