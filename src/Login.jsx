import { useState } from 'react';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ name: '', password: '' });
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Allow login even if fields are blank
    onLogin(form.name);
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4 w-full">
      {/* Header */}
      <header className="mb-8 text-center w-full max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-green-700 mb-2">DTH Score</h1>
        <p className="text-lg text-gray-600">Welcome to DTH Score!</p>
      </header>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-green-700 text-center">Login</h2>
  {/* No error message needed for blank fields */}
        <div className="mb-4">
          <label className="block mb-1 font-medium" htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Enter your name"
            autoComplete="off"
          />
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-medium" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Enter password"
          />
        </div>
        <button type="submit" className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition">Login</button>
      </form>
      {/* Footer */}
      <footer className="mt-12 text-gray-400 text-sm w-full max-w-4xl mx-auto text-center">
        Dog Tag Hackers Golf Group
      </footer>
    </div>
  );
}
