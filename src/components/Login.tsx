import React, { useState } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[];
}

export const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find((u) => u.username === username.trim() && u.password === password.trim());
    if (user) {
      onLogin(user);
    } else {
      setError('Username atau password salah.');
    }
  };

  const handleReset = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset akun ke default (admin/password)? Semua data user lain akan terhapus.')) {
      localStorage.removeItem('users');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md relative">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Login Sistem Inventory</h1>
          <p className="text-slate-500 mt-2">Silakan masuk untuk melanjutkan</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Masuk
          </button>
        </form>
        
        <button
          type="button"
          onClick={handleReset}
          className="w-full mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Lupa password? Reset ke default
        </button>
      </div>
    </div>
  );
};
