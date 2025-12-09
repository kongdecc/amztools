declare module 'prisma/config' {
  export function defineConfig(input: any): any
  export function env(name: string): string | undefined
}