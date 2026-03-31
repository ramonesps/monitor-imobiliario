import { readdirSync, existsSync, writeFileSync } from 'fs'

const dir = 'C:\\Users\\ramon\\monitor-imobiliario'
const binDir = dir + '\\node_modules\\.bin'
const outFile = dir + '\\deps-check.txt'

let msg = ''
if (existsSync(binDir)) {
  const entries = readdirSync(binDir).filter(e => e.includes('vitest') || e.includes('sharp') || e.includes('drizzle'))
  msg = 'Relevant .bin entries:\n' + entries.join('\n')

  // Also list all .bin entries to find vitest
  const all = readdirSync(binDir)
  msg += '\n\nAll .bin entries (' + all.length + '):\n' + all.join('\n')
} else {
  msg = '.bin directory does NOT exist!'
}

writeFileSync(outFile, msg)
