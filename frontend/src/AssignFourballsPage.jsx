import React, { useEffect, useState } from 'react';

import { useNavigate, useParams, useLocation } from 'react-router-dom';
import UnifiedFourballAssignment from './UnifiedFourballAssignment';
import { apiUrl } from './api';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';
import ConfirmNavigationPopup from './ConfirmNavigationPopup';

export default function AssignFourballsPage({ user }) {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const compId = params.id || (location.state && location.state.compId);
  const [initialGroups, setInitialGroups] = useState(location.state?.initialGroups || []);

  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [blocking, setBlocking] = useState(true);
  const [showNavConfirm, setShowNavConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  useEffect(() => {
    if (!compId) return;
    // Always fetch competition to get type and groups
    async function fetchComp() {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/competitions/${compId}`));
        if (res.ok) {
          const data = await res.json();
          setComp(data);
          if ((!initialGroups || initialGroups.length === 0) && data.groups) {
            setInitialGroups(data.groups);
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchComp();
  }, [compId]);

  async function handleAssign(groupsData) {
    // PATCH groups for this competition (admin only)
    if (!compId) return;
    try {
      // Merge existing per-player mappings from `comp` into the outgoing groups so
      // unchanged players keep their scores/teeboxes/handicaps/waters/dog/two_clubs/fines.
      // We find the best-matching existing group by player overlap and use it as a base.
      let mergedGroups = groupsData.map(g => ({ ...g }));
      if (comp && Array.isArray(comp.groups)) {
        const existingGroups = comp.groups;
        function normalize(n) { return (n || '').toString().trim().toLowerCase(); }

        // For each incoming group, pick best matching existing group by overlap
        mergedGroups = mergedGroups.map((incoming) => {
          const incomingPlayers = Array.isArray(incoming.players) ? incoming.players.filter(Boolean) : [];
          let bestIdx = -1;
          let bestOverlap = 0;
          for (let j = 0; j < existingGroups.length; j++) {
            const eg = existingGroups[j];
            if (!eg || !Array.isArray(eg.players)) continue;
            const overlap = eg.players.filter(p => incomingPlayers.some(ip => normalize(ip) === normalize(p))).length;
            if (overlap > bestOverlap) { bestOverlap = overlap; bestIdx = j; }
          }
          const base = (bestIdx !== -1 && existingGroups[bestIdx]) ? existingGroups[bestIdx] : null;
          const merged = base ? JSON.parse(JSON.stringify(base)) : { players: incomingPlayers };
          // Replace players order with incoming
          merged.players = Array.isArray(incoming.players) ? incoming.players : merged.players || [];

          // Preserve per-player maps where possible
          const props = ['scores','teeboxes','handicaps','waters','dog','two_clubs','fines'];
          // Build a normalized lookup for base player names so small punctuation/spacing differences still match
          const baseNameLookup = {};
          if (base && Array.isArray(base.players)) {
            for (const bp of base.players) {
              if (!bp) continue;
              baseNameLookup[normalize(bp)] = bp;
            }
          }
          for (const prop of props) {
            // Build a new map keyed only by the incoming merged.players. This removes stale keys (old player names)
            const newMap = {};
            const incomingMap = (incoming && incoming[prop]) && typeof incoming[prop] === 'object' ? incoming[prop] : {};
            const baseMap = (base && base[prop]) && typeof base[prop] === 'object' ? base[prop] : {};
            for (const p of merged.players) {
              if (!p) continue;
              // incoming overrides take precedence
              if (incomingMap && incomingMap[p] !== undefined) {
                newMap[p] = incomingMap[p];
                continue;
              }
              const key = baseNameLookup[normalize(p)];
              if (key !== undefined && baseMap && baseMap[key] !== undefined) {
                try {
                  newMap[p] = JSON.parse(JSON.stringify(baseMap[key]));
                } catch (e) {
                  newMap[p] = baseMap[key];
                }
              }
            }
            merged[prop] = newMap;
          }
          // displayNames: prefer incoming, else map by name from base
          if (Array.isArray(incoming.displayNames) && incoming.displayNames.length) {
            merged.displayNames = incoming.displayNames.slice();
          } else if (base && Array.isArray(base.displayNames) && Array.isArray(base.players)) {
            merged.displayNames = Array(merged.players.length).fill('');
            for (let idx = 0; idx < merged.players.length; idx++) {
              const nm = merged.players[idx];
              const bidx = base.players.findIndex(bp => normalize(bp) === normalize(nm));
              if (bidx >= 0 && base.displayNames && base.displayNames[bidx] !== undefined) merged.displayNames[idx] = base.displayNames[bidx];
            }
          } else {
            merged.displayNames = Array(merged.players.length).fill('');
          }

          // ensure teeTime/name override from incoming
          if (incoming.teeTime !== undefined) merged.teeTime = incoming.teeTime;
          if (incoming.name !== undefined) merged.name = incoming.name;

          return merged;
        });
      }

      const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
      const res = await fetch(apiUrl(`/api/competitions/${compId}/groups`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ groups: mergedGroups })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to save groups');
      }
      // After success, allow navigation back to competition page
      setBlocking(false);
      navigate(`/competition/${compId}`);
    } catch (err) {
      alert('Failed to save groups: ' + (err.message || err));
    }
  }

  // Warn when navigating away while editing groups without saving
  useEffect(() => {
    const shouldWarn = blocking;
    function beforeUnload(e) {
      if (!shouldWarn) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
    function onDocClick(e) {
      if (!shouldWarn) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (a && !a.getAttribute('href').startsWith('#')) {
        e.preventDefault();
        e.stopPropagation();
        setPendingNavigation(() => () => {
          const href = a.getAttribute('href');
          if (href) window.location.href = href;
        });
        setShowNavConfirm(true);
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onDocClick, true);
    // Provide a global navigation guard for TopMenu button navigations
    window.confirmNavigation = (callback) => {
      if (!shouldWarn) return true;
      setPendingNavigation(() => callback);
      setShowNavConfirm(true);
      return false;
    };
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onDocClick, true);
      if (window.confirmNavigation) delete window.confirmNavigation;
    };
  }, [blocking]);

  return (
    <PageBackground>
      <TopMenu user={user} userComp={comp} competitionList={comp ? [comp] : []} />
      {showNavConfirm && (
        <ConfirmNavigationPopup
          title="Discard Changes?"
          message="Are you sure you want to discard editing this competition?"
          onConfirm={() => {
            setShowNavConfirm(false);
            setBlocking(false);
            if (pendingNavigation) {
              pendingNavigation();
              setPendingNavigation(null);
            }
          }}
          onCancel={() => {
            setShowNavConfirm(false);
            setPendingNavigation(null);
          }}
        />
      )}
      <div className="flex flex-col items-center px-4 mt-12">
        <div className="w-full max-w-2xl">
          {/* Title removed per UI request */}
          {loading && <div className="text-white">Loading groups...</div>}
          {!loading && (
            <UnifiedFourballAssignment
              fourballs={(initialGroups && initialGroups.length) || 1}
              initialGroups={initialGroups}
              onAssign={handleAssign}
              competitionType={comp?.type || "fourball"}
              compId={compId}
              nested={true}
            />
          )}
        </div>
      </div>
    </PageBackground>
  );
}
