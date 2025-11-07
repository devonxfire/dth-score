import React from 'react';
import AllianceLeaderboard from './AllianceLeaderboard';

// Simple wrapper: render the Alliance leaderboard UI for 4BBB to ensure visual parity.
export default function Leaderboard4BBB(props) {
  return <AllianceLeaderboard {...props} />;
}