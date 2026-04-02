// Download e salvamento de fotos de anúncios
// R03: foto 404 → pula, continua
// M02: isPhotoStored evita redownload de fotos já existentes em listing_photos

import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { eq } from 'drizzle-orm'
import db from '@/lib/db'
import { listingPhotos } from '@/lib/db/schema'

const PHOTOS_DIR = process.env.PHOTOS_DIR || './data/photos'

/**
 * Faz download de uma foto e salva em disco.
 * R03: Em caso de erro (404, timeout, etc.), retorna null sem lançar exceção.
 *
 * @param url - URL da foto original
 * @param destPath - Caminho de destino relativo (sem extensão)
 * @returns Caminho local do arquivo salvo, ou null em caso de erro
 */
export async function downloadPhoto(url: string, destPath: string): Promise<string | null> {
  try {
    // Garante que o diretório existe
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    return await new Promise<string | null>((resolve) => {
      const protocol = url.startsWith('https') ? https : http
      const timeout = setTimeout(() => {
        resolve(null)
        console.warn(`[photo-downloader] Timeout ao baixar: ${url}`)
      }, 15000)

      const request = protocol.get(url, (response) => {
        clearTimeout(timeout)

        if (response.statusCode !== 200) {
          console.warn(
            `[photo-downloader] Status ${response.statusCode} para ${url} — pulando`
          )
          resolve(null)
          return
        }

        const fileStream = fs.createWriteStream(destPath)
        response.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close()
          resolve(destPath)
        })

        fileStream.on('error', (err) => {
          console.error(`[photo-downloader] Erro ao salvar ${destPath}:`, err)
          fs.unlink(destPath, () => {}) // Limpa arquivo parcial
          resolve(null)
        })
      })

      request.on('error', (err) => {
        clearTimeout(timeout)
        console.warn(`[photo-downloader] Erro na requisição para ${url}:`, err.message)
        resolve(null)
      })
    })
  } catch (error) {
    console.error(`[photo-downloader] Erro inesperado para ${url}:`, error)
    return null
  }
}

/**
 * M02: verifica se uma URL já está registrada em listing_photos.
 * Usada para evitar redownload em atualizações diárias (U14).
 */
export async function isPhotoStored(urlOriginal: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: listingPhotos.id })
    .from(listingPhotos)
    .where(eq(listingPhotos.urlOriginal, urlOriginal))
  return !!existing
}

/**
 * Gera o caminho local de destino para uma foto.
 * Organiza por listing ID para facilitar limpeza.
 */
export function getPhotoDestPath(listingId: string, photoIndex: number, ext = 'jpg'): string {
  const subDir = listingId.slice(0, 2) // Primeiro 2 chars como subdiretório
  return path.join(PHOTOS_DIR, subDir, listingId, `${photoIndex}.${ext}`)
}

/**
 * Converte o localPath salvo no banco para uma URL servida por /api/photos/...
 * Aceita photosDir opcional para facilitar testes.
 *
 * Exemplo: '/app/data/photos/a1/uuid/0.jpg' → '/api/photos/a1/uuid/0.jpg'
 */
export function localPathToUrl(localPath: string, photosDir?: string): string {
  const base = path.resolve(photosDir ?? process.env.PHOTOS_DIR ?? './data/photos')
  const resolved = path.resolve(localPath)
  const relative = path.relative(base, resolved)
  // Normaliza separadores para URL (relevante no Windows)
  return '/api/photos/' + relative.split(path.sep).join('/')
}
