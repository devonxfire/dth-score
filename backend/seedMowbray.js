const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check if Mowbray already exists
  const existing = await prisma.courses.findFirst({
    where: { name: 'King David Mowbray Golf Club' }
  });

  if (existing) {
    console.log('King David Mowbray Golf Club already exists in the database.');
    return;
  }

  // Create King David Mowbray Golf Club
  const mowbray = await prisma.courses.create({
    data: {
      name: 'King David Mowbray Golf Club',
      location: 'Cape Town'
    }
  });

  console.log('Created course:', mowbray.name);

  // Mowbray hole data
  const mowbrayHoles = [
    { number: 1, par: 4, index: 14 },
    { number: 2, par: 4, index: 6 },
    { number: 3, par: 4, index: 12 },
    { number: 4, par: 3, index: 16 },
    { number: 5, par: 4, index: 4 },
    { number: 6, par: 5, index: 8 },
    { number: 7, par: 4, index: 2 },
    { number: 8, par: 3, index: 18 },
    { number: 9, par: 5, index: 10 },
    { number: 10, par: 5, index: 1 },
    { number: 11, par: 4, index: 15 },
    { number: 12, par: 4, index: 9 },
    { number: 13, par: 3, index: 13 },
    { number: 14, par: 5, index: 11 },
    { number: 15, par: 4, index: 3 },
    { number: 16, par: 3, index: 17 },
    { number: 17, par: 4, index: 7 },
    { number: 18, par: 4, index: 5 }
  ];

  // Create course holes
  for (const hole of mowbrayHoles) {
    await prisma.course_holes.create({
      data: {
        course_id: mowbray.id,
        number: hole.number,
        par: hole.par,
        index: hole.index
      }
    });
  }

  console.log('Created 18 holes for King David Mowbray Golf Club');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
