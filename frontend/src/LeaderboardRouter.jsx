import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Leaderboard from './Leaderboard';
import Leaderboard4BBB from './Leaderboard4BBB';
import AllianceLeaderboard from './AllianceLeaderboard';
import MedalLeaderboard from './MedalLeaderboard';
import IndividualLeaderboard from './IndividualLeaderboard';
import { apiUrl } from './api';

export default function LeaderboardRouter(props) {
  const { id } = useParams();
  const location = useLocation();
  useEffect(() => {
    try {
      console.debug('LeaderboardRouter:init', { paramId: id, locationState: location.state, initialCompetition: location.state?.competition || null });
    } catch (e) {
      // ignore logging failures
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use any competition passed via location.state optimistically, but always
  // fetch the authoritative competition object from the server for the route id.
  const [competition, setCompetition] = useState(location.state?.competition || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      console.debug('LeaderboardRouter:init', { paramId: id, locationState: location.state, initialCompetition: location.state?.competition || null });
    } catch (e) {
      // ignore logging failures
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function fetchCompetition() {
      if (!id) return;
      setLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/competitions/${id}`));
        if (res.ok) {
          const data = await res.json();
          try { console.debug('LeaderboardRouter: fetched competition for id', id, data); } catch (e) {}
          if (!cancelled) setCompetition(data);

          // If the navigation did NOT include a competition via location.state,
          // prefer directing users to the currently OPEN competition (most-recent).
          // This avoids TopMenu/URL race conditions where a stale leaderboard id
          // remains in the URL. However, if the caller explicitly provided a
          // competition object in location.state we respect that (e.g. clicking
          // Leaderboard from CompetitionInfo).
          try {
            if (!location.state?.competition) {
              const today = new Date();
              const listRes = await fetch(apiUrl('/api/competitions'));
              if (listRes.ok) {
                const all = await listRes.json();
                const open = (all || []).filter(c => c && (c.status === 'Open' || (c.date && new Date(c.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))));
                if (open.length > 0) {
                  open.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                  const pick = open[0];
                  const pickId = pick.id || pick._id || pick.joinCode || pick.joincode;
                  if (pickId && pickId.toString() !== id.toString()) {
                    try { console.debug('LeaderboardRouter: redirecting to current open competition (no location.state)', pickId, pick); } catch (e) {}
                    navigate(`/leaderboard/${pickId}`, { replace: true, state: { competition: pick } });
                    return;
                  }
                }
              }
            }
          } catch (e) {
            // ignore redirect errors
          }
        }
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCompetition();
    return () => { cancelled = true; };
  }, [id, navigate]);

  if (loading || !competition) {
  if (loading || !competition) {
    return <div className="p-8 text-center text-lg">Loading leaderboard...</div>;
  }

  try { console.debug('LeaderboardRouter: using competition before render', competition); } catch (e) {}
  }

  const compType = (competition?.type || '').toString().toLowerCase();
  const is4BBB = compType.includes('4bbb') || compType.includes('fourbbb');
  if (is4BBB) {
    return <Leaderboard4BBB {...props} competition={competition} />;
  }
  const isIndividual = (compType.includes('individual') && compType.includes('stableford')) || ((competition?.name || '').toString().toLowerCase().includes('individual') && (competition?.name || '').toString().toLowerCase().includes('stableford'));
  if (isIndividual) {
    return <IndividualLeaderboard {...props} competition={competition} />;
  }
  const isMedal = compType.includes('medal') || compType.includes('stroke');
  const isAlliance = compType.includes('alliance');
  if (isAlliance) {
    return <AllianceLeaderboard {...props} competition={competition} />;
  }
  if (isMedal) {
    return <MedalLeaderboard {...props} competition={competition} />;
  }
  return <Leaderboard {...props} competition={competition} />;
}