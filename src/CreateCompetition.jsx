
import { useState } from 'react';

export default function CreateCompetition() {
  const [form, setForm] = useState({
  type: 'stroke',
  date: '',
  handicapAllowance: '95',
  fourballs: '',
  notes: '',
  });
  const [created, setCreated] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Use a simple join code for now (could be random or user input)
    const joinCode = 'ABC123';
    // Save competition details to localStorage
    localStorage.setItem(
      `comp_${joinCode}`,
      JSON.stringify({ ...form, code: joinCode })
    );
    setCreated(true);
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
      <h2 className="text-2xl font-bold mb-4 text-green-700">Create Competition</h2>
      {created ? (
        <div className="bg-white p-6 rounded shadow text-center">
          <h3 className="text-xl font-semibold mb-2">Competition Created!</h3>
          <p className="mb-2">Type: <span className="font-medium capitalize">{form.type}</span></p>
          <p className="mb-2">Date: <span className="font-medium">{form.date}</span></p>
          {form.fourballs && <p className="mb-2">4 Balls: <span className="font-medium">{form.fourballs}</span></p>}
          {form.notes && <p className="mb-2">Notes: <span className="font-medium">{form.notes}</span></p>}
          <p className="mt-4 text-green-600 font-bold">Share the join code: <span className="bg-gray-200 px-2 py-1 rounded">ABC123</span></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-md">
          <div className="mb-4">
            <label className="block mb-1 font-medium" htmlFor="date">Date</label>
            <input
              id="date"
              name="date"
              type="date"
              required
              value={form.date}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div className="mb-4">
            <label className="block mb-1 font-medium" htmlFor="type">Competition Type</label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="4bbb-stableford">4BBB Stableford (2 Scores to Count)</option>
              <option value="alliance">Alliance</option>
              <option value="medal-strokeplay">Medal Strokeplay</option>
              <option value="individual-stableford">Individual Stableford</option>
            </select>
          </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium" htmlFor="handicapAllowance">Competition Handicap Allowance</label>
              <select
                id="handicapAllowance"
                name="handicapAllowance"
                value={form.handicapAllowance}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              >
               
                <option value="85">85%</option>
                <option value="90">90%</option>
                <option value="95">95%</option>
                <option value="100">100%</option>
              </select>
            </div>
        
          <div className="mb-4">
            <label className="block mb-1 font-medium" htmlFor="fourballs">How many 4 Balls are playing today?</label>
            <input
              id="fourballs"
              name="fourballs"
              type="number"
              min="1"
              required
              value={form.fourballs}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="e.g. 3"
            />
          </div>
          <div className="mb-6">
            <label className="block mb-1 font-medium" htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Optional notes (e.g. special rules, sponsor etc.)"
            />
          </div>
          <button type="submit" className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition">Create Competition</button>
        </form>
      )}
    </div>
  );
}
