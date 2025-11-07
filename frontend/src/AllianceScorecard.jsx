import React from 'react';
import MedalScorecard from './MedalScorecard';

// AllianceScorecard initially reuses MedalScorecard for identical UI/flow.
// We'll replace this component's internal scoring logic later without touching MedalScorecard.
export default function AllianceScorecard(props) {
  // Allow callers to override the title (used for 4BBB to keep visual parity but
  // show the correct heading). If no override is passed, keep the Alliance default.
  const title = props.overrideTitle ?? 'Alliance Competition: Scorecard';
  return <MedalScorecard {...props} overrideTitle={title} />;
}
