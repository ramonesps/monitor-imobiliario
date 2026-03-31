// Script para instalar dependências e rodar testes
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'

const projectDir = 'C:\\Users\\ramon\\monitor-imobiliario'
const outputFile = projectDir + '\\test-results.txt'

let output = ''

// Install all packages except native ones (--ignore-scripts to skip node-gyp builds)
// Then try to install better-sqlite3 with prebuilt binaries
try {
  const installOut = execSync('npm install --ignore-scripts 2>&1', {
    cwd: projectDir,
    timeout: 300000,
    encoding: 'utf8',
    shell: 'cmd.exe'
  })
  output += '=== npm install --ignore-scripts ===\n' + installOut + '\n\n'
} catch (e) {
  output += '=== npm install --ignore-scripts DONE (exit code ' + (e.status || 'unknown') + ') ===\n'
  output += (e.stdout || '') + '\n'
}

// Try to run vitest
try {
  const testOut = execSync('node_modules\\.bin\\vitest.cmd run --reporter=verbose 2>&1', {
    cwd: projectDir,
    timeout: 90000,
    encoding: 'utf8',
    shell: 'cmd.exe'
  })
  output += '=== vitest run ===\n' + testOut
} catch (e) {
  output += '=== vitest run (with failures/exit code ' + (e.status || 'unknown') + ') ===\n'
  output += (e.stdout || '') + '\n' + (e.stderr || '') + '\n'
  output += e.message || ''
}

writeFileSync(outputFile, output)
