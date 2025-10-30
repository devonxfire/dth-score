import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Leaderboard from './Leaderboard';
import Leaderboard4BBB from './Leaderboard4BBB';
import { apiUrl } from './api';

export default function LeaderboardRouter(props) {
  const { id } = useParams();
  const location = useLocation();
  const [competition, setCompetition] = useState(location.state?.competition || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchCompetition() {
      if (!competition && id) {
        setLoading(true);
        try {
          const res = await fetch(apiUrl(`/api/competitions/${id}`));
          if (res.ok) {
            const data = await res.json();
            setCompetition(data);
          }
        } catch (e) {
          // ignore
        } finally {
          setLoading(false);
        }
      }
    }
    fetchCompetition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !competition) {
    return <div className="p-8 text-center text-lg">Loading leaderboard...</div>;
  }

  const compType = (competition?.type || '').toString().toLowerCase();
  const is4BBB = compType.includes('4bbb') || compType.includes('fourbbb');
  if (is4BBB) {
    console.log('LeaderboardRouter: Rendering Leaderboard4BBB for compType:', compType);
    return <Leaderboard4BBB {...props} competition={competition} />;
  }
  console.log('LeaderboardRouter: Rendering standard Leaderboard for compType:', compType);
  return <Leaderboard {...props} competition={competition} />;
}