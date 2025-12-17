const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check if Royal Cape already exists
  const existing = await prisma.courses.findFirst({
    where: { name: 'Royal Cape Golf Club' }
  });

  if (existing) {
    console.log('Royal Cape Golf Club already exists in the database.');
    return;
  }

  // Create Royal Cape Golf Club
  const royalCape = await prisma.courses.create({
    data: {
      name: 'Royal Cape Golf Club',
      location: 'Cape Town'
    }
  });

  console.log('Created course:', royalCape.name);

  // Royal Cape hole data (Yellow Tees)
  const royalCapeHoles = [
    { number: 1, par: 4, index: 5 },
    { number: 2, par: 4, index: 11 },
    { number: 3, par: 4, index: 1 },
    { number: 4, par: 3, index: 17 },
    { number: 5, par: 5, index: 7 },
    { number: 6, par: 4, index: 9 },
    { number: 7, par: 5, index: 13 },
    { number: 8, par: 3, index: 15 },
    { number: 9, par: 4, index: 3 },
    { number: 10, par: 4, index: 6 },
    { number: 11, par: 5, index: 18 },
    { number: 12, par: 4, index: 16 },
    { number: 13, par: 3, index: 10 },
    { number: 14, par: 4, index: 2 },
    { number: 15, par: 3, index: 14 },
    { number: 16, par: 5, index: 8 },
    { number: 17, par: 4, index: 4 },
    { number: 18, par: 4, index: 12 }
  ];

  // Create course holes
  for (const hole of royalCapeHoles) {
    await prisma.course_holes.create({
      data: {
        course_id: royalCape.id,
        number: hole.number,
        par: hole.par,
        index: hole.index
      }
    });
  }

  console.log('Created 18 holes for Royal Cape Golf Club');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
