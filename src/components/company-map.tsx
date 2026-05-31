"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import type { CompanyProfile } from "@/lib/types";

type CompanyMapProps = {
  companies: CompanyProfile[];
};

export default function CompanyMap({ companies }: CompanyMapProps) {
  const mappableCompanies = companies.filter((company) => company.coordinates).slice(0, 24);

  if (!mappableCompanies.length) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-[1.5rem] border border-dashed border-[rgba(19,38,31,0.18)] bg-white/50 px-6 text-center text-sm text-[var(--muted)]">
        No mappable companies yet. Add sources with city signals or enrich your company parser.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[rgba(19,38,31,0.08)]">
      <MapContainer
        center={[64.5, 26]}
        className="h-[360px] w-full"
        scrollWheelZoom={false}
        zoom={5}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mappableCompanies.map((company) => (
          <CircleMarker
            key={company.id}
            center={[company.coordinates!.lat, company.coordinates!.lng]}
            pathOptions={{ color: "#0b8c74", fillColor: "#ca6b2c", fillOpacity: 0.75 }}
            radius={8}
          >
            <Popup>
              <div className="space-y-2 text-sm text-[#13261f]">
                <strong className="block text-base">{company.name}</strong>
                <p>{company.location}</p>
                <p>{company.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {company.sectors.map((sector) => (
                    <span key={sector} className="rounded-full bg-[#eff8f5] px-2 py-1 text-xs">
                      {sector}
                    </span>
                  ))}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}