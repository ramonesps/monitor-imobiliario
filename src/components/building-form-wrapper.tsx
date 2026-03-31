'use client'

import { useRouter } from 'next/navigation'
import { BuildingForm } from './building-form'

export function BuildingFormWrapper() {
  const router = useRouter()

  return <BuildingForm onSuccess={() => router.refresh()} />
}
