"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PlatformAnalytics, SourceSnapshot } from "@/lib/types";

const PALETTE = ["#0b8c74", "#ca6b2c", "#1b4f72", "#8f5f2a", "#32746d", "#66533c"];

type AnalyticsChartsProps = {
  analytics: PlatformAnalytics;
  snapshots: SourceSnapshot[];
};

export function AnalyticsCharts({ analytics, snapshots }: AnalyticsChartsProps) {
  const modeData = [
    { label: "Live", value: analytics.liveSources },
    { label: "Fallback", value: analytics.fallbackSources },
  ].filter((item) => item.value > 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Market shape</p>
            <h2 className="section-title">Source and location density</h2>
          </div>
          <div className="rounded-full border border-[rgba(19,38,31,0.12)] bg-white/70 px-4 py-2 text-sm text-[var(--muted)]">
            {snapshots.length} sources tracked
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/55 p-4">
            <p className="text-sm font-medium text-[var(--muted)]">Records by source</p>
            <div className="mt-4 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.bySource} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke="rgba(19,38,31,0.08)" horizontal={false} />
                  <XAxis type="number" stroke="#5f736d" />
                  <YAxis type="category" dataKey="label" width={110} stroke="#5f736d" />
                  <Tooltip cursor={{ fill: "rgba(11,140,116,0.08)" }} />
                  <Bar dataKey="value" radius={[0, 16, 16, 0]} fill="#0b8c74" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/55 p-4">
            <p className="text-sm font-medium text-[var(--muted)]">Signals by location</p>
            <div className="mt-4 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.byLocation} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke="rgba(19,38,31,0.08)" vertical={false} />
                  <XAxis dataKey="label" stroke="#5f736d" />
                  <YAxis stroke="#5f736d" />
                  <Tooltip cursor={{ fill: "rgba(202,107,44,0.08)" }} />
                  <Bar dataKey="value" radius={[16, 16, 0, 0]} fill="#ca6b2c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <p className="eyebrow">Coverage mix</p>
        <h2 className="section-title">Fallback visibility is explicit</h2>
        <p className="section-copy mt-3">
          The UI never hides whether a source is live or backed by seeded fallback.
          That makes it easier to improve parsers without confusing demo data for a
          fresh scrape.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="metric-tile">
            <span className="metric-label">Remote-friendly jobs</span>
            <strong className="metric-value">{analytics.remoteFriendlyJobs}</strong>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Company sectors</span>
            <strong className="metric-value">{analytics.bySector.length}</strong>
          </div>
        </div>

        <div className="mt-6 rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/55 p-4">
          <p className="text-sm font-medium text-[var(--muted)]">Live vs fallback sources</p>

          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modeData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={54}
                  outerRadius={86}
                  paddingAngle={3}
                >
                  {modeData.map((entry, index) => (
                    <Cell key={entry.label} fill={PALETTE[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {analytics.bySector.length ? (
            analytics.bySector.map((sector, index) => (
              <span key={sector.label} className="chip">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                />
                {sector.label}
                <strong className="ml-1">{sector.value}</strong>
              </span>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Sector chips will populate once company sources are parsed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}