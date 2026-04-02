// U11: localPathToUrl — gera URL /api/photos/... correta a partir de localPath
import { describe, it, expect } from 'vitest'
import { localPathToUrl } from '@/lib/scraper/photo-downloader'

describe('U11: localPathToUrl', () => {
  it('converte localPath absoluto para URL /api/photos/...', () => {
    const url = localPathToUrl('/app/data/photos/a1/uuid-listing/0.jpg', '/app/data/photos')
    expect(url).toBe('/api/photos/a1/uuid-listing/0.jpg')
  })

  it('converte localPath com índice diferente de zero', () => {
    const url = localPathToUrl('/app/data/photos/b2/uuid-listing/2.jpg', '/app/data/photos')
    expect(url).toBe('/api/photos/b2/uuid-listing/2.jpg')
  })

  it('subdiretório de 2 chars é derivado do início do listingId', () => {
    const listingId = 'ff123456-0000-0000-0000-000000000000'
    const localPath = `/data/photos/ff/${listingId}/0.jpg`
    const url = localPathToUrl(localPath, '/data/photos')
    expect(url).toContain('/api/photos/ff/')
    expect(url).toContain(listingId)
  })

  it('normaliza separadores de caminho do Windows para URL', () => {
    // Simula path com backslash (Windows)
    const winPath = 'C:\\app\\data\\photos\\a1\\uuid\\0.jpg'
    const photosDir = 'C:\\app\\data\\photos'
    const url = localPathToUrl(winPath, photosDir)
    // Resultado não deve conter backslash
    expect(url).not.toContain('\\')
    expect(url).toMatch(/^\/api\/photos\//)
  })
})
