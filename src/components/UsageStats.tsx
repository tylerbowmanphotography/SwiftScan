import React, { useEffect, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { DayStats, fetchUsageStats } from '../utils/api';

/** Owner-only: how many people used SwiftScan (website + iPhone app), counted on the server. */
export function UsageStats() {
  const [days, setDays] = useState<DayStats[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchUsageStats(30).then((d) => (d ? setDays(d) : setFailed(true)));
  }, []);

  if (failed) return <p className="text-xs text-rose-600">Couldn't load usage stats.</p>;
  if (!days) return <Loader2 size={16} className="animate-spin text-slate-400" />;

  const sum = (list: DayStats[], f: (d: DayStats) => number) => list.reduce((n, d) => n + f(d), 0);
  const people = (d: DayStats) => d.web.visitors + d.ios.visitors;
  const scans = (d: DayStats) => d.web.scans + d.ios.scans;
  const week = days.slice(0, 7);
  const tile = (label: string, value: string) => (
    <div className="rounded-xl bg-slate-100 dark:bg-white/[0.06] p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{value}</div>
    </div>
  );

  return (
    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
      <div className="flex items-center gap-2 text-pink-700 dark:text-pink-300 text-xs font-extrabold uppercase tracking-widest">
        <BarChart3 size={14} /> Usage (only you see this)
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tile('People today', String(people(days[0])))}
        {tile('Avg / day (7d)', (sum(week, people) / week.length).toFixed(1))}
        {tile('Scans (7d)', String(sum(week, scans)))}
        {tile('iPhone (7d)', String(sum(week, (d) => d.ios.visitors)))}
        {tile('Website (7d)', String(sum(week, (d) => d.web.visitors)))}
        {tile('Pro sales (30d)', String(sum(days, (d) => d.purchases.apple + d.purchases.stripe)))}
      </div>
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="text-slate-500 text-left">
            <tr>
              <th className="py-1 font-semibold">Day</th>
              <th className="font-semibold text-right">iPhone</th>
              <th className="font-semibold text-right">Web</th>
              <th className="font-semibold text-right">Scans</th>
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            {days.slice(0, 14).map((d) => (
              <tr key={d.day} className="border-t border-slate-100 dark:border-white/5">
                <td className="py-1">{d.day.slice(5)}</td>
                <td className="text-right">{d.ios.visitors}</td>
                <td className="text-right">{d.web.visitors}</td>
                <td className="text-right">{scans(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">People = devices that opened SwiftScan that day. Counting started Nov 11, 2026.</p>
    </div>
  );
}
