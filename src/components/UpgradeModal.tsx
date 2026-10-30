import React, { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { startCheckout } from '../utils/api';

interface Props {
  open: boolean;
  message?: string;
  paidEnabled: boolean;
  onClose: () => void;
  /** Called when checkout needs the user to sign in first. */
  onSignInRequired?: () => void;
}

export function UpgradeModal({ open, message, paidEnabled, onClose, onSignInRequired }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!open) return null;

  // Pro isn't sold: just explain the daily limit.
  if (!paidEnabled) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-md" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white dark:bg-ink-900 rounded-[1.75rem] p-6 sm:p-7 shadow-2xl ring-1 ring-slate-200 dark:ring-white/10 space-y-4">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            <X size={16} />
          </button>
          <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">You've hit today's free scan limit</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {message || 'You get a few free scans each day. Your free scans reset tomorrow.'}
          </p>
          <button type="button" onClick={onClose} className="ss-btn-primary w-full min-h-[3.25rem] text-base">
            OK
          </button>
        </div>
      </div>
    );
  }

  const upgrade = async () => {
    setBusy(true);
    setNote(null);
    const r = await startCheckout();
    setBusy(false);
    if (r.url) {
      window.location.href = r.url;
    } else if (r.signInRequired && onSignInRequired) {
      onSignInRequired();
    } else {
      setNote(r.error || 'Checkout is unavailable right now.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-ink-900 rounded-[1.75rem] p-6 sm:p-7 shadow-2xl ring-1 ring-slate-200 dark:ring-white/10 space-y-4">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 text-pink-700 dark:text-pink-300 text-xs font-extrabold uppercase tracking-widest">
          <Sparkles size={14} /> SwiftScan Pro
        </div>
        <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">You've hit today's free scan limit</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {message || 'Free accounts get a few scans a day. Your count resets tomorrow.'}
        </p>
        <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-5">
          <li>Unlimited scans and product searches, no daily limit</li>
          <li>Works on every device you sign in on, plus more email price alerts</li>
        </ul>
        {paidEnabled ? (
          <button
            type="button"
            onClick={upgrade}
            disabled={busy}
            className="ss-btn-primary w-full min-h-[3.25rem] text-base"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            <span>Upgrade to Pro &middot; $4.99/month</span>
          </button>
        ) : (
          <div className="space-y-2">
            <button type="button" disabled className="w-full py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-sm cursor-not-allowed">
              Pro is coming soon
            </button>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 text-center">Paid plans aren't open yet. Come back tomorrow for more free scans.</p>
          </div>
        )}
        {note && <p className="text-xs text-rose-500 font-semibold text-center">{note}</p>}
        <button type="button" onClick={onClose} className="w-full text-xs font-bold text-slate-600 dark:text-slate-400 underline">
          Maybe later
        </button>
      </div>
    </div>
  );
}
