import fs from 'fs'
import path from 'path'

const rootDir = process.cwd()
const sourceDir = path.join(rootDir, 'amazon-label-sorter-web', 'dist')
const targetDir = path.join(rootDir, 'public', 'amazon-label-sorter')

if (!fs.existsSync(sourceDir)) {
  console.error(`Amazon label sorter build output not found: ${sourceDir}`)
  process.exit(1)
}

fs.rmSync(targetDir, { recursive: true, force: true })
fs.mkdirSync(path.dirname(targetDir), { recursive: true })
fs.cpSync(sourceDir, targetDir, { recursive: true })

console.log(`Synced Amazon label sorter assets to ${targetDir}`)
