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
  const existing = await prisma.holes.findMany({
    where: { competition_id: Number(competitionId) },
  });
  if (existing.length > 0) {
    console.log(`Holes already exist for competition ${competitionId}.`);
    process.exit(0);
  }
  // Westlake hole definitions
  const westlake = [
    { number: 1, par: 4, stroke_index: 5 },
    { number: 2, par: 4, stroke_index: 7 },
    { number: 3, par: 3, stroke_index: 17 },
    { number: 4, par: 5, stroke_index: 1 },
    { number: 5, par: 4, stroke_index: 11 },
    { number: 6, par: 3, stroke_index: 15 },
    { number: 7, par: 5, stroke_index: 3 },
    { number: 8, par: 4, stroke_index: 13 },
    { number: 9, par: 4, stroke_index: 9 },
    { number: 10, par: 4, stroke_index: 10 },
    { number: 11, par: 4, stroke_index: 4 },
    { number: 12, par: 4, stroke_index: 12 },
    { number: 13, par: 5, stroke_index: 2 },
    { number: 14, par: 4, stroke_index: 14 },
    { number: 15, par: 3, stroke_index: 18 },
    { number: 16, par: 5, stroke_index: 6 },
    { number: 17, par: 3, stroke_index: 16 },
    { number: 18, par: 4, stroke_index: 8 }
  ];

  const holes = westlake.map(h => ({ competition_id: Number(competitionId), number: h.number, par: h.par, stroke_index: h.stroke_index }));

  await prisma.holes.createMany({ data: holes });
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
