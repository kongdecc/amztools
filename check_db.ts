
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  try {
    const tool = await db.toolModule.findUnique({
      where: { key: 'amazon-ads-analyzer' }
    });
    console.log('Amazon Ads Analyzer in DB:', tool);
    
    const allTools = await db.toolModule.findMany();
    console.log('Total tools count:', allTools.length);
    console.log('Tool keys:', allTools.map(t => t.key));

  } catch (e) {
    console.error(e);
  } finally {
    await db.$disconnect();
  }
}

main();
