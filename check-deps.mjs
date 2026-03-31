import { readdirSync, existsSync } from 'fs'

const dir = 'C:\\Users\\ramon\\monitor-imobiliario'
const nodeModulesDir = dir + '\\node_modules'

if (existsSync(nodeModulesDir)) {
  const entries = readdirSync(nodeModulesDir).slice(0, 20)
  writeOutput('node_modules exists. First 20 entries:\n' + entries.join('\n'))
} else {
  writeOutput('node_modules does NOT exist!')
}

function writeOutput(msg) {
  import('fs').then(fs => fs.writeFileSync(dir + '\\deps-check.txt', msg))
}
