// This script seeds courses and their holes into the database using Prisma.
// Usage: node seedCourses.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Westlake hole definitions
  const westlakeHoles = [
    { number: 1, par: 4, index: 5 },
    { number: 2, par: 4, index: 7 },
    { number: 3, par: 3, index: 17 },
    { number: 4, par: 5, index: 1 },
    { number: 5, par: 4, index: 11 },
    { number: 6, par: 3, index: 15 },
    { number: 7, par: 5, index: 3 },
    { number: 8, par: 4, index: 13 },
    { number: 9, par: 4, index: 9 },
    { number: 10, par: 4, index: 10 },
    { number: 11, par: 4, index: 4 },
    { number: 12, par: 4, index: 12 },
    { number: 13, par: 5, index: 2 },
    { number: 14, par: 4, index: 14 },
    { number: 15, par: 3, index: 18 },
    { number: 16, par: 5, index: 6 },
    { number: 17, par: 3, index: 16 },
    { number: 18, par: 4, index: 8 }
  ];

  try {
    // Check if Westlake course already exists
    const existingCourse = await prisma.courses.findFirst({
      where: { name: 'Westlake Golf Club' }
    });

    if (existingCourse) {
      console.log('Westlake Golf Club already exists in the database.');
      return;
    }

    // Create the Westlake course and its holes
    const course = await prisma.courses.create({
      data: {
        name: 'Westlake Golf Club',
        location: 'Sydney',
        course_holes: {
          createMany: {
            data: westlakeHoles
          }
        }
      },
      include: {
        course_holes: true
      }
    });

    console.log(`✓ Created course: ${course.name}`);
    console.log(`✓ Seeded ${course.course_holes.length} holes`);
  } catch (error) {
    console.error('Error seeding courses:', error);
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
