
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import CreateCompetition from './CreateCompetition';
import JoinCompetition from './JoinCompetition';
import RecentCompetitions from './RecentCompetitions';
import CompetitionInfo from './CompetitionInfo';
import Scorecard from './Scorecard';
import ScorecardRouter from './ScorecardRouter';
import Leaderboard from './Leaderboard';
import Leaderboard4BBB from './Leaderboard4BBB';
import LeaderboardRouter from './LeaderboardRouter';
import Login from './Login';
import Dashboard from './Dashboard';
import ResultsMedal from './ResultsMedal';
import UnifiedFourballAssignment from './UnifiedFourballAssignment';
import MedalScorecard from './MedalScorecard';
import MedalLeaderboard from './MedalLeaderboard';
import AllianceScorecard from './AllianceScorecard';
import AllianceLeaderboard from './AllianceLeaderboard';
import IndividualScorecard from './IndividualScorecard';
import IndividualLeaderboard from './IndividualLeaderboard';
import FourballScorecard from './FourballScorecard';
import FourballLeaderboard from './FourballLeaderboard';
import AssignFourballsPage from './AssignFourballsPage';
import InstallPrompt from './InstallPrompt';
import GlobalPopups from './GlobalPopups';

function AppRoutes({ user, setUser }) {
  const navigate = useNavigate();
  // No auto-login; user must log in manually
  const handleSignOut = () => {
    setUser(null);
    navigate('/login');
  };
  // Expose signOut globally for menu links
  useEffect(() => {
    window.signOut = handleSignOut;
    window.onSignOut = handleSignOut;
    return () => {
      delete window.signOut;
      delete window.onSignOut;
    };
  }, []);
  return (
    <Routes>
      {/* Always show login page at /login */}
      <Route path="/login" element={<Login onLogin={setUser} />} />
      {/* If not logged in, redirect all other routes to /login */}
      {!user ? (
        <Route path="*" element={<Login onLogin={setUser} />} />
      ) : (
        <>

          <Route path="/dashboard" element={<Dashboard user={user} onSignOut={handleSignOut} />} />
          <Route path="/" element={<Dashboard user={user} onSignOut={handleSignOut} />} />
          <Route path="/create" element={<CreateCompetition user={user} />} />
          <Route path="/join" element={<JoinCompetition user={user} />} />
          <Route path="/recent" element={<RecentCompetitions user={user} />} />
          <Route path="/competition/:id" element={<CompetitionInfo user={user} />} />
          <Route path="/competition/:id/edit" element={<CreateCompetition user={user} />} />
          <Route path="/scorecard/:id" element={<ScorecardRouter user={user} />} />
          <Route path="/leaderboard/:id" element={<LeaderboardRouter user={user} />} />
          <Route path="/results/:id" element={<ResultsMedal />} />
          <Route path="/profile" element={<div className="p-8">User Profile (coming soon)</div>} />
          <Route path="/assign-medal" element={<UnifiedFourballAssignment user={user} onSignOut={handleSignOut} competitionType="medal" />} />
          <Route path="/assign-medal/:id" element={<UnifiedFourballAssignment user={user} onSignOut={handleSignOut} competitionType="medal" />} />
          <Route path="/assign-alliance" element={<UnifiedFourballAssignment user={user} onSignOut={handleSignOut} competitionType="alliance" />} />
          <Route path="/assign-alliance/:id" element={<UnifiedFourballAssignment user={user} onSignOut={handleSignOut} competitionType="alliance" />} />
          <Route path="/scorecard-medal/:id" element={<MedalScorecard user={user} onSignOut={handleSignOut} />} />
          <Route path="/leaderboard-medal/:id" element={<MedalLeaderboard user={user} onSignOut={handleSignOut} />} />
          <Route path="/medal-leaderboard/:id" element={<MedalLeaderboard user={user} onSignOut={handleSignOut} />} />
          <Route path="/scorecard-individual/:id" element={<IndividualScorecard user={user} onSignOut={handleSignOut} />} />
          <Route path="/leaderboard-individual/:id" element={<IndividualLeaderboard user={user} onSignOut={handleSignOut} />} />
          {/* Alliance routes: unified assignment component, separate scorecard/leaderboard wrappers */}
          <Route path="/scorecard-alliance/:id" element={<AllianceScorecard user={user} onSignOut={handleSignOut} />} />
          <Route path="/leaderboard-alliance/:id" element={<AllianceLeaderboard user={user} onSignOut={handleSignOut} />} />
          <Route path="/alliance-leaderboard/:id" element={<AllianceLeaderboard user={user} onSignOut={handleSignOut} />} />
          <Route path="/assign-fourball" element={<AssignFourballsPage user={user} />} />
          <Route path="/assign-4balls/:id" element={<AssignFourballsPage user={user} />} />
          <Route path="/scorecard-fourball/:id" element={<FourballScorecard user={user} onSignOut={handleSignOut} />} />
          <Route path="/leaderboard-fourball/:id" element={<FourballLeaderboard user={user} onSignOut={handleSignOut} />} />
        </>
      )}
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  // When user logs out, clear localStorage
  const handleSetUser = (u) => {
    setUser(u);
    if (!u) localStorage.removeItem('user');
  };
  return (
    <Router>
      <AppRoutes user={user} setUser={handleSetUser} />
      <GlobalPopups />
      <InstallPrompt />
    </Router>
  );
}

export default App;


