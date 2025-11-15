/*
Simple script to POST a competition JSON to the local backend.
Usage:
  BACKEND_URL=http://localhost:5000 node post_competition.js

If BACKEND_URL is not set, it defaults to http://localhost:5000.
Node 18+ required for global fetch; otherwise run with a fetch polyfill.
*/

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const competition = {
  "id": 301,
  "date": "2025-11-13T00:00:00.000Z",
  "type": "fourBbbStableford",
  "club": "Westlake Golf Club",
  "handicapallowance": "85",
  "joincode": null,
  "notes": "",
  "groups": [
    {
      "dog": {},
      "fines": {},
      "scores": {},
      "waters": {},
      "players": [
        "Jon 'Leak' Horn",
        "Nigel 'Slumpy' Martindale",
        "Jeremy 'Garmin' Park",
        "Gary 'Chips' Mulder"
      ],
      "teeTime": "11:30",
      "teeboxes": {},
      "handicaps": {},
      "two_clubs": {
        "Jon 'Leak' Horn": 0,
        "Gary 'Chips' Mulder": 0,
        "Jeremy 'Garmin' Park": 0,
        "Nigel 'Slumpy' Martindale": 0
      },
      "displayNames": ["", "", "", ""],
      "teamIds": [283, 284]
    }
  ],
  "course_id": null,
  "created_at": "2025-11-13T08:55:00.517Z",
  "fourballs": null,
  "status": "Open",
  "holes": [
    {"id":5167,"competition_id":301,"number":1,"par":4,"stroke_index":5},
    {"id":5168,"competition_id":301,"number":2,"par":4,"stroke_index":7},
    {"id":5169,"competition_id":301,"number":3,"par":3,"stroke_index":17},
    {"id":5170,"competition_id":301,"number":4,"par":5,"stroke_index":1},
    {"id":5171,"competition_id":301,"number":5,"par":4,"stroke_index":11},
    {"id":5172,"competition_id":301,"number":6,"par":3,"stroke_index":15},
    {"id":5173,"competition_id":301,"number":7,"par":5,"stroke_index":3},
    {"id":5174,"competition_id":301,"number":8,"par":4,"stroke_index":13},
    {"id":5175,"competition_id":301,"number":9,"par":4,"stroke_index":9},
    {"id":5176,"competition_id":301,"number":10,"par":4,"stroke_index":10},
    {"id":5177,"competition_id":301,"number":11,"par":4,"stroke_index":4},
    {"id":5178,"competition_id":301,"number":12,"par":4,"stroke_index":12},
    {"id":5179,"competition_id":301,"number":13,"par":5,"stroke_index":2},
    {"id":5180,"competition_id":301,"number":14,"par":4,"stroke_index":14},
    {"id":5181,"competition_id":301,"number":15,"par":3,"stroke_index":18},
    {"id":5182,"competition_id":301,"number":16,"par":5,"stroke_index":6},
    {"id":5183,"competition_id":301,"number":17,"par":3,"stroke_index":16},
    {"id":5184,"competition_id":301,"number":18,"par":4,"stroke_index":8}
  ],
  "debug": [
    {
      "groupPlayers": [
        "Jon 'Leak' Horn",
        "Nigel 'Slumpy' Martindale",
        "Jeremy 'Garmin' Park",
        "Gary 'Chips' Mulder"
      ],
      "foundTeam": null
    }
  ],
  "users": [
    {"id":1,"name":"Andy 'Panda' Williams","username":"andy","password":"williams","isadmin":false},
    {"id":2,"name":"Arno 'Ah No' Erasmus","username":"arno","password":"erasmus","isadmin":true},
    {"id":3,"name":"Brent 'Sally' Lyall","username":"brent","password":"lyall","isadmin":false},
    {"id":4,"name":"Brian 'Grizzly' Galloway","username":"brian","password":"galloway","isadmin":false},
    {"id":5,"name":"Byron 'Mullet' Mulholland","username":"byron","password":"mulholland","isadmin":false},
    {"id":6,"name":"Dave 'Big D' Alhadeff","username":"dave","password":"alhadeff","isadmin":false},
    {"id":7,"name":"David 'Smasher' Dyer","username":"david","password":"dyer","isadmin":false},
    {"id":8,"name":"Denzil 'Takke' Burger","username":"denzil","password":"burger","isadmin":false},
    {"id":9,"name":"Devon 'Radar' Haantjes","username":"devon","password":"haantjes","isadmin":false},
    {"id":10,"name":"Dev 'Tugger' Martindale","username":"dev","password":"martindale","isadmin":true},
    {"id":11,"name":"Eddie '' Scholtz","username":"eddie","password":"scholtz","isadmin":false},
    {"id":12,"name":"Gary 'Chips' Mulder","username":"gary","password":"mulder","isadmin":false},
    {"id":13,"name":"Graeme 'Knotty' Knott","username":"graeme","password":"knott","isadmin":false},
    {"id":14,"name":"Jason 'Jay-Boy' Horn","username":"jason","password":"horn","isadmin":false},
    {"id":15,"name":"Jeremy 'Garmin' Park","username":"jeremy","password":"park","isadmin":false},
    {"id":16,"name":"Jon 'Leak' Horn","username":"jon","password":"horn","isadmin":false},
    {"id":17,"name":"Mike 'Jabba' Downie","username":"mike","password":"downie","isadmin":false},
    {"id":18,"name":"Nigel 'Slumpy' Martindale","username":"nigel","password":"martindale","isadmin":false},
    {"id":19,"name":"Hannes 'Jigsaw' Marais","username":"hannes","password":"marais","isadmin":false},
    {"id":20,"name":"Paul '' Verney","username":"paul","password":"verney","isadmin":false},
    {"id":21,"name":"Stephen 'Skollie' Kelly","username":"stephen","password":"kelly","isadmin":false},
    {"id":22,"name":"Stevie 'Wondie' Steenkamp","username":"stevie","password":"steenkamp","isadmin":false},
    {"id":23,"name":"Storm 'Beefy' Currie","username":"storm","password":"currie","isadmin":false},
    {"id":24,"name":"GUEST Burt Reds","username":"guest_burt_reds","password":"","isadmin":false},
    {"id":26,"name":"Guest 1","username":"guest1","password":"guest1","isadmin":false},
    {"id":27,"name":"Guest 2","username":"guest2","password":"guest2","isadmin":false},
    {"id":28,"name":"Guest 3","username":"guest3","password":"guest3","isadmin":false},
    {"id":29,"name":"Brett \"Roger\" Martindale","username":"brett","password":"martindale","isadmin":false}
  ]
};

async function postCompetition() {
  const url = `${BACKEND_URL}/api/competitions`;
  console.log(`Posting competition to ${url} ...`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(competition)
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
    if (!res.ok) {
      console.error('Failed to create competition', res.status, parsed);
      process.exitCode = 2;
      return;
    }
    console.log('Created competition:', parsed);
  } catch (err) {
    console.error('Error posting competition:', err.message || err);
    process.exitCode = 1;
  }
}

postCompetition();
