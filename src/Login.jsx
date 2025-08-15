


import { useState } from 'react';
import PageBackground from './PageBackground';
import westlakeLogo from './assets/westlake-logo2.png';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ name: '', password: '' });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onLogin(form.name);
  }

  return (
    <PageBackground>
      {/* Logo above the heading */}
      <div className="relative z-10 flex flex-col items-center px-4 mt-12">
        <img
          src={westlakeLogo}
          alt="Westlake Golf Club Badge"
          className="mb-8 max-h-48 w-auto"
          style={{ objectFit: 'contain' }}
        />
        <h1 className="text-5xl font-bold text-white mb-1 drop-shadow-lg text-center">DTH Score</h1>
        <p className="text-xl text-white mb-6 drop-shadow text-center">Keeping track of scores no one cares about.</p>
      </div>
      {/* Form below heading */}
  <div className="relative z-10 flex flex-col items-center px-4 mt-2">
        <div className="w-full max-w-md rounded-2xl shadow-lg bg-transparent" style={{ backdropFilter: 'none' }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
              placeholder="Enter your name"
              autoComplete="off"
              required
            />
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
              placeholder="Enter password"
              required
            />
            <button type="submit" className="w-full py-2 px-4 bg-transparent border border-white text-white font-semibold rounded-2xl hover:bg-white hover:text-black transition text-lg">Sign In</button>
          </form>
        </div>
      </div>
    </PageBackground>
  );
  
  }
