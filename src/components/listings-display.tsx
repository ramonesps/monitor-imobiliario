'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, ArrowUp, ArrowDown, Clock, MapPin, AlertTriangle, Bath, Car } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Listing } from '@/types'

type SortField = 'price' | 'area' | 'date'
type SortDir = 'asc' | 'desc'

function formatPrice(price: number) {
  return price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

interface SortButtonProps {
  field: SortField
  label: string
  current: SortField
  dir: SortDir
  onClick: (f: SortField) => void
}

function SortButton({ field, label, current, dir, onClick }: SortButtonProps) {
  const isActive = current === field
  return (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      size="sm"
      className="h-7 text-xs gap-1 px-2"
      onClick={() => onClick(field)}
    >
      {label}
      {isActive ? (
        dir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </Button>
  )
}

interface ListingsDisplayProps {
  listings: Listing[]
  /** Cidade esperada do prédio (para destacar anúncios de outras cidades) */
  buildingCity?: string | null
}

function normalizeCity(city: string) {
  return city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export function ListingsDisplay({ listings, buildingCity }: ListingsDisplayProps) {
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = [...listings].sort((a, b) => {
    let av: number, bv: number
    if (sortField === 'price') {
      av = a.priceCurrent
      bv = b.priceCurrent
    } else if (sortField === 'area') {
      av = a.area ?? 0
      bv = b.area ?? 0
    } else {
      av = new Date(a.lastSeenAt).getTime()
      bv = new Date(b.lastSeenAt).getTime()
    }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  return (
    <div>
      <div className="flex items-center gap-1 mb-3">
        <span className="text-xs text-muted-foreground mr-1">Ordenar:</span>
        <SortButton
          field="price"
          label="Preço"
          current={sortField}
          dir={sortDir}
          onClick={handleSort}
        />
        <SortButton
          field="area"
          label="Área"
          current={sortField}
          dir={sortDir}
          onClick={handleSort}
        />
        <SortButton
          field="date"
          label="Data"
          current={sortField}
          dir={sortDir}
          onClick={handleSort}
        />
      </div>

      {sorted.length === 0 ? (
        <p className="text-center text-muted-foreground py-10 text-sm">
          Nenhum anúncio nesta categoria.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((listing) => (
            <Link key={listing.id} href={`/listings/${listing.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={listing.type === 'rent' ? 'rent' : 'sale'}>
                          {listing.type === 'rent' ? 'Aluguel' : 'Venda'}
                        </Badge>
                        {listing.status === 'inactive' && (
                          <Badge variant="inactive">Inativo</Badge>
                        )}
                        {listing.floor && (
                          <span className="text-xs text-muted-foreground">
                            {listing.floor}º andar
                          </span>
                        )}
                        {listing.area && (
                          <span className="text-xs text-muted-foreground">
                            {listing.area} m²
                          </span>
                        )}
                        {listing.bedrooms && (
                          <span className="text-xs text-muted-foreground">
                            {listing.bedrooms} dorm.
                          </span>
                        )}
                        {listing.bathrooms && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Bath className="h-3 w-3" />{listing.bathrooms}
                          </span>
                        )}
                        {listing.garages && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Car className="h-3 w-3" />{listing.garages}
                          </span>
                        )}
                      </div>
                      {(listing.city || listing.state) && (() => {
                        const locationLabel = [listing.city, listing.state].filter(Boolean).join(' - ')
                        const isMismatch =
                          buildingCity &&
                          listing.city &&
                          normalizeCity(listing.city) !== normalizeCity(buildingCity)
                        return (
                          <div className={`flex items-center gap-1 text-xs mt-0.5 ${isMismatch ? 'text-orange-500 font-medium' : 'text-muted-foreground'}`}>
                            {isMismatch
                              ? <AlertTriangle className="h-3 w-3 shrink-0" />
                              : <MapPin className="h-3 w-3 shrink-0" />}
                            <span>{locationLabel}</span>
                          </div>
                        )
                      })()}
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {listing.description || 'Sem descrição'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-base">
                        {formatPrice(listing.priceCurrent)}
                      </p>
                      {listing.priceCurrent !== listing.priceOriginal && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatPrice(listing.priceOriginal)}
                        </p>
                      )}
                      {listing.daysOnMarket !== null && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {listing.daysOnMarket}d
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
