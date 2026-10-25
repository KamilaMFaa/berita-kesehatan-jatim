"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip, AttributionControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_CENTER, MAP_ZOOM, REGION_COORDS } from "@/lib/geo";
import { fmtNum } from "@/lib/format";

export interface MapRegion {
  name: string;
  count: number;
  topTopics?: { topicId: number; label: string; count: number }[];
}

/**
 * Peta persebaran berita per kabupaten/kota.
 * - Ukuran & warna lingkaran ∝ jumlah artikel (dihitung dari dataset aktual).
 * - Koordinat = pusat administratif (referensi publik), bukan lokasi artikel.
 * - Jika tile peta gagal dimuat, lingkaran tetap dirender di atas dasar peta kosong.
 */
export function RegionMap({
  regions,
  selected,
  onSelect,
}: {
  regions: MapRegion[];
  selected: string | null;
  onSelect: (region: string) => void;
}) {
  const max = Math.max(1, ...regions.map((r) => r.count));

  useEffect(() => {
    // paksa invalidasi ukuran setelah mount (menghindari peta setengah tergambar)
    const t = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-[380px] sm:h-[440px] rounded-lg overflow-hidden border relative z-0">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <AttributionControl position="bottomright" />
        {regions.map((r) => {
          const coord = REGION_COORDS.find((c) => c.name === r.name);
          if (!coord) return null;
          const radius = 6 + Math.sqrt(r.count / max) * 22;
          const isSel = selected === r.name;
          const color = isSel ? "#c2410c" : "#0f766e";
          return (
            <CircleMarker
              key={r.name}
              center={[coord.lat, coord.lng]}
              radius={radius}
              pathOptions={{
                color,
                weight: isSel ? 2.5 : 1.5,
                fillColor: color,
                fillOpacity: isSel ? 0.55 : 0.35,
              }}
              eventHandlers={{ click: () => onSelect(r.name) }}
            >
              <LTooltip direction="top" offset={[0, -radius]}>
                <div className="text-xs">
                  <b>{r.name}</b>
                  <br />
                  {fmtNum(r.count)} berita
                  {r.topTopics && r.topTopics.length > 0 && (
                    <>
                      <br />
                      <span className="opacity-80">
                        Top: {r.topTopics[0].label.slice(0, 40)}
                        {r.topTopics[0].label.length > 40 ? "…" : ""}
                      </span>
                    </>
                  )}
                </div>
              </LTooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default RegionMap;
