


import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBackground from './PageBackground';
import westlakeLogo from './assets/westlake-logo2.png';



export default function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('http://localhost:5050/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user);
        navigate('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    }
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
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
              placeholder="Enter your username"
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
            {error && (
              <div className="text-red-400 text-center text-sm">{error}</div>
            )}
            <button
              type="submit"
              className="w-full py-2 px-4 border border-white text-white font-semibold rounded-2xl transition text-lg"
              style={{
                backgroundColor: '#1B3A6B', // Westlake blue
                color: 'white',
                boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)'
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </PageBackground>
  );
  
  }
