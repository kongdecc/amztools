import fs from 'fs'
import path from 'path'

const rootDir = process.cwd()
const sourceDir = path.join(rootDir, 'bulk', 'dist')
const targetDir = path.join(rootDir, 'public', 'bulk')

if (!fs.existsSync(sourceDir)) {
  console.error(`Bulk tool build output not found: ${sourceDir}`)
  process.exit(1)
}

fs.rmSync(targetDir, { recursive: true, force: true })
fs.mkdirSync(path.dirname(targetDir), { recursive: true })
fs.cpSync(sourceDir, targetDir, { recursive: true })

console.log(`Synced bulk tool assets to ${targetDir}`)
