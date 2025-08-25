// scripts/fixMissingTeamIds.js
// Run with: npx ts-node scripts/fixMissingTeamIds.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const competitions = await prisma.competition.findMany({
    include: { groups: true }
  });

  for (const comp of competitions) {
    let updated = false;
    for (const group of comp.groups) {
      if (!group.teamId) {
        // Try to find a team for this group (by player membership or fallback to first team)
        const teams = await prisma.team.findMany({
          where: { competitionId: comp.id },
          include: { users: true }
        });
        let foundTeam = teams[0];
        // Try to match by player membership
        for (const team of teams) {
          if (group.players.some(p => team.users.some(u => u.name === p))) {
            foundTeam = team;
            break;
          }
        }
        if (foundTeam) {
          await prisma.group.update({
            where: { id: group.id },
            data: { teamId: foundTeam.id }
          });
          console.log(`Updated group ${group.id} in competition ${comp.id} with teamId ${foundTeam.id}`);
          updated = true;
        } else {
          console.warn(`No team found for group ${group.id} in competition ${comp.id}`);
        }
      }
    }
    if (updated) {
      console.log(`Checked competition ${comp.id}`);
    }
  }
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
