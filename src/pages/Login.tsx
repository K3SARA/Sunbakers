import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { AuthService } from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showQuickFill, setShowQuickFill] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await AuthService.login({
        username: username.trim(),
        password: password.trim()
      });

      const user = response.user;
      localStorage.setItem('distributor_auth_user', JSON.stringify(user));
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Login failure:', err);
      setErrorMessage(
        err.response?.data?.error || 'Invalid credentials. Please verify username and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-screen flex flex-col justify-center items-center relative overflow-hidden select-none bg-cover bg-center bg-no-repeat p-4"
      style={{
        backgroundImage: `url('/login-bg.jpg')`,
        backgroundColor: '#8681b4'
      }}
    >
      {/* Top Left Brand Logo (J&co. SOFTWARE SOLUTIONS) */}
      <div className="absolute top-6 left-6 sm:top-10 sm:left-12 z-20">
        <img
          src="/jco-logo.png"
          alt="J&co. Software Solutions"
          className="h-9 sm:h-12 w-auto object-contain drop-shadow-xs select-none"
        />
      </div>

      {/* Hyper-Minimal White Container (Ref: White Box Login) */}
      <div className="w-full max-w-[390px] sm:max-w-[420px] bg-white rounded-md shadow-2xl p-7 sm:p-10 relative z-10">
        {/* Sunbakers & Confectionary Circular Emblem */}
        <div className="flex justify-center mb-3">
          <img
            src="/sun-bakers-login-logo.png"
            alt="Sunbakers & Confectionary"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-contain drop-shadow-md select-none transition-transform hover:scale-105 duration-300"
          />
        </div>

        <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 text-center mb-1">
          Log in
        </h1>
        <p className="text-[11px] text-slate-400 text-center mb-6 font-medium tracking-wide">
          Sunbakers &amp; Confectionary &bull; Fresh Bakery &amp; Distribution
        </p>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {/* Username */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-700">
              <UserIcon className="w-4 h-4 stroke-[2]" />
            </div>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              className="w-full bg-white border border-[#cfd4dc] rounded-xs pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:italic placeholder-slate-400 focus:outline-none focus:border-slate-800 transition"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-700">
              <Lock className="w-4 h-4 stroke-[2]" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full bg-white border border-[#cfd4dc] rounded-xs pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:italic placeholder-slate-400 focus:outline-none focus:border-slate-800 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Remember Me & Help */}
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 pt-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded-xs border-slate-300 text-black focus:ring-0 cursor-pointer"
              />
              <span>Remember Me</span>
            </label>
            <button
              type="button"
              onClick={() => setShowQuickFill(!showQuickFill)}
              className="hover:text-slate-700 transition cursor-pointer italic"
            >
              Quick Demo Fill
            </button>
          </div>

          {/* Log in Button */}
          <div className="pt-3 text-center">
            <button
              type="submit"
              disabled={loading}
              className="min-w-[125px] bg-black hover:bg-neutral-800 text-white font-medium text-xs tracking-wide py-2.5 px-8 rounded-xs transition disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              {loading ? 'Authenticating...' : 'Log in'}
            </button>
          </div>

          {/* Subtext */}
          <div className="text-center pt-1">
            <span className="text-[11px] text-slate-400 hover:text-slate-600 transition cursor-default">
              Offline Distributor Management
            </span>
          </div>

          {/* Quick Demo Credentials Drawer */}
          {showQuickFill && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 justify-center">
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                }}
                className="px-2.5 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
              >
                Admin (admin / admin123)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('navin');
                  setPassword('navin123');
                }}
                className="px-2.5 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
              >
                Rep (navin / navin123)
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Subtle bottom info */}
      <div className="absolute bottom-4 text-center text-[11px] text-slate-500 font-mono z-10">
        Sunbakers &amp; Confectionary &bull; Powered by J&amp;co. Software Solutions
      </div>
    </div>
  );
};
