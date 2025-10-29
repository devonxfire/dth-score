import { useEffect, useState } from 'react';
import { apiUrl } from '../api';

export function useBackendTeams(compId) {
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    if (!compId) return;
    fetch(apiUrl(`/api/teams?competitionId=${compId}`))
      .then(res => res.json())
      .then(data => setTeams(data));
  }, [compId]);
  return teams;
}
