import React, { useState } from 'react';
import {
  Camera,
  Search,
  ScanBarcode,
  Sparkles,
  Gauge,
  ListChecks,
  Store,
  BellRing,
  Check,
  Loader2,
  Crown,
  Cpu,
  Tags,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { startCheckout } from '../utils/api';

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

interface HeroProps {
  onOpenScanner: () => void;
  onOpenSearch: () => void;
}

const VERDICT_STEPS = [
  { label: 'Steal', color: 'bg-emerald-400' },
  { label: 'Good deal', color: 'bg-pink-400' },
  { label: 'Fair', color: 'bg-amber-400' },
  { label: 'Overpriced', color: 'bg-rose-400' },
];

export function Hero({ onOpenScanner, onOpenSearch }: HeroProps) {
  const reduce = useReducedMotion();
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden rounded-[2rem] bg-ink-950 text-white shadow-2xl ring-1 ring-white/10"
    >
      {/* soft brand glows */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-pink-600/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />

      <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:p-14">
        {/* Copy */}
        <div className="space-y-6 sm:space-y-7">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-pink-200"
          >
            <Sparkles size={13} className="text-pink-300" />
            AI price check for your phone
          </motion.div>

          <motion.h1
            id="hero-title"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-[2.5rem] font-black leading-[1.02] tracking-tight text-balance sm:text-6xl"
          >
            Snap it.
            <br />
            <span className="ss-gradient-text">Know what it&rsquo;s worth.</span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg"
          >
            Point your camera at a barcode, label or item. SwiftScan gives you an AI-estimated price range, a plain-English deal verdict, and links to compare stores.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <button
              type="button"
              onClick={onOpenScanner}
              className="ss-btn-primary animate-pulse-ring min-h-[3.75rem] px-8 text-base sm:text-lg"
            >
              <Camera size={22} aria-hidden />
              <span>Scan an item</span>
            </button>
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex min-h-[3.75rem] items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.07] px-6 text-base font-bold text-white backdrop-blur transition hover:bg-white/15 active:scale-[0.97]"
            >
              <Search size={20} className="text-pink-300" aria-hidden />
              <span>Search by name</span>
            </button>
          </motion.div>

          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-300">
            {['Free to start', 'Works in your browser', 'Barcode database lookups'].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Check size={15} className="text-emerald-400" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Photo with scan overlay */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/15 sm:aspect-[5/4] lg:aspect-[4/5]">
            <img
              src="/img/hero-market.jpg"
              alt="A shopper browsing used items laid out on a tarp at an outdoor flea market"
              className="h-full w-full object-cover object-[50%_62%]"
              width={1400}
              height={2100}
              fetchPriority="high"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-ink-950/10" />

            {/* viewfinder */}
            <div aria-hidden className="absolute inset-[16%] sm:inset-[18%]">
              <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-white/90" />
              <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-white/90" />
              <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-white/90" />
              <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-white/90" />
              <span className="absolute left-2 right-2 h-0.5 animate-scan rounded-full bg-gradient-to-r from-transparent via-pink-300 to-transparent shadow-[0_0_18px_4px_color-mix(in_srgb,var(--color-pink-300)_70%,transparent)]" />
            </div>

            {/* illustrative verdict chip */}
            <div className="absolute inset-x-3 bottom-3 animate-float rounded-2xl border border-white/15 bg-ink-900/80 p-3.5 backdrop-blur-md sm:inset-x-5 sm:bottom-5 sm:p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white">
                  <Gauge size={14} className="text-pink-300" aria-hidden />
                  Deal verdict
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  Example
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5" aria-hidden>
                {VERDICT_STEPS.map((s, i) => (
                  <span key={s.label} className={`h-1.5 rounded-full ${i === 1 ? s.color : 'bg-white/15'}`} />
                ))}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold text-slate-300 sm:text-[11px]">
                {VERDICT_STEPS.map((s, i) => (
                  <span key={s.label} className={i === 1 ? 'text-white' : ''}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400 lg:text-right">Photo: Biris Bianca / Unsplash</p>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    icon: ScanBarcode,
    title: 'Snap it',
    body: 'Scan a barcode, take a photo of the item, or search by name. No app to install.',
  },
  {
    icon: Cpu,
    title: 'We look it up',
    body: 'Barcodes are matched against product databases first. Photos and searches use Google Gemini AI to estimate prices.',
  },
  {
    icon: Tags,
    title: 'You decide',
    body: 'See a verdict from Steal to Overpriced, the estimated price range, and links to compare stores.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24 space-y-6">
      <div className="max-w-xl space-y-2">
        <p className="ss-eyebrow">How it works</p>
        <h2 id="how-title" className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Three steps to a smarter buy
        </h2>
      </div>
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="ss-card relative overflow-hidden rounded-3xl p-6"
          >
            <span
              aria-hidden
              className="absolute -right-2 -top-4 select-none text-[6.5rem] font-black leading-none text-slate-100 dark:text-white/[0.04]"
            >
              {i + 1}
            </span>
            <div className="relative space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600 ring-1 ring-pink-100 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-400/20">
                <s.icon size={24} aria-hidden />
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

export function Features({ alertsAvailable }: { alertsAvailable: boolean }) {
  const items = [
    {
      icon: Gauge,
      tint: 'bg-pink-50 text-pink-600 ring-pink-100 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-400/20',
      title: 'Deal verdict',
      body: 'Every item is rated Steal, Good Deal, Fair or Overpriced, based on AI-estimated price ranges.',
    },
    {
      icon: ListChecks,
      tint: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20',
      title: 'Pros, cons and specs',
      body: 'AI-written summaries of strengths, drawbacks and key specs, plus a place to ask follow-up questions.',
    },
    {
      icon: Store,
      tint: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20',
      title: 'Store comparison',
      body: 'Estimated prices and links for stores like Amazon, Best Buy, Walmart, Target, Micro Center, B&H and eBay.',
    },
    ...(alertsAvailable
      ? [
          {
            icon: BellRing,
            tint: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/20',
            title: 'Email price alerts',
            body: 'Save an item, set a target price, and get an email when the estimate reaches it. Needs a sign-in with your email.',
          },
        ]
      : []),
  ];
  return (
    <section aria-labelledby="features-title" className="space-y-6">
      <div className="max-w-xl space-y-2">
        <p className="ss-eyebrow">What you get</p>
        <h2 id="features-title" className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Quick answers, right at the shelf
        </h2>
      </div>
      <div className={`grid gap-4 sm:grid-cols-2 ${items.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {items.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: i * 0.07 }}
            className="ss-card ss-card-hover space-y-3 rounded-3xl p-6"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${f.tint}`}>
              <f.icon size={24} aria-hidden />
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{f.title}</h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pro                                                                 */
/* ------------------------------------------------------------------ */

interface ProProps {
  paidEnabled: boolean;
  isPro: boolean;
  onSignInRequired: () => void;
}

export function ProSection({ paidEnabled, isPro, onSignInRequired }: ProProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const upgrade = async () => {
    setBusy(true);
    setNote(null);
    const r = await startCheckout();
    setBusy(false);
    if (r.url) {
      window.location.href = r.url;
    } else if (r.signInRequired) {
      onSignInRequired();
    } else {
      setNote(r.error || 'Checkout is unavailable right now.');
    }
  };

  return (
    <section
      id="pro"
      aria-labelledby="pro-title"
      className="relative scroll-mt-24 overflow-hidden rounded-[2rem] bg-ink-950 p-6 text-white shadow-2xl ring-1 ring-white/10 sm:p-10 lg:p-12"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-96 w-96 rounded-full bg-pink-600/35 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-5">
          <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-pink-200">
            <Crown size={14} aria-hidden /> SwiftScan Pro
          </p>
          <h2 id="pro-title" className="text-3xl font-black tracking-tight sm:text-4xl">
            Scan as much as you want
          </h2>
          <p className="max-w-lg text-slate-300">
            Free accounts get a few scans a day. Pro removes the daily limit so you can work a whole yard sale, thrift store or flea market.
          </p>
          <ul className="space-y-2.5 text-sm font-semibold text-slate-100 sm:text-base">
            {[
              'Unlimited scans and product searches, no daily limit',
              'Works on every device you sign in on',
              'More email price alerts',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                  <Check size={13} strokeWidth={3} aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur sm:p-7">
          <div className="flex items-end gap-1.5">
            <span className="text-5xl font-black tracking-tight">$4.99</span>
            <span className="pb-1.5 text-base font-semibold text-slate-300">/month</span>
          </div>
          <p className="mt-1 text-sm text-slate-300">Billed monthly through Stripe.</p>

          <div className="mt-6 space-y-3">
            {isPro ? (
              <div className="flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 text-base font-extrabold text-emerald-300 ring-1 ring-emerald-400/30">
                <Check size={18} aria-hidden /> You&rsquo;re on Pro
              </div>
            ) : paidEnabled ? (
              <button type="button" onClick={upgrade} disabled={busy} className="ss-btn-primary min-h-[3.25rem] w-full text-base">
                {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}
                <span>Upgrade to Pro</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="min-h-[3.25rem] w-full cursor-not-allowed rounded-2xl bg-white/10 text-base font-extrabold text-slate-300"
              >
                Pro is coming soon
              </button>
            )}
            {note && <p role="alert" className="text-center text-xs font-semibold text-rose-300">{note}</p>}
            <p className="text-center text-xs text-slate-400">Sign in with your email so Pro follows you to any device.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Small helper used for section headings elsewhere */
export function SectionHeading({ eyebrow, title, hint, action }: { eyebrow?: string; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        {eyebrow && <p className="ss-eyebrow">{eyebrow}</p>}
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h2>
        {hint && <p className="text-sm text-slate-600 dark:text-slate-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

