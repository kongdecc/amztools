import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.PRISMA_DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/postgres'
  }
})
