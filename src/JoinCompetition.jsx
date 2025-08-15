
import { useState } from 'react';
import PageBackground from './PageBackground';
import { useNavigate, useLocation } from 'react-router-dom';


export default function JoinCompetition() {
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    competitionCode: location.state?.code || '',
    name: '',
    handicap: '',
    teebox: 'Yellow',
  });
  const [joined, setJoined] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setJoined(true);
  };

  return (
    <PageBackground>
      <div className="flex flex-col items-center px-4 mt-12">
        <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-lg text-center">Join Competition</h2>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
        {joined ? (
          <div className="w-full max-w-md rounded-2xl shadow-lg bg-transparent text-white text-center" style={{ backdropFilter: 'none' }}>
            <h3 className="text-xl font-semibold mb-2">Joined Competition!</h3>
            <p className="mb-2">Welcome, <span className="font-medium">{form.name}</span>!</p>
            <p className="mb-2">Competition: <span className="font-medium">{form.competitionCode}</span></p>
            <button
              className="mt-6 py-2 px-6 bg-transparent border border-white text-white rounded-2xl font-semibold hover:bg-white hover:text-black transition"
              onClick={() => navigate('/')}
            >
              Back to Home
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl shadow-lg bg-transparent" style={{ backdropFilter: 'none' }}>
            <div className="mb-4">
              <label className="block mb-1 font-medium text-white" htmlFor="name">Your Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
                placeholder="Enter your name"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium text-white" htmlFor="competitionCode">Competition Code</label>
              <input
                id="competitionCode"
                name="competitionCode"
                type="text"
                required
                value={form.competitionCode}
                onChange={handleChange}
                className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
                placeholder="Enter join code"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium text-white" htmlFor="handicap">Handicap (full)</label>
              <input
                id="handicap"
                name="handicap"
                type="number"
                min="0"
                value={form.handicap}
                onChange={handleChange}
                className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
                placeholder="e.g. 12"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-1 font-medium text-white" htmlFor="teebox">Tee Box</label>
              <select
                id="teebox"
                name="teebox"
                value={form.teebox}
                onChange={handleChange}
                className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white"
              >
                <option value="Yellow">Yellow</option>
                <option value="White">White</option>
                <option value="Red">Red</option>
              </select>
            </div>
            <button type="submit" className="w-full py-2 px-4 bg-transparent border border-white text-white font-semibold rounded-2xl hover:bg-white hover:text-black transition">Join Competition</button>
          </form>
        )}
      </div>
    </PageBackground>
  );
}
