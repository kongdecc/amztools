import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
const url = process.env.PRISMA_DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL

function createPrisma(): PrismaClient {
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined)
}

let client: PrismaClient | undefined = globalForPrisma.prisma

const handler: ProxyHandler<any> = {
  get(_target, prop) {
    if (!client) {
      client = createPrisma()
      if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
    }
    const anyClient = client as any
    return anyClient[prop]
  }
}

export const db = new Proxy({}, handler) as unknown as PrismaClient