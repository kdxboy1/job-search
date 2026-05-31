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

const finnishRequirementLabel: Record<string, string> = {
  required: "Finnish required",
  preferred: "Finnish preferred",
  helpful: "Finnish helpful",
  "english-friendly": "English-friendly",
  "not-mentioned": "Not mentioned",
};

type AnalyticsChartsProps = {
  analytics: PlatformAnalytics;
  snapshots: SourceSnapshot[];
};

export function AnalyticsCharts({ analytics, snapshots }: AnalyticsChartsProps) {
  const modeData = [
    { label: "Live", value: analytics.liveSources },
    { label: "Fallback", value: analytics.fallbackSources },
  ].filter((item) => item.value > 0);
  const finnishMix = analytics.byFinnishRequirement.map((item) => ({
    ...item,
    label: finnishRequirementLabel[item.label] ?? item.label,
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <section className="panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">Market matrix</p>
            <h2 className="section-title">Technology pressure and source coverage</h2>
            <p className="section-copy mt-3 max-w-2xl">
              This layer tracks the live market total separately from the detail-enriched
              sample, so charts stay honest about breadth versus depth.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="metric-tile min-h-[5.8rem]">
              <span className="metric-label">Tracked market</span>
              <strong className="metric-value">{analytics.totalJobs.toLocaleString()}</strong>
            </div>
            <div className="metric-tile min-h-[5.8rem]">
              <span className="metric-label">Detail sample</span>
              <strong className="metric-value">{analytics.sampledJobs}</strong>
            </div>
            <div className="metric-tile min-h-[5.8rem]">
              <span className="metric-label">Sources</span>
              <strong className="metric-value">{snapshots.length}</strong>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(247,242,235,0.72))] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--muted)]">Live openings by source</p>
              <span className="chip">transparent totals</span>
            </div>

            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.bySource} layout="vertical" margin={{ left: 12, right: 8 }}>
                  <CartesianGrid stroke="rgba(19,38,31,0.08)" horizontal={false} />
                  <XAxis type="number" stroke="#5f736d" />
                  <YAxis type="category" dataKey="label" width={140} stroke="#5f736d" />
                  <Tooltip cursor={{ fill: "rgba(11,140,116,0.08)" }} />
                  <Bar dataKey="value" radius={[0, 14, 14, 0]} fill="#0b8c74" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(247,242,235,0.72))] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--muted)]">Technology demand in sample</p>
              <span className="chip">comparison-ready</span>
            </div>

            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.byTechnology} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid stroke="rgba(19,38,31,0.08)" vertical={false} />
                  <XAxis dataKey="label" stroke="#5f736d" angle={-20} textAnchor="end" height={54} />
                  <YAxis stroke="#5f736d" />
                  <Tooltip cursor={{ fill: "rgba(202,107,44,0.08)" }} />
                  <Bar dataKey="value" radius={[14, 14, 0, 0]} fill="#ca6b2c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Hiring texture</p>
            <h2 className="section-title">Seniority and language mix</h2>
          </div>
          <span className="status-pill">sample-based facts</span>
        </div>

        <div className="mt-6 grid gap-6">
          <div className="rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
            <p className="text-sm font-medium text-[var(--muted)]">Seniority distribution</p>
            <div className="mt-4 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.bySeniority} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke="rgba(19,38,31,0.08)" horizontal={false} />
                  <XAxis type="number" stroke="#5f736d" />
                  <YAxis type="category" dataKey="label" width={90} stroke="#5f736d" />
                  <Tooltip cursor={{ fill: "rgba(11,79,114,0.08)" }} />
                  <Bar dataKey="value" radius={[0, 14, 14, 0]} fill="#1b4f72" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
              <p className="text-sm font-medium text-[var(--muted)]">Live vs fallback</p>
              <div className="mt-4 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modeData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={4}
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

            <div className="rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
              <p className="text-sm font-medium text-[var(--muted)]">Finnish / language requirement mix</p>
              <div className="mt-4 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={finnishMix} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid stroke="rgba(19,38,31,0.08)" vertical={false} />
                    <XAxis dataKey="label" stroke="#5f736d" angle={-18} textAnchor="end" height={62} />
                    <YAxis stroke="#5f736d" />
                    <Tooltip cursor={{ fill: "rgba(11,140,116,0.08)" }} />
                    <Bar dataKey="value" radius={[14, 14, 0, 0]} fill="#32746d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/55 p-4">
            <p className="text-sm font-medium text-[var(--muted)]">Top departments</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {analytics.byDepartment.length ? (
                analytics.byDepartment.map((department, index) => (
                  <span key={department.label} className="chip">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                    />
                    {department.label}
                    <strong className="ml-1">{department.value}</strong>
                  </span>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">Department facts appear when sources expose them.</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/55 p-4">
            <p className="text-sm font-medium text-[var(--muted)]">Most visible companies</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {analytics.byCompany.length ? (
                analytics.byCompany.map((company, index) => (
                  <span key={company.label} className="chip">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                    />
                    {company.label}
                    <strong className="ml-1">{company.value}</strong>
                  </span>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">Company concentration appears once job records are loaded.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
