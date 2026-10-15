import React, { useState } from 'react';
import { X, Loader2, Mail, Sparkles } from 'lucide-react';
import { AccountUser, requestSignInCode, verifySignInCode, signOut, openBillingPortal, startCheckout } from '../utils/api';

interface Props {
  open: boolean;
  user: AccountUser | null;
  paidEnabled: boolean;
  /** Shown above the form, e.g. "Sign in to get emailed price alerts" */
  reason?: string;
  onClose: () => void;
  /** Called after a successful sign-in or sign-out so the app can reload config / sync data. */
  onAuthChanged: () => void;
}

export function AccountModal({ open, user, paidEnabled, reason, onClose, onAuthChanged }: Props) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!open) return null;

  const sendCode = async () => {
    setBusy(true);
    setNote(null);
    const r = await requestSignInCode(email.trim());
    setBusy(false);
    if (r.ok) {
      setStep('code');
      setNote(`We emailed a 6-digit code to ${email.trim()}. It can take a minute; check spam too.`);
    } else {
      setNote(r.error || 'Could not send the code.');
    }
  };

  const checkCode = async () => {
    setBusy(true);
    setNote(null);
    const r = await verifySignInCode(email.trim(), code.trim());
    setBusy(false);
    if (r.ok) {
      setCode('');
      setStep('email');
      onAuthChanged();
    } else {
      setNote(r.error || 'Could not verify the code.');
    }
  };

  const logout = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    onAuthChanged();
    onClose();
  };

  const manage = async () => {
    setBusy(true);
    setNote(null);
    const r = await openBillingPortal();
    setBusy(false);
    if (r.url) window.location.href = r.url;
    else setNote(r.error || 'Could not open billing right now.');
  };

  const upgrade = async () => {
    setBusy(true);
    setNote(null);
    const r = await startCheckout();
    setBusy(false);
    if (r.url) window.location.href = r.url;
    else setNote(r.error || 'Checkout is unavailable right now.');
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:border-pink-500';
  const btnCls = 'w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-pink-700 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
          <X size={16} />
        </button>

        {user ? (
          <>
            <div className="flex items-center gap-2 text-pink-500 text-xs font-extrabold uppercase tracking-widest">
              <Mail size={14} /> Your account
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 break-all font-semibold">{user.email}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user.isPro ? 'SwiftScan Pro is active: unlimited scans and more price alerts, on every device you sign in on.' : 'Free plan: a few scans a day and 3 price alerts.'}
            </p>
            {user.isPro ? (
              <button type="button" onClick={manage} disabled={busy} className={btnCls}>
                {busy && <Loader2 size={16} className="animate-spin" />}
                <span>Manage subscription</span>
              </button>
            ) : paidEnabled ? (
              <button type="button" onClick={upgrade} disabled={busy} className={btnCls}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>Upgrade to Pro</span>
              </button>
            ) : null}
            <button type="button" onClick={logout} disabled={busy} className="w-full text-xs font-bold text-slate-500 underline">
              Sign out
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-pink-500 text-xs font-extrabold uppercase tracking-widest">
              <Mail size={14} /> Sign in
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Sign in with your email</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {reason || 'No password needed. We email you a one-time code. Signing in keeps Pro, saved items and price alerts with you on any device.'}
            </p>
            {step === 'email' ? (
              <>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && email && !busy && sendCode()}
                  placeholder="you@example.com"
                  className={inputCls}
                />
                <button type="button" onClick={sendCode} disabled={busy || !email.includes('@')} className={btnCls}>
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  <span>Email me a code</span>
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && !busy && checkCode()}
                  placeholder="123456"
                  className={`${inputCls} tracking-[0.4em] text-center font-black text-lg`}
                />
                <button type="button" onClick={checkCode} disabled={busy || code.length !== 6} className={btnCls}>
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  <span>Sign in</span>
                </button>
                <button type="button" onClick={() => { setStep('email'); setCode(''); setNote(null); }} className="w-full text-xs font-bold text-slate-500 underline">
                  Use a different email
                </button>
              </>
            )}
            <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
              By signing in you agree to the <a className="underline" href="/terms">Terms</a> and <a className="underline" href="/privacy">Privacy Policy</a>.
            </p>
          </>
        )}
        {note && <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold text-center">{note}</p>}
      </div>
    </div>
  );
}
