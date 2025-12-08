// Remediation script: ensure competitions using a given course have holes copied
// from the canonical `course_holes` table.
// Usage examples:
//   Dry-run (no writes):
//     node remediate_competition_holes_for_course.js "Metropolitan Golf Club" --dry-run
//   Backup existing holes then perform remediation:
//     node remediate_competition_holes_for_course.js "Metropolitan Golf Club" --backup --confirm

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const courseName = args[0];
  const dryRun = args.includes('--dry-run');
  const doBackup = args.includes('--backup');
  const doConfirm = args.includes('--confirm');

  if (!courseName) {
    console.error('Usage: node remediate_competition_holes_for_course.js "Course Name" [--dry-run] [--backup] [--confirm]');
    process.exit(1);
  }

  try {
    const course = await prisma.courses.findFirst({ where: { name: courseName } });
    if (!course) {
      console.error('Course not found:', courseName);
      process.exit(1);
    }
    console.log('Found course:', course.name, 'id=', course.id);

    const courseHoles = await prisma.course_holes.findMany({ where: { course_id: course.id }, orderBy: { number: 'asc' } });
    if (!courseHoles || courseHoles.length === 0) {
      console.error('No course_holes found for course id', course.id);
      process.exit(1);
    }

    const comps = await prisma.competitions.findMany({ where: { course_id: course.id } });
    if (!comps || comps.length === 0) {
      console.log('No competitions found using course:', course.name);
      return;
    }

    // Prepare backup dir
    const backupDir = path.join(__dirname, 'backups');
    if (doBackup && !fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    for (const comp of comps) {
      console.log('\nProcessing competition id=', comp.id, 'date=', comp.date);
      const existingHoles = await prisma.holes.findMany({ where: { competition_id: comp.id }, orderBy: { number: 'asc' } });
      const sumOld = existingHoles.reduce((s, h) => s + (Number(h.par) || 0), 0);
      console.log('  Existing holes:', existingHoles.length, 'par sum=', sumOld);

      const holesData = courseHoles.map(h => ({ number: h.number, par: h.par, stroke_index: h.index, competition_id: comp.id }));
      const sumNew = holesData.reduce((s, h) => s + (Number(h.par) || 0), 0);
      console.log('  Desired holes from course_holes:', holesData.length, 'par sum=', sumNew);

      // Show per-hole diffs
      for (let i = 0; i < Math.max(existingHoles.length, holesData.length); i++) {
        const oldH = existingHoles[i];
        const newH = holesData[i];
        const oldStr = oldH ? `#${oldH.number} par=${oldH.par} idx=${oldH.stroke_index}` : '<missing>'; 
        const newStr = newH ? `#${newH.number} par=${newH.par} idx=${newH.stroke_index}` : '<missing>';
        if (oldStr !== newStr) console.log(`   DIFF [pos ${i+1}]: ${oldStr}  →  ${newStr}`);
      }

      if (dryRun) {
        console.log('  Dry-run: no changes will be made for this competition.');
        continue;
      }

      if (doBackup) {
        const outPath = path.join(backupDir, `comp_${comp.id}_holes_backup_${Date.now()}.json`);
        try {
          fs.writeFileSync(outPath, JSON.stringify({ competitionId: comp.id, date: comp.date, holes: existingHoles }, null, 2), 'utf8');
          console.log('  Backed up existing holes to', outPath);
        } catch (e) {
          console.warn('  Failed to write backup for competition', comp.id, e.message || e);
        }
      }

      if (!doConfirm) {
        console.log('  Skipping write: pass --confirm to apply changes (and --backup to create a backup).');
        continue;
      }

      // Apply updates per-hole to preserve hole IDs and existing scores.
      try {
        for (const h of holesData) {
          const existing = await prisma.holes.findFirst({ where: { competition_id: comp.id, number: h.number } });
          if (existing) {
            // Only update if par or stroke_index differ
            const needsUpdate = (Number(existing.par) !== Number(h.par)) || (Number(existing.stroke_index || 0) !== Number(h.stroke_index || 0));
            if (needsUpdate) {
              await prisma.holes.update({ where: { id: existing.id }, data: { par: h.par, stroke_index: h.stroke_index } });
              console.log(`  Updated hole #${h.number}: par ${existing.par}→${h.par} idx ${existing.stroke_index}→${h.stroke_index}`);
            } else {
              // nothing to do
            }
          } else {
            await prisma.holes.create({ data: { competition_id: comp.id, number: h.number, par: h.par, stroke_index: h.stroke_index } });
            console.log(`  Created hole #${h.number}: par ${h.par} idx ${h.stroke_index}`);
          }
        }
        const newHoles = await prisma.holes.findMany({ where: { competition_id: comp.id }, orderBy: { number: 'asc' } });
        const sumAfter = newHoles.reduce((s, h) => s + (Number(h.par) || 0), 0);
        console.log('  Applied updates. Holes now:', newHoles.length, 'par sum=', sumAfter);
      } catch (e) {
        console.error('  Failed to apply changes for competition', comp.id, e.message || e);
      }
    }

    console.log('\nDone.');
  } catch (err) {
    console.error('Error during remediation:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
