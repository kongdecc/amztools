import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'
import { DEFAULT_CATEGORIES, DEFAULT_TOOLS } from '../src/lib/constants'

const db = new PrismaClient()

function hash(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const h = hash(password, salt)
  return { hash: h, salt }
}

async function main() {
  console.log('Start seeding...')

  // 1. Admin User
  const existingAdmin = await db.adminUser.findFirst()
  if (!existingAdmin) {
    console.log('Creating default admin user...')
    const { hash, salt } = hashPassword('dage168')
    await db.adminUser.create({
      data: {
        username: 'dage666',
        passwordHash: hash,
        passwordSalt: salt
      }
    })
  }

  // 2. Categories
  const categories = (DEFAULT_CATEGORIES as any[]).map((c: any, idx: number) => ({
    key: String(c.key),
    label: String(c.label),
    order: Number.isFinite(Number(c.order)) ? Number(c.order) : idx + 1,
    enabled: c.enabled !== false
  }))

  for (const cat of categories) {
    await db.toolCategory.upsert({
      where: { key: cat.key },
      update: cat,
      create: cat
    })
  }

  // 3. Tools
  const tools = (DEFAULT_TOOLS as any[]).map((t: any, idx: number) => ({
    key: String(t.key),
    title: String(t.title),
    desc: String(t.desc),
    status: String(t.status || '启用'),
    views: Number.isFinite(Number(t.views)) ? Number(t.views) : 0,
    color: String(t.color || 'blue'),
    order: Number.isFinite(Number(t.order)) ? Number(t.order) : idx + 1,
    category: String(t.category || 'other')
  }))

  for (const tool of tools) {
    await db.toolModule.upsert({
      where: { key: tool.key },
      update: tool,
      create: tool
    })
  }

  console.log(`Seeding finished. Processed ${tools.length} tools.`)
}

main()
  .catch((e) => {
    console.error('Seed failed but continuing build to allow fallback mode:')
    console.error(e)
    process.exit(0)
  })
  .finally(async () => {
    await db.$disconnect()
  })
