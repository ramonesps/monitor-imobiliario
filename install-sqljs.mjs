import { execSync } from 'child_process'
import { writeFileSync } from 'fs'

const projectDir = 'C:\\Users\\ramon\\monitor-imobiliario'
const outputFile = projectDir + '\\install-sqljs-output.txt'

let output = ''
try {
  const out = execSync('npm install sql.js --ignore-scripts 2>&1', {
    cwd: projectDir,
    timeout: 120000,
    encoding: 'utf8',
    shell: 'cmd.exe'
  })
  output = out
} catch (e) {
  output = (e.stdout || '') + (e.stderr || '') + e.message
}

writeFileSync(outputFile, output)
