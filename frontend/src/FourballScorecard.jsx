import React from 'react';
import AllianceScorecard from './AllianceScorecard';

// Use the Alliance/Medal scorecard UI for Fourball (4BBB) pages so mobile and
// desktop views match the Alliance implementation. Pass an explicit title
// override so the header reads "4BBB Stableford" while reusing the Alliance UI.
export default function FourballScorecard(props) {
  return <AllianceScorecard {...props} overrideTitle="4BBB Stableford" />;
}
