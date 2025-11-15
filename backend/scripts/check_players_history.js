const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeName(s) {
  if (!s && s !== 0) return '';
  try {
    return String(s)
      .normalize('NFKD')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/''/g, "'")
      .replace(/["()\[\]{}]/g, '')
      .replace(/[^\w\s\-']/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  } catch (e) {
    return String(s || '').trim().toLowerCase();
  }
}

async function main() {
  const names = [
    "Mike 'Jabba' Downie",
    "Jason 'Jay-Boy' Horn",
    "Jon 'Leak' Horn",
    "Storm 'Beefy' Currie"
  ];

  const users = await prisma.users.findMany();
  const usersByNorm = {};
  users.forEach(u => {
    const n = normalizeName(u.name || '');
    if (!usersByNorm[n]) usersByNorm[n] = [];
    usersByNorm[n].push(u);
  });

  for (const pname of names) {
    const norm = normalizeName(pname);
    const matches = usersByNorm[norm] || [];
    console.log('Player:', pname, 'norm=', norm, 'userMatches=', matches.length);
    for (const u of matches) {
      console.log('  user:', { id: u.id, name: u.name, username: u.username });
      const hist = await prisma.teams_users.findMany({ where: { user_id: u.id }, orderBy: { id: 'desc' }, include: { teams: true } });
      console.log('   teams_users rows count:', hist.length);
      hist.forEach(h => console.log('    ', { id: h.id, team_id: h.team_id, course_handicap: h.course_handicap, teamName: h.teams?.name }));
    }
    if (matches.length === 0) {
      // fallback: try last-name substring search through all users
      const last = norm.split(' ').filter(Boolean).pop();
      const fuzzy = users.filter(u => normalizeName(u.name || '').includes(last));
      console.log('  fuzzy matches by last name:', fuzzy.map(u => ({ id: u.id, name: u.name })).slice(0,10));
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
