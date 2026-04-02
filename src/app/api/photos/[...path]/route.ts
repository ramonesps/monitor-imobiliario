// Serve fotos salvas localmente em PHOTOS_DIR
// Segurança: bloqueia path traversal (ex: ../../etc/passwd)
// Cache: imutável — conteúdo não muda para o mesmo path

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

const PHOTOS_DIR = process.env.PHOTOS_DIR || './data/photos'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const photosDir = path.resolve(PHOTOS_DIR)
  const requestedPath = path.resolve(path.join(photosDir, ...params.path))

  // Bloqueia path traversal
  if (!requestedPath.startsWith(photosDir + path.sep) && requestedPath !== photosDir) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!fs.existsSync(requestedPath)) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const ext = path.extname(requestedPath).toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'image/jpeg'
  const buffer = fs.readFileSync(requestedPath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
