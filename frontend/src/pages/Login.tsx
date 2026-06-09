import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Lock, User, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Connecting to server failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] text-slate-200">
      <div className="w-full max-w-md p-8 bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative text-center mb-8">
          <div className="w-16 h-16 flex items-center justify-center bg-gray-900 border border-slate-800 rounded-2xl mx-auto mb-4 relative z-10 shadow-lg">
            <Zap className="w-8 h-8 text-emerald-500" fill="currentColor" fillOpacity={0.2} />
          </div>
          <h1 className="text-2xl font-bold text-slate-50 tracking-tight">LUMINA 2.0</h1>
          <p className="text-slate-500 text-sm mt-2 tracking-wide">SMART METER DASHBOARD</p>
        </div>

        <form onSubmit={handleLogin} className="relative z-10 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#050505] border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-colors placeholder:text-slate-600"
                placeholder="Enter your username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-5 w-5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#050505] border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-colors placeholder:text-slate-600"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center relative overflow-hidden group"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>ACCESS DASHBOARD</span>
            )}
            
            {/* Hover shine effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></div>
          </button>
        </form>

        <div className="mt-8 text-center border-t border-[#1f1f1f] pt-6 relative z-10">
          <p className="text-xs text-slate-500">
            Secure Microservice Connection • Sri Lanka Operations
          </p>
        </div>
      </div>
    </div>
  );
}
