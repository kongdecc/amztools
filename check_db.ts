
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  try {
    const tools = await db.toolModule.findMany();
    const disabled = tools.filter(t => t.status === '下架');
    console.log('Disabled tools in DB:', disabled.map(t => t.key));
    console.log('Total tools in DB:', tools.length);
    
    // Check if any default tool is missing from DB or has different status
    // We can't easily import DEFAULT_TOOLS here because of relative paths and potentially other imports in constants.ts
    // But we can check the disabled ones against our known list.
  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
}

main();
