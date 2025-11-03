import React from 'react';
import MedalScorecard from './MedalScorecard';

// AllianceScorecard initially reuses MedalScorecard for identical UI/flow.
// We'll replace this component's internal scoring logic later without touching MedalScorecard.
export default function AllianceScorecard(props) {
  // Pass an override title so MedalScorecard can render Alliance-specific heading without
  // changing Medal behavior for other comps.
  return <MedalScorecard {...props} overrideTitle="Alliance Competition: Scorecard" />;
}
