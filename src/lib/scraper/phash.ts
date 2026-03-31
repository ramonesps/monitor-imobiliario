// Perceptual hashing de imagens usando Sharp
// Utilizado para comparar fotos e detectar imóveis duplicados (U01, U02, U03)

import sharp from 'sharp'

const HASH_SIZE = 8 // 8x8 = 64 bits

/**
 * Gera um perceptual hash (pHash) de uma imagem.
 * Algoritmo: redimensiona para 8x8 grayscale, calcula DCT-like (média),
 * compara cada pixel com a média → bit 0 ou 1, serializa como hex.
 *
 * @param imagePath - Caminho local do arquivo de imagem OU Buffer
 * @returns String hexadecimal de 16 chars (64 bits)
 */
export async function generatePhash(imagePath: string | Buffer): Promise<string> {
  // Redimensiona para (hashSize*2) x (hashSize*2) grayscale
  // Depois aplica média simples como approximação do DCT
  const size = HASH_SIZE

  let imageData: sharp.Sharp
  if (Buffer.isBuffer(imagePath)) {
    imageData = sharp(imagePath)
  } else {
    imageData = sharp(imagePath)
  }

  const { data } = await imageData
    .resize(size, size, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = Array.from(data)
  const avg = pixels.reduce((sum, p) => sum + p, 0) / pixels.length

  // Cada pixel: 1 se >= média, 0 se < média
  let hashBinary = ''
  for (const pixel of pixels) {
    hashBinary += pixel >= avg ? '1' : '0'
  }

  // Converte binário para hexadecimal
  let hex = ''
  for (let i = 0; i < hashBinary.length; i += 4) {
    const nibble = hashBinary.slice(i, i + 4)
    hex += parseInt(nibble, 2).toString(16)
  }

  return hex
}

/**
 * Calcula a distância de Hamming entre dois hashes perceptuais.
 * Distância 0 = imagens idênticas.
 * Distância < 10 (de 64 bits) = provável mesmo imóvel.
 *
 * @param hash1 - Hash hexadecimal de 16 chars
 * @param hash2 - Hash hexadecimal de 16 chars
 * @returns Número de bits diferentes (0-64)
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error(
      `Hashes com comprimentos diferentes: ${hash1.length} vs ${hash2.length}`
    )
  }

  // Converte hex para binário e compara bit a bit
  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    const v1 = parseInt(hash1[i], 16)
    const v2 = parseInt(hash2[i], 16)
    const xor = v1 ^ v2
    // Conta bits 1 no XOR (popcount)
    distance += xor.toString(2).split('').filter((b) => b === '1').length
  }

  return distance
}

/**
 * Verifica se duas imagens são provavelmente do mesmo imóvel.
 * Threshold padrão: distância < 10 de 64 bits.
 */
export function isSameProperty(hash1: string, hash2: string, threshold = 10): boolean {
  return hammingDistance(hash1, hash2) < threshold
}
