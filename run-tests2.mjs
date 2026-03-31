// Run vitest directly (deps already installed)
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'

const projectDir = 'C:\\Users\\ramon\\monitor-imobiliario'
const outputFile = projectDir + '\\test-results2.txt'

let output = ''
try {
  const testOut = execSync('node_modules\\.bin\\vitest.cmd run --reporter=verbose 2>&1', {
    cwd: projectDir,
    timeout: 90000,
    encoding: 'utf8',
    shell: 'cmd.exe'
  })
  output = '=== vitest run SUCCESS ===\n' + testOut
} catch (e) {
  output = '=== vitest run (exit code: ' + (e.status || 'unknown') + ') ===\n'
  output += (e.stdout || '') + '\n'
  if (e.stderr) output += 'STDERR:\n' + e.stderr + '\n'
}

writeFileSync(outputFile, output)
