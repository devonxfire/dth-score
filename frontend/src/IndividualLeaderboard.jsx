import React from 'react';
import AllianceLeaderboard from './AllianceLeaderboard';

// Use the Alliance leaderboard UI (same as 4BBB) but show individual points
// per-player. This wrapper keeps the route clean and lets us diverge later.
export default function IndividualLeaderboard(props) {
  return <AllianceLeaderboard {...props} />;
}
