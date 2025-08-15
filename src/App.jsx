
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
    <div
      className="relative min-h-screen bg-cover bg-center flex flex-col"
      style={{
        backgroundImage: "url('https://upload.wikimedia.org/wikipedia/commons/2/2c/Westlake_Golf_Club_Cape_Town.jpg')",
      }}
    >
      {/* Dark overlay to make text pop */}
      <div className="absolute inset-0 bg-black bg-opacity-60" />

      <div className="relative z-10 flex-grow flex flex-col items-center justify-center px-4">
        <h1 className="text-5xl font-bold text-white mb-8 drop-shadow-lg">DTH Score</h1>
        <div className="w-full max-w-sm bg-white bg-opacity-90 rounded-2xl shadow-lg">
          <div className="flex flex-col gap-4 p-6">
            <Link to="/create" className="py-3 px-8 rounded-2xl bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition w-full text-center text-lg">
              Create Competition
            </Link>
            <Link to="/recent" className="py-3 px-8 rounded-2xl bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition w-full text-center text-lg">
              View Competitions
            </Link>
            <Link to="/profile" className="text-green-700 font-medium hover:underline text-center">View Profile</Link>
            <button
              onClick={onSignOut}
              className="py-2 px-6 bg-gray-200 text-gray-700 rounded-2xl hover:bg-gray-300 transition font-semibold w-full"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <footer className="relative z-10 text-center text-white py-4 text-sm mt-auto">
        Dog Tag Hackers Golf Group
      </footer>
    </div>
  );
}


function App() {
  const [user, setUser] = useState(null);

  // Simulate login/session logic
  useEffect(() => {
    // For demo, auto-login as 'devon' after 1s
    const timer = setTimeout(() => setUser('devon'), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleSignOut = () => setUser(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing user={user} onSignOut={handleSignOut} />} />
        <Route path="/create" element={<CreateCompetition user={user} />} />
        <Route path="/join" element={<JoinCompetition user={user} />} />
        <Route path="/recent" element={<RecentCompetitions user={user} />} />
        <Route path="/competition/:id" element={<CompetitionInfo user={user} />} />
        <Route path="/scorecard/:id" element={<Scorecard user={user} />} />
        <Route path="/leaderboard/:id" element={<Leaderboard user={user} />} />
        <Route path="/profile" element={<div className="p-8">User Profile (coming soon)</div>} />
      </Routes>
    </Router>
  );
}

export default App;


