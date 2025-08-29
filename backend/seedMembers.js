const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const members = [
    { name: "Andy 'Panda' Williams", username: "andy", password: "williams", isadmin: false },
    { name: "Arno 'Ah No' Erasmus", username: "arno", password: "erasmus", isadmin: true },
    { name: "Brent 'Sally' Lyall", username: "brent", password: "lyall", isadmin: false },
    { name: "Brian 'Grizzly' Galloway", username: "brian", password: "galloway", isadmin: false },
    { name: "Byron 'Mullet' Mulholland", username: "byron", password: "mulholland", isadmin: false },
    { name: "Dave 'Big D' Alhadeff", username: "dave", password: "alhadeff", isadmin: false },
    { name: "David 'Smasher' Dyer", username: "david", password: "dyer", isadmin: false },
    { name: "Denzil 'Takke' Burger", username: "denzil", password: "burger", isadmin: false },
    { name: "Devon 'Radar' Haantjes", username: "devon", password: "haantjes", isadmin: false },
    { name: "Dev 'Tugger' Martindale", username: "dev", password: "martindale", isadmin: true },
    { name: "Eddie '' Scholtz", username: "eddie", password: "scholtz", isadmin: false },
    { name: "Gary 'Chips' Mulder", username: "gary", password: "mulder", isadmin: false },
    { name: "Graeme 'Knotty' Knott", username: "graeme", password: "knott", isadmin: false },
    { name: "Jason 'Jay-Boy' Horn", username: "jason", password: "horn", isadmin: false },
    { name: "Jeremy 'Garmin' Park", username: "jeremy", password: "park", isadmin: false },
    { name: "Jon 'Leak' Horn", username: "jon", password: "horn", isadmin: false },
    { name: "Mike 'Jabba' Downie", username: "mike", password: "downie", isadmin: false },
    { name: "Nigel 'Slumpy' Martindale", username: "nigel", password: "martindale", isadmin: false },
    { name: "Hannes 'Jigsaw' Marais", username: "hannes", password: "marais", isadmin: false },
    { name: "Paul '' Verney", username: "paul", password: "verney", isadmin: false },
    { name: "Stephen 'Skollie' Kelly", username: "stephen", password: "kelly", isadmin: false },
    { name: "Stevie 'Wondie' Steenkamp", username: "stevie", password: "steenkamp", isadmin: false },
    { name: "Storm 'Beefy' Currie", username: "storm", password: "currie", isadmin: false },
    // Guest accounts
    { name: "Guest 1", username: "guest1", password: "guest1", isadmin: false },
    { name: "Guest 2", username: "guest2", password: "guest2", isadmin: false },
    { name: "Guest 3", username: "guest3", password: "guest3", isadmin: false },
  ];

  for (const member of members) {
    await prisma.users.upsert({
      where: { username: member.username },
      update: {}, // No update, just skip if exists
      create: member
    });
  }
  console.log('Members seeded or already present!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
