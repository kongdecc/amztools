import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
const url = process.env.PRISMA_DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL
const hasDatabaseUrl = Boolean(String(url || '').trim())

const noopModelDelegate = new Proxy({}, {
  get(_target, prop) {
    const name = String(prop)
    if (name === 'findMany') return async () => []
    if (name === 'findFirst' || name === 'findUnique') return async () => null
    if (name === 'count') return async () => 0
    if (name === 'aggregate') return async () => ({})
    if (name === 'groupBy') return async () => []
    if (name === 'createMany' || name === 'updateMany' || name === 'deleteMany') return async () => ({ count: 0 })
    if (name === 'create' || name === 'update' || name === 'upsert' || name === 'delete') return async () => null
    return async () => null
  }
}) as any

const noDatabaseClient = new Proxy({}, {
  get(_target, prop) {
    const name = String(prop)
    if (name === '$connect' || name === '$disconnect') return async () => undefined
    if (name === '$transaction') return async (arg: any) => {
      if (typeof arg === 'function') return arg(noDatabaseClient)
      if (Array.isArray(arg)) return Promise.all(arg)
      return []
    }
    if (name === '$executeRaw' || name === '$executeRawUnsafe') return async () => 0
    if (name === '$queryRaw' || name === '$queryRawUnsafe') return async () => []
    return noopModelDelegate
  }
}) as any

function createPrisma(): PrismaClient {
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined)
}

let client: PrismaClient | undefined = globalForPrisma.prisma

const handler: ProxyHandler<any> = {
  get(_target, prop) {
    if (!hasDatabaseUrl) {
      return noDatabaseClient[prop as any]
    }
    if (!client) {
      client = createPrisma()
      if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
    }
    const anyClient = client as any
    return anyClient[prop]
  }
}

export const db = new Proxy({}, handler) as unknown as PrismaClient
