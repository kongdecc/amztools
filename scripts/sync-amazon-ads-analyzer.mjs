import fs from 'fs'
import path from 'path'

const rootDir = process.cwd()
const sourceDir = path.join(rootDir, 'amazon-ads-analyzer', 'dist')
const targetDir = path.join(rootDir, 'public', 'amazon-ads-analyzer')

if (!fs.existsSync(sourceDir)) {
  console.error(`Amazon Ads Analyzer build output not found: ${sourceDir}`)
  process.exit(1)
}

fs.rmSync(targetDir, { recursive: true, force: true })
fs.mkdirSync(path.dirname(targetDir), { recursive: true })
fs.cpSync(sourceDir, targetDir, { recursive: true })

console.log(`Synced Amazon Ads Analyzer assets to ${targetDir}`)
