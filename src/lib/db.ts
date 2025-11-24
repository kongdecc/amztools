import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

const url = process.env.PRISMA_DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL
export const db: PrismaClient = globalForPrisma.prisma ?? new PrismaClient(
  url ? { datasources: { db: { url } } } : undefined
)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db