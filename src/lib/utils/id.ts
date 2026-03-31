// Gerador de UUID v4 para IDs de todas as tabelas

import { v4 as uuidv4 } from 'uuid'

/**
 * Gera um UUID v4 único.
 * Utilizado como PK em todas as tabelas do banco de dados.
 */
export function generateId(): string {
  return uuidv4()
}
