// Dashboard principal — lista de prédios monitorados
import Link from 'next/link'
import { Building2, MapPin, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BuildingFormWrapper } from '@/components/building-form-wrapper'
import db from '@/lib/db'
import { buildings } from '@/lib/db/schema'

async function getBuildings() {
  const rows = await db.select().from(buildings).orderBy(buildings.createdAt)
  return rows.map((b) => ({
    ...b,
    searchTerms: b.searchTerms ? (JSON.parse(b.searchTerms) as string[]) : [],
  }))
}

export default async function Home() {
  const buildingList = await getBuildings()

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Monitor Imobiliário</h1>
          <p className="text-muted-foreground mt-1">
            {buildingList.length === 0
              ? 'Nenhum prédio cadastrado ainda.'
              : `${buildingList.length} prédio${buildingList.length > 1 ? 's' : ''} monitorado${buildingList.length > 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de prédios */}
          <div className="lg:col-span-2 space-y-4">
            {buildingList.length === 0 ? (
              <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
                <Building2 className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <p>Cadastre o primeiro prédio para começar a monitorar.</p>
              </div>
            ) : (
              buildingList.map((building) => (
                <Link key={building.id} href={`/buildings/${building.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{building.name}</CardTitle>
                        <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      </div>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {building.address}
                      </CardDescription>
                    </CardHeader>
                    {building.searchTerms.length > 0 && (
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          Busca também por:{' '}
                          <span className="font-medium">
                            {building.searchTerms.join(', ')}
                          </span>
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))
            )}
          </div>

          {/* Formulário de cadastro */}
          <div className="lg:col-span-1">
            <BuildingFormWrapper />
          </div>
        </div>
      </div>
    </main>
  )
}
