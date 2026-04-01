'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, AlertTriangle, Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { BuildingForm } from '@/components/building-form'
import type { Building } from '@/types'

interface BuildingActionsProps {
  building: Building
}

export function BuildingActions({ building }: BuildingActionsProps) {
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showClear, setShowClear] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [clearError, setClearError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/buildings/${building.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao remover prédio')
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro desconhecido')
      setDeleting(false)
    }
  }

  async function handleClear() {
    setClearing(true)
    setClearError(null)
    try {
      const res = await fetch(`/api/buildings/${building.id}/listings`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao limpar anúncios')
      }
      setShowClear(false)
      router.refresh()
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Erro desconhecido')
      setClearing(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
          <Pencil className="h-4 w-4 mr-1.5" />
          Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300"
          onClick={() => setShowClear(true)}
        >
          <Eraser className="h-4 w-4 mr-1.5" />
          Limpar listagens
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Excluir
        </Button>
      </div>

      {/* Dialog de edição */}
      <Dialog open={showEdit} onClose={() => setShowEdit(false)} title="Editar prédio">
        <BuildingForm
          initialData={building}
          onSuccess={() => {
            setShowEdit(false)
            router.refresh()
          }}
        />
      </Dialog>

      {/* Dialog de limpar listagens */}
      <Dialog open={showClear} onClose={() => setShowClear(false)} title="Limpar listagens">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-orange-200 bg-orange-50 p-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Remove todos os anúncios</p>
              <p className="mt-0.5">
                Os anúncios de <strong>{building.name}</strong> serão apagados. O prédio é
                mantido. Use em seguida "Atualizar agora" para coletar dados novos.
              </p>
            </div>
          </div>

          {clearError && <p className="text-sm text-destructive">{clearError}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowClear(false)} disabled={clearing}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleClear}
              disabled={clearing}
            >
              {clearing ? 'Limpando...' : 'Limpar anúncios'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={showDelete} onClose={() => setShowDelete(false)} title="Excluir prédio">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Atenção: ação irreversível</p>
              <p className="mt-0.5">
                Isso removerá <strong>{building.name}</strong> e todos os seus anúncios,
                histórico de preços e fontes.
              </p>
            </div>
          </div>

          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDelete(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Removendo...' : 'Sim, excluir'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
