
import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Scorecard from './Scorecard';
import MedalScorecard from './MedalScorecard';
import AllianceScorecard from './AllianceScorecard';
import { apiUrl } from './api';

// This router fetches the competition if not provided, then renders the correct scorecard
export default function ScorecardRouter(props) {
  const { id } = useParams();
  const location = useLocation();
  // Prefer location.state, fallback to props, fallback to fetch by id from URL
  const initialCompetition = location.state?.competition || props.competition || null;
  const [competition, setCompetition] = useState(initialCompetition);
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
    return <div className="p-8 text-center text-lg">Loading scorecard...</div>;
  }

  // If compTypeOverride is set, use that (for testing or forced type)
  const compType = (props.compTypeOverride || competition?.type || '').toString();
  const compTypeLower = compType.toLowerCase();
  const is4BBB = compTypeLower.includes('4bbb') || compTypeLower.includes('fourbbb');
  const chars = compTypeLower.split('');
  const charCodes = chars.map(c => c.charCodeAt(0));
  if (is4BBB) {
    // Render the Alliance scorecard UI for 4BBB competitions for visual parity.
    // Pass an explicit title override so the heading says "4BBB Stableford" while
    // keeping the Alliance component and MedalScorecard behavior untouched.
    return <AllianceScorecard {...props} competition={competition} overrideTitle="4BBB Stableford" />;
  }
  const isAlliance = compTypeLower.includes('alliance');
  if (isAlliance) {
    return <AllianceScorecard {...props} competition={competition} />;
  }
  // Medal logic: render MedalScorecard for Medal comps
  const isMedal = compTypeLower.includes('medal');
  if (isMedal) {
    return <MedalScorecard {...props} competition={competition} />;
  }
  return <Scorecard {...props} competition={competition} />;
}
