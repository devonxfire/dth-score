// migrateGroupsFromJson.js
// Script to migrate group data from competitions.groups (JSON) to the new Group table

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateGroups() {
  const competitions = await prisma.competitions.findMany();
  let migratedCount = 0;

  for (const comp of competitions) {
    if (!comp.groups) continue;
    let groups;
    try {
      groups = Array.isArray(comp.groups) ? comp.groups : JSON.parse(comp.groups);
    } catch (e) {
      console.error(`Failed to parse groups for competition ${comp.id}`);
      continue;
    }
    for (const group of groups) {
      // Defensive: skip if already migrated (idempotency)
      const whereClause = {
        competitionId: comp.id,
        teeTime: group.teeTime || null,
      };
      if (typeof group.teamId !== 'undefined' && group.teamId !== null) {
        whereClause.teamId = group.teamId;
      }
      const exists = await prisma.group.findFirst({
        where: whereClause,
      });
      if (exists) continue;
      try {
        await prisma.group.create({
          data: {
            competition: { connect: { id: comp.id } },
            team: group.teamId ? { connect: { id: group.teamId } } : undefined,
            teeTime: group.teeTime || null,
            players: group.players || [],
            teeboxes: group.teeboxes || {},
            handicaps: group.handicaps || {},
            created_at: group.created_at ? new Date(group.created_at) : undefined,
            updated_at: group.updated_at ? new Date(group.updated_at) : undefined,
          },
        });
        migratedCount++;
      } catch (err) {
        console.error(`Failed to migrate group in competition ${comp.id}:`, err);
      }
    }
  }
  console.log(`Migration complete. Migrated ${migratedCount} groups.`);
  await prisma.$disconnect();
}

migrateGroups();
