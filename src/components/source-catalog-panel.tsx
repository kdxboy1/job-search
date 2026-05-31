"use client";

import { Globe2, Lock, Plus, Radar, Waypoints } from "lucide-react";

import { getGlobalAtsCatalog } from "@/lib/source-catalog";
import type {
  CountryCode,
  CountrySourceCatalog,
  CuratedSourceDescriptor,
  SourceConfig,
} from "@/lib/types";

type SourceCatalogPanelProps = {
  activeSources: SourceConfig[];
  catalog: CountrySourceCatalog[];
  onAddSource: (source: CuratedSourceDescriptor) => void | Promise<void>;
  onToggleCountry: (country: CountryCode) => void | Promise<void>;
  pinnedCountries: CountryCode[];
};

function isSourceActive(source: CuratedSourceDescriptor, activeSources: SourceConfig[]): boolean {
  return activeSources.some((activeSource) => activeSource.url === source.url);
}

export function SourceCatalogPanel({
  activeSources,
  catalog,
  onAddSource,
  onToggleCountry,
  pinnedCountries,
}: SourceCatalogPanelProps) {
  const visibleCountries =
    pinnedCountries.length > 0
      ? catalog.filter((entry) => pinnedCountries.includes(entry.country))
      : catalog.slice(0, 4);
  const atsCatalog = getGlobalAtsCatalog();

  return (
    <section className="panel p-6">
      <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
        <div>
          <p className="eyebrow">Country atlas</p>
          <h2 className="section-title">Prominent job sites by market and pattern</h2>
          <p className="section-copy mt-3">
            These are researched source templates, not automatically scraped results. Use the atlas to decide which public portals, private boards, and ATS families deserve adapters or workspace coverage next.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {catalog.map((entry) => {
              const selected = pinnedCountries.includes(entry.country);

              return (
                <button
                  key={entry.country}
                  className={`chip cursor-pointer ${selected ? "border-[rgba(11,140,116,0.35)] bg-[rgba(229,255,248,0.7)] text-[var(--foreground)]" : ""}`}
                  onClick={() => void onToggleCountry(entry.country)}
                  type="button"
                >
                  <Globe2 className="h-3.5 w-3.5" />
                  {entry.countryName}
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
            <div className="flex items-center gap-3">
              <Waypoints className="h-4 w-4 text-[var(--accent)]" />
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                ATS congruence
              </p>
            </div>

            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              The fastest route to comprehensive international coverage is not one adapter per country. It is one adapter per repeated ATS family, plus selective public-portal integrations where official data exists.
            </p>

            <div className="mt-4 space-y-3">
              {atsCatalog.map((source) => (
                <div
                  key={source.id}
                  className="rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{source.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{source.notes}</p>
                    </div>
                    <span className="status-pill">{source.readiness}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          {visibleCountries.map((country) => (
            <article key={country.country} className="rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{country.countryName}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {country.primarySignal}
                  </h3>
                </div>
                <span className="status-pill">
                  <Radar className="h-3.5 w-3.5" />
                  researched
                </span>
              </div>

              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{country.overview}</p>

              <div className="mt-5 grid gap-3">
                {country.sources.map((source) => {
                  const active = isSourceActive(source, activeSources);
                  const canAdd = source.readiness !== "closed";

                  return (
                    <div
                      key={source.id}
                      className="rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-[rgba(255,255,255,0.76)] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{source.name}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{source.description}</p>
                        </div>
                        <span className="status-pill">{source.strategy}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="chip">{source.category}</span>
                        <span className="chip">{source.readiness}</span>
                        <span className="chip">{source.prominence}</span>
                      </div>

                      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{source.notes}</p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {canAdd ? (
                          <button
                            className="secondary-button"
                            disabled={active}
                            onClick={() => void onAddSource(source)}
                            type="button"
                          >
                            <Plus className="h-4 w-4" />
                            {active ? "Already active" : "Add to workspace"}
                          </button>
                        ) : (
                          <span className="status-pill">
                            <Lock className="h-3.5 w-3.5" />
                            Research only
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}