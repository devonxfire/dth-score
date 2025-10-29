


import { useState } from 'react';
import { apiUrl } from './api';
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
  const res = await fetch(apiUrl('/api/login'), {
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
  <h1 className="text-6xl font-extrabold drop-shadow-lg text-center mb-1" style={{ color: 'white', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px', fontSize: '4rem' }}>DTH Score</h1>
  <p className="text-xl text-center mb-6 drop-shadow" style={{ color: 'white', fontFamily: 'Lato, Arial, sans-serif', fontWeight: 600 }}>Keeping track of scores no one cares about.</p>
      </div>
      {/* Form below heading */}
  <div className="relative z-10 flex flex-col items-center px-4 mt-2">
  <div className="w-full max-w-md rounded-2xl bg-transparent" style={{ backdropFilter: 'none' }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6" style={{ fontFamily: 'Lato, Arial, sans-serif', color: 'white' }}>
            <input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
              style={{ fontFamily: 'Lato, Arial, sans-serif', fontWeight: 600, color: 'white', background: 'transparent' }}
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
              style={{ fontFamily: 'Lato, Arial, sans-serif', fontWeight: 600, color: 'white', background: 'transparent' }}
              placeholder="Enter password"
              required
            />
            {error && (
              <div className="text-red-400 text-center text-sm">{error}</div>
            )}
            <button
              type="submit"
              className="w-full py-2 px-4 font-bold rounded-2xl transition text-lg"
              style={{ backgroundColor: '#002F5F', color: '#fff', fontFamily: 'Lato, Arial, sans-serif', border: 'none' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#17407e'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#002F5F'}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </PageBackground>
  );
  
  }
