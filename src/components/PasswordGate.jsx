import { useState, useEffect } from 'react';

const STORAGE_KEY = 'site-auth';
const PASSWORD = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_PASSWORD
  ? import.meta.env.VITE_SITE_PASSWORD
  : 'optimism';

export default function PasswordGate() {
  const [authenticated, setAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY);
    setAuthenticated(Boolean(stored));
    setMounted(true);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (password === PASSWORD) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY, '1');
      }
      setAuthenticated(true);
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  if (!mounted || authenticated) {
    return <></>;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-page/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-gate-title"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-gray-300 bg-white p-8 shadow-xl dark:border-slate-600 dark:bg-slate-900">
        <h1 id="password-gate-title" className="font-heading text-xl font-semibold text-page mb-2">
          Enter password
        </h1>
        <p className="text-muted text-sm mb-6">
          This site is password protected.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="site-password" className="sr-only">
            Site password
          </label>
          <input
            id="site-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-400 bg-transparent px-4 py-3 text-page placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-500"
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-full border-2 border-primary bg-primary px-6 py-3 font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
