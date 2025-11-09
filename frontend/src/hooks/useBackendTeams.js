import { useEffect, useState } from 'react';
import { apiUrl } from '../api';
import socket from '../socket';

export function useBackendTeams(compId) {
  const [teams, setTeams] = useState([]);

  async function fetchTeams() {
    if (!compId) return;
    try {
      const res = await fetch(apiUrl(`/api/teams?competitionId=${compId}`));
      if (!res.ok) return;
      const data = await res.json();
      setTeams(data || []);
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    fetchTeams();
    // listen for socket events that should trigger a teams refresh
    const handler = (msg) => {
      try {
        if (!msg || Number(msg.competitionId) !== Number(compId)) return;
        // On scores or medal updates, refresh the backend teams list
        fetchTeams();
      } catch (e) {}
    };
    try {
      socket.on('scores-updated', handler);
      socket.on('medal-player-updated', handler);
      socket.on('team-user-updated', handler);
    } catch (e) {}
    return () => {
      try {
        socket.off('scores-updated', handler);
        socket.off('medal-player-updated', handler);
        socket.off('team-user-updated', handler);
      } catch (e) {}
    };
  }, [compId]);

  return teams;
}
