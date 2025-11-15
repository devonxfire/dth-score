const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const comp = await prisma.competitions.findUnique({ where: { id: 310 } });
    console.log('Competition 310 groups:');
    console.log(JSON.stringify(comp.groups, null, 2));
  } catch (e) {
    console.error('Error printing comp:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
