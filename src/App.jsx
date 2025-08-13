import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CreateCompetition from './CreateCompetition';
import JoinCompetition from './JoinCompetition';
import Scorecard from './Scorecard';
import Leaderboard from './Leaderboard';

function Landing() {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-gray-50 px-4 w-full">
      {/* Header */}
      <header className="mb-8 text-center w-full max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-green-700 mb-2">DTH Score</h1>
        <p className="text-lg text-gray-600">Welcome to DTH Score!</p>
      </header>
      {/* Main Actions */}
      <main className="flex flex-col sm:flex-row gap-8 w-full max-w-4xl mx-auto justify-center">
        <Link to="/create" className="py-3 px-8 rounded-lg bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition flex-1 text-center">Create Competition</Link>
        <Link to="/join" className="py-3 px-8 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition flex-1 text-center">Join Competition</Link>
        <Link to="/scorecard" className="py-3 px-8 rounded-lg bg-purple-600 text-white font-semibold shadow hover:bg-purple-700 transition flex-1 text-center">Scorecard (Demo)</Link>
        <Link to="/leaderboard" className="py-3 px-8 rounded-lg bg-yellow-500 text-white font-semibold shadow hover:bg-yellow-600 transition flex-1 text-center">Leaderboard</Link>
      </main>
      {/* Footer */}
      <footer className="mt-12 text-gray-400 text-sm w-full max-w-4xl mx-auto text-center">
        Dog Tag Hackers Golf Group
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create" element={<CreateCompetition />} />
        <Route path="/join" element={<JoinCompetition />} />
        <Route path="/scorecard" element={<Scorecard />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </Router>
  );
}

export default App;