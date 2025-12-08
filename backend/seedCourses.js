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
  

  // Helper: seed a course by name, location and holes array
  async function seedCourse({ name, location, holes }) {
    if (!name) return;
    const existing = await prisma.courses.findFirst({ where: { name } });
    if (existing) {
      console.log(`${name} already exists in the database. Skipping.`);
      return;
    }

    const course = await prisma.courses.create({
      data: {
        name,
        location: location || null,
        course_holes: {
          createMany: {
            data: holes || []
          }
        }
      },
      include: { course_holes: true }
    });

    console.log(`✓ Created course: ${course.name}`);
    console.log(`✓ Seeded ${course.course_holes.length} holes`);
  }

  try {
    // If a seed file exists for courses in ./seed_courses/*.json, load and seed them.
    const seedDir = require('path').join(__dirname, 'seed_courses');
    const fs = require('fs');
    if (fs.existsSync(seedDir)) {
      const files = fs.readdirSync(seedDir).filter(f => f.endsWith('.json'));
      if (files.length > 0) {
        for (const f of files) {
          try {
            const content = fs.readFileSync(require('path').join(seedDir, f), 'utf8');
            const obj = JSON.parse(content);
            // expect { name, location, holes: [{number,par,index},...] }
            await seedCourse({ name: obj.name, location: obj.location, holes: obj.holes });
          } catch (e) {
            console.warn('Failed to seed from file', f, e.message || e);
          }
        }
        return;
      }
    }

    // If no seed files found, do nothing to avoid seeding example data accidentally.
    console.log('No seed files found in backend/seed_courses. Nothing to do.');
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
