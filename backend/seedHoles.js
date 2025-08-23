// This script seeds 18 holes for a given competition in the database using Prisma.
// Usage: node seedHoles.js <competitionId>

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const competitionId = process.argv[2];
  if (!competitionId) {
    console.error('Usage: node seedHoles.js <competitionId>');
    process.exit(1);
  }

  // Check if holes already exist for this competition
  const existing = await prisma.hole.findMany({
    where: { competition_id: Number(competitionId) },
  });
  if (existing.length > 0) {
    console.log(`Holes already exist for competition ${competitionId}.`);
    process.exit(0);
  }

  const holes = Array.from({ length: 18 }, (_, i) => ({
    competition_id: Number(competitionId),
    number: i + 1,
    par: 4, // Default par, adjust as needed
    yardage: 400, // Default yardage, adjust as needed
  }));

  await prisma.hole.createMany({ data: holes });
  console.log(`Seeded 18 holes for competition ${competitionId}.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
