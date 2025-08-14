
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function JoinCompetition() {
  const location = useLocation();
  const [form, setForm] = useState({
    code: location.state?.code || '',
    name: '',
    handicap: '',
    teebox: 'Yellow',
  });
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Look up competition details by join code
    const comp = localStorage.getItem(`comp_${form.code}`);
    if (!comp) {
      alert('Competition not found. Please check the join code.');
      return;
    }
    const competition = JSON.parse(comp);
    // Redirect to scorecard, passing player info and competition
    navigate('/scorecard', { state: { player: form, competition } });
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
      <h2 className="text-2xl font-bold mb-4 text-blue-700">Join Competition</h2>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-md">
        <div className="mb-4">
          <label className="block mb-1 font-medium" htmlFor="code">Join Code</label>
          <input
            id="code"
            name="code"
            type="text"
            required
            value={form.code}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter join code"
          />
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-medium" htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter your name"
          />
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-medium" htmlFor="handicap">Handicap (full)</label>
          <input
            id="handicap"
            name="handicap"
            type="number"
            min="0"
            value={form.handicap}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="e.g. 12"
          />
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-medium" htmlFor="teebox">Tee Box</label>
          <select
            id="teebox"
            name="teebox"
            value={form.teebox}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="Yellow">Yellow</option>
            <option value="White">White</option>
            <option value="Red">Red</option>
          </select>
        </div>
        <button type="submit" className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition">Join Competition</button>
      </form>
    </div>
  );
}
