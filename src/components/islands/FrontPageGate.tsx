import { useState, useEffect, type ReactNode } from 'react';

const STORAGE_KEY = 'frontPageUnlocked';

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface Props {
  passwordHash: string;
  children: ReactNode;
}

/** Render slot content: Astro passes the default slot as HTML string when hydrating islands. */
function SlotContent({ children }: { children: ReactNode }) {
  if (typeof children === 'string' && children.length > 0) {
    return <div dangerouslySetInnerHTML={{ __html: children }} />;
  }
  return <>{children}</>;
}

export default function FrontPageGate({ passwordHash, children }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
      setUnlocked(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password.trim()) return;
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      setError('Secure connection required. Try HTTPS or localhost.');
      return;
    }
    setIsSubmitting(true);
    try {
      const hash = await sha256(password.trim());
      const expected = String(passwordHash ?? '')
        .trim()
        .toLowerCase();
      if (hash === expected) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(STORAGE_KEY, 'true');
        }
        setUnlocked(true);
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!passwordHash) {
    return <SlotContent>{children}</SlotContent>;
  }

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading…</div>
      </div>
    );
  }

  if (unlocked) {
    return <SlotContent>{children}</SlotContent>;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-slate-50 dark:bg-page px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg p-8">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-gray-100 mb-2">Enter password</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">Enter the site password to view this page.</p>
        <form onSubmit={handleSubmit} aria-label="Enter site password">
          <label htmlFor="frontpage-gate-password" className="sr-only">
            Password
          </label>
          <input
            id="frontpage-gate-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            autoFocus
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-500 focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
            aria-describedby={error ? 'frontpage-gate-error' : undefined}
          />
          {error && (
            <p id="frontpage-gate-error" className="text-red-600 dark:text-red-400 text-sm mb-4" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-lg bg-primary hover:opacity-90 text-white font-medium transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
