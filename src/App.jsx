
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CreateCompetition from './CreateCompetition';
import JoinCompetition from './JoinCompetition';
import RecentCompetitions from './RecentCompetitions';
import CompetitionInfo from './CompetitionInfo';
import Scorecard from './Scorecard';
import Leaderboard from './Leaderboard';
import Login from './Login';

function Landing({ user, onSignOut }) {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-gray-50 px-4 w-full">
      {/* Header */}
      <header className="mb-8 text-center w-full max-w-4xl mx-auto relative">
        <h1 className="text-4xl font-bold text-green-700 mb-2">DTH Score</h1>
        <p className="text-lg text-gray-600">Welcome to DTH Score!</p>
        <div className="absolute top-0 right-0 mt-4 mr-4 flex items-center gap-2">
          <span className="text-gray-700 font-semibold">{user ? user : 'Guest'}</span>
          <button
            onClick={onSignOut}
            className="py-1 px-3 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition text-sm"
          >
            Sign Out
          </button>
        </div>
      </header>
      {/* Main Actions */}
      <main className="flex flex-col sm:flex-row gap-8 w-full max-w-4xl mx-auto justify-center">
        <Link to="/create" className="py-3 px-8 rounded-lg bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition flex-1 text-center flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ display: 'inline', verticalAlign: 'middle' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span>Create Competition</span>
        </Link>
        <Link to="/join" className="py-3 px-8 rounded-lg bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition flex-1 text-center flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ display: 'inline', verticalAlign: 'middle' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          <span>View Competitions</span>
        </Link>
      </main>
      {/* Footer */}
      <footer className="mt-12 text-gray-400 text-sm w-full max-w-4xl mx-auto text-center">
        Dog Tag Hackers Golf Group
      </footer>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) setUser(saved);
  }, []);
  function handleLogin(name) {
    setUser(name);
    localStorage.setItem('user', name);
  }
  function handleSignOut() {
    setUser(null);
    localStorage.removeItem('user');
  }
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing user={user} onSignOut={handleSignOut} />} />
        <Route path="/create" element={<CreateCompetition />} />
        <Route path="/join" element={<RecentCompetitions />} />
        <Route path="/competition-info" element={<CompetitionInfo />} />
        <Route path="/join/form" element={<JoinCompetition />} />
        <Route path="/scorecard" element={<Scorecard />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </Router>
  );
}

export default App;