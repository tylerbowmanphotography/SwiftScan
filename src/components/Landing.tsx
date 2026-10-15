import React from 'react';
import {
  Camera,
  Search,
  ArrowRight,
  ScanBarcode,
  Sparkles,
  TrendingDown,
  ListChecks,
  Store,
  BellRing,
  Check,
  History,
  Tag,
  Bookmark,
  BadgeCheck,
  Scale,
} from 'lucide-react';
import { SavedScanItem, SampleProductPreset } from '../types';
import { AppConfig, Usage } from '../utils/api';

interface LandingProps {
  presets: SampleProductPreset[];
  savedItems: SavedScanItem[];
  appConfig: AppConfig | null;
  usage: Usage | null;
  onScan: () => void;
  onSearch: () => void;
  onPreset: (preset: SampleProductPreset) => void;
  onOpenHistory: () => void;
  onSelectSaved: (item: SavedScanItem) => void;
  onOpenPro: () => void;
}

const STEPS = [
  {
    icon: Camera,
    title: 'Snap',
    body: 'Scan a barcode or take a photo of the item. You can also search by name.',
  },
  {
    icon: BadgeCheck,
    title: 'Identify',
    body: 'Barcodes are matched against public product databases. Photo IDs are an AI guess and are labeled as unverified.',
  },
  {
    icon: Scale,
    title: 'Compare',
    body: 'See an estimated price range, a deal rating, and links to check the price at major retailers.',
  },
];

export function Landing({
  presets,
  savedItems,
  appConfig,
  usage,
  onScan,
  onSearch,
  onPreset,
  onOpenHistory,
  onSelectSaved,
  onOpenPro,
}: LandingProps) {
  const accountsOn = !!appConfig?.accounts?.enabled;
  const paidOn = !!appConfig?.paid?.enabled;
  const showcase = presets.slice(0, 4);

  const features = [
    {
      icon: TrendingDown,
      tone: 'text-pink-700 bg-pink-100 dark:text-pink-300 dark:bg-pink-950/70',
      title: 'Fair price gauge',
      body: 'Rates each product Steal, Good Deal, Fair or Overpriced against an estimated typical price range.',
    },
    {
      icon: ListChecks,
      tone: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60',
      title: 'Pros, cons and specs',
      body: 'A quick AI-written summary of strengths, drawbacks and key specs, plus a Q&A for follow-up questions.',
    },
    {
      icon: Store,
      tone: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/60',
      title: 'Retailer links',
      body: 'Estimated prices at stores like Amazon, Best Buy, Walmart, Target, B&H and eBay, with links to check each one.',
    },
    ...(accountsOn
      ? [
          {
            icon: BellRing,
            tone: 'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/60',
            title: 'Price alerts',
            body: 'Set a target price and get an email when the estimate drops to it. Sign in with your email, no password needed.',
          },
        ]
      : []),
  ];

  return (
    <div>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-pink-50 via-white to-slate-50 dark:border-slate-800/70 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-pink-300/30 blur-3xl dark:bg-pink-600/20" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-600/15" />

        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-20">
          <div className="space-y-6 animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-pink-700 shadow-sm backdrop-blur dark:border-pink-900 dark:bg-slate-900/80 dark:text-pink-300">
              <Sparkles size={14} />
              AI price check for any product
            </span>

            <h1 className="text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              Snap it.
              <br />
              <span className="bg-gradient-to-r from-pink-600 to-violet-600 bg-clip-text text-transparent dark:from-pink-400 dark:to-violet-400">
                Know what it&rsquo;s worth.
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              Point your phone at a barcode or product. SwiftScan identifies it and gives you an AI price estimate, so you know what to pay before you buy.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onScan} className="ss-btn-primary animate-pulse-ring sm:min-w-56">
                <Camera size={22} />
                <span>Scan an item</span>
              </button>
              <button type="button" onClick={onSearch} className="ss-btn-secondary">
                <Search size={20} className="text-pink-600 dark:text-pink-400" />
                <span>Search by name</span>
              </button>
            </div>

            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                {usage && !usage.isPro && usage.limit !== null && !usage.exhausted
                  ? `${usage.remaining} of ${usage.limit} free scans left today`
                  : usage?.isPro
                    ? 'Pro: unlimited scans'
                    : 'Free to start'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                No account needed to scan
              </span>
            </p>
          </div>

          {/* Photo collage: real product photos, tap one to try it */}
          <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms]" aria-label="Sample products you can try">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {showcase.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPreset(p)}
                  className={`group relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/70 shadow-lift ring-1 ring-slate-900/5 transition duration-300 hover:-translate-y-1 dark:border-slate-800 ${
                    i % 2 === 1 ? 'translate-y-6' : ''
                  }`}
                  aria-label={`Try a sample scan: ${p.name}`}
                >
                  <img src={p.imageUrl} alt="" loading={i < 2 ? 'eager' : 'lazy'} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <span className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/0 to-transparent" />
                  <span className="absolute bottom-3 left-3 right-3 text-left">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-white/80">{p.brand}</span>
                    <span className="line-clamp-1 text-sm font-bold text-white">{p.category}</span>
                  </span>
                  {i === 0 && (
                    <span aria-hidden className="pointer-events-none absolute inset-5 text-white/90">
                      <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-current" />
                      <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-xl border-r-[3px] border-t-[3px] border-current" />
                      <span className="absolute bottom-10 left-0 h-6 w-6 rounded-bl-xl border-b-[3px] border-l-[3px] border-current" />
                      <span className="absolute bottom-10 right-0 h-6 w-6 rounded-br-xl border-b-[3px] border-r-[3px] border-current" />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-9 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">Tap a photo to try a sample scan</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-14 sm:space-y-20 sm:px-6 sm:py-20">
        {/* ---------------- RECENT SCANS ---------------- */}
        {savedItems.length > 0 && (
          <section className="space-y-4" aria-labelledby="recent-title">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="ss-eyebrow">Pick up where you left off</p>
                <h2 id="recent-title" className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Recent scans</h2>
              </div>
              <button type="button" onClick={onOpenHistory} className="inline-flex items-center gap-1.5 text-sm font-bold text-pink-700 hover:underline dark:text-pink-300">
                <History size={16} />
                <span>View all ({savedItems.length})</span>
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {savedItems.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSaved(item)}
                  className="ss-card ss-card-hover group flex items-center gap-3.5 p-3.5 text-left"
                >
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 object-cover dark:border-slate-800" />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300">
                      <Tag size={22} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center justify-between gap-1">
                      <span className="block truncate text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{item.scanResult.brand}</span>
                      {item.isBookmarked && <Bookmark size={13} className="shrink-0 fill-pink-600 text-pink-600" />}
                    </span>
                    <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-pink-700 dark:text-white dark:group-hover:text-pink-300">{item.scanResult.productName}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-extrabold text-pink-700 dark:text-pink-300">${item.scanResult.goodPrice}</span>
                      <span className="text-xs text-slate-500 line-through">${item.scanResult.msrp}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section className="space-y-8" aria-labelledby="how-title">
          <div className="max-w-xl space-y-2">
            <p className="ss-eyebrow">How it works</p>
            <h2 id="how-title" className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Three taps from shelf to answer</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="ss-card relative space-y-3 p-6">
                <span className="absolute right-5 top-4 text-5xl font-extrabold leading-none text-slate-100 dark:text-slate-800" aria-hidden>{i + 1}</span>
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-lg shadow-pink-600/25">
                  <s.icon size={22} />
                </span>
                <h3 className="relative text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="relative text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- FEATURES ---------------- */}
        <section className="space-y-8" aria-labelledby="features-title">
          <div className="max-w-xl space-y-2">
            <p className="ss-eyebrow">What you get</p>
            <h2 id="features-title" className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Everything you need before you pay</h2>
          </div>
          <div className={`grid gap-4 sm:grid-cols-2 ${features.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {features.map((f) => (
              <div key={f.title} className="ss-card ss-card-hover space-y-3 p-6">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${f.tone}`}>
                  <f.icon size={21} />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- SAMPLE PRODUCTS ---------------- */}
        <section className="space-y-6" aria-labelledby="samples-title">
          <div className="max-w-xl space-y-2">
            <p className="ss-eyebrow">Try it now</p>
            <h2 id="samples-title" className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">No item handy? Try a sample</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Tap a product to see the price analysis SwiftScan gives you.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPreset(preset)}
                className="ss-card ss-card-hover group flex flex-col overflow-hidden p-3 text-left"
              >
                <span className="relative mb-3 block aspect-square w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <img src={preset.imageUrl} alt={preset.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <span className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-0.5 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur dark:bg-slate-950/80 dark:text-white">
                    {preset.category}
                  </span>
                </span>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{preset.brand}</span>
                <span className="mt-0.5 line-clamp-2 flex-1 text-sm font-bold leading-snug text-slate-900 dark:text-white">{preset.name}</span>
                <span className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-bold text-pink-700 dark:border-slate-800 dark:text-pink-300">
                  <span>Analyze</span>
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ---------------- PRO ---------------- */}
        <section id="pro" className="scroll-mt-24" aria-labelledby="pro-title">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-pink-950 to-slate-900 p-7 shadow-lift sm:p-12">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-pink-500/25 blur-3xl" />
            <div className="relative grid items-center gap-8 md:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-pink-200 ring-1 ring-white/15">
                  <Sparkles size={14} /> SwiftScan Pro
                </span>
                <h2 id="pro-title" className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Scan without limits</h2>
                <ul className="space-y-3 text-base text-slate-200">
                  {[
                    'Unlimited scans and product searches, no daily limit',
                    'Works on every device you sign in on',
                    'More email price alerts',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl bg-white p-6 text-center shadow-xl dark:bg-slate-950">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Pro</p>
                <p className="mt-1 text-slate-900 dark:text-white">
                  <span className="text-5xl font-extrabold tracking-tight">$4.99</span>
                  <span className="text-base font-semibold text-slate-600 dark:text-slate-400">/month</span>
                </p>
                <button
                  type="button"
                  onClick={onOpenPro}
                  disabled={!paidOn}
                  className="ss-btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:text-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
                >
                  <Sparkles size={18} />
                  <span>{paidOn ? 'Upgrade to Pro' : 'Pro is coming soon'}</span>
                </button>
                <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Renews monthly. Cancel any time from your account. Free plan: a few scans a day, no card needed.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- FINAL CTA ---------------- */}
        <section className="ss-card flex flex-col items-center gap-5 px-6 py-10 text-center sm:py-14">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-lg shadow-pink-600/30">
            <ScanBarcode size={28} />
          </span>
          <h2 className="max-w-md text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Ready to check your first price?</h2>
          <button type="button" onClick={onScan} className="ss-btn-primary">
            <Camera size={20} />
            <span>Scan an item</span>
          </button>
        </section>
      </div>
    </div>
  );
}
