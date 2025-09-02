import { useEffect, useState } from 'react';

export function useBackendTeams(compId) {
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    if (!compId) return;
    fetch(`/api/teams?competitionId=${compId}`)
      .then(res => res.json())
      .then(data => setTeams(data));
  }, [compId]);
  return teams;
}
