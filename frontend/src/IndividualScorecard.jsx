import React from 'react';
import AllianceScorecard from './AllianceScorecard';

// Use the Alliance/4BBB scorecard UI for Individual Stableford so the look
// and feel matches other multi-player scorecards. We still enforce a default
// handicap allowance of 95% when none is provided.
export default function IndividualScorecard(props) {
  const incoming = props.competition || props.initialCompetition || null;
  const adjusted = incoming ? { ...incoming } : null;
  if (adjusted) {
    if (adjusted.handicapallowance === undefined || adjusted.handicapallowance === null || adjusted.handicapallowance === '') {
      adjusted.handicapallowance = 95;
    }
  }
  return (
    <AllianceScorecard {...props} competition={adjusted} overrideTitle="Individual Stableford" compTypeOverride="individualStableford" />
  );
}
