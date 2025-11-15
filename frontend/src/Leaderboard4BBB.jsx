import React, { useEffect, useState } from 'react';
import AllianceLeaderboard from './AllianceLeaderboard';
import { apiUrl } from './api';

// 4BBB wrapper: attempt to defensively enrich the competition payload with
// per-player course_handicap when the server hasn't provided `group.handicaps`.
// This keeps AllianceLeaderboard authoritative but gives 4BBB a client-side
// fallback so Net/DTH Net render correctly even when server data is missing.
export default function Leaderboard4BBB(props) {
  const [initialComp, setInitialComp] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAndEnrich() {
      try {
        const id = window.location.pathname.split('/').pop();
        const res = await fetch(apiUrl(`/api/competitions/${id}`));
        if (!res.ok) return; // let AllianceLeaderboard fetch itself
        const data = await res.json();

        // If groups already have handicaps, pass straight through
        const groupsNeeding = (data.groups || []).filter(g => !g || !g.handicaps || Object.keys(g.handicaps || {}).length === 0);
        if (groupsNeeding.length === 0) {
          if (!cancelled) setInitialComp(data);
          return;
        }

        // Try debug endpoint which returns teams_users rows (includes user.name and course_handicap)
        try {
          const dbg = await fetch(apiUrl(`/api/debug/teams_users?competitionId=${data.id}`));
          if (dbg.ok) {
            const rows = await dbg.json();
            const map = {};
            (rows || []).forEach(r => {
              const uname = (r.user && r.user.name) || r.userName || r.user_name || null;
              const ch = r.course_handicap != null ? r.course_handicap : (r.courseHandicap != null ? r.courseHandicap : null);
              if (uname && ch != null) map[(uname || '').trim().toLowerCase()] = String(ch);
            });
            // Apply mapping to missing group.handicaps
            (data.groups || []).forEach(g => {
              if (!g) return;
              g.handicaps = g.handicaps || {};
              (g.players || []).forEach(p => {
                const key = (p || '').trim().toLowerCase();
                if (!g.handicaps[p] && map[key] != null) g.handicaps[p] = map[key];
              });
            });
            if (!cancelled) setInitialComp(data);
            return;
          }
        } catch (e) {
          // ignore and fallthrough to letting AllianceLeaderboard fetch
        }

        // If debug endpoint isn't available, just pass the raw payload and let server-side enrichment (or Alliance) handle it
        if (!cancelled) setInitialComp(data);
      } catch (err) {
        // Ignore — AllianceLeaderboard will fetch itself and handle
      }
    }
    fetchAndEnrich();
    return () => { cancelled = true; };
  }, []);

  return <AllianceLeaderboard initialComp={initialComp} {...props} />;
}