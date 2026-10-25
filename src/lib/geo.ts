/**
 * geo.ts — Referensi koordinat pusat administratif 38 kabupaten/kota di Jawa Timur.
 *
 * CATATAN TRANSPARANSI (penting untuk kejujuran visualisasi):
 * - Koordinat adalah PUSAT ADMINISTRATIF kabupaten/kota (referensi geografis publik,
 *   dibulatkan ±3 desimal), BUKAN lokasi aktual tiap artikel berita.
 * - Beberapa marker kota digeser sedikit (±0,02°) dari kabupaten induknya agar
 *   tidak tumpang tindih saat zoom jauh.
 * - Jumlah artikel per wilayah dihitung dari dataset aktual (kolom region_analisis),
 *   bukan dari koordinat ini.
 */

export interface RegionCoord {
  name: string;
  lat: number;
  lng: number;
}

export const REGION_COORDS: RegionCoord[] = [
  { name: "Kabupaten Bangkalan", lat: -7.026, lng: 112.751 },
  { name: "Kabupaten Banyuwangi", lat: -8.219, lng: 114.367 },
  { name: "Kabupaten Blitar", lat: -8.1, lng: 112.162 },
  { name: "Kabupaten Bojonegoro", lat: -7.403, lng: 111.791 },
  { name: "Kabupaten Bondowoso", lat: -7.912, lng: 113.823 },
  { name: "Kabupaten Gresik", lat: -7.155, lng: 112.655 },
  { name: "Kabupaten Jember", lat: -8.172, lng: 113.7 },
  { name: "Kabupaten Jombang", lat: -7.546, lng: 112.233 },
  { name: "Kabupaten Kediri", lat: -7.849, lng: 112.014 },
  { name: "Kabupaten Lamongan", lat: -7.11, lng: 112.416 },
  { name: "Kabupaten Lumajang", lat: -8.136, lng: 113.214 },
  { name: "Kabupaten Madiun", lat: -7.63, lng: 111.524 },
  { name: "Kabupaten Magetan", lat: -7.648, lng: 111.354 },
  { name: "Kabupaten Malang", lat: -7.981, lng: 112.523 },
  { name: "Kabupaten Mojokerto", lat: -7.467, lng: 112.434 },
  { name: "Kabupaten Nganjuk", lat: -7.604, lng: 111.871 },
  { name: "Kabupaten Ngawi", lat: -7.406, lng: 111.446 },
  { name: "Kabupaten Pacitan", lat: -8.19, lng: 111.094 },
  { name: "Kabupaten Pamekasan", lat: -7.156, lng: 113.473 },
  { name: "Kabupaten Pasuruan", lat: -7.645, lng: 112.906 },
  { name: "Kabupaten Ponorogo", lat: -7.871, lng: 111.466 },
  { name: "Kabupaten Probolinggo", lat: -7.755, lng: 113.212 },
  { name: "Kabupaten Sampang", lat: -7.187, lng: 113.239 },
  { name: "Kabupaten Sidoarjo", lat: -7.448, lng: 112.718 },
  { name: "Kabupaten Situbondo", lat: -7.707, lng: 114.009 },
  { name: "Kabupaten Sumenep", lat: -6.998, lng: 113.869 },
  { name: "Kabupaten Trenggalek", lat: -8.171, lng: 111.694 },
  { name: "Kabupaten Tuban", lat: -6.898, lng: 112.065 },
  { name: "Kabupaten Tulungagung", lat: -8.066, lng: 111.903 },
  { name: "Kota Batu", lat: -7.876, lng: 112.522 },
  { name: "Kota Blitar", lat: -8.117, lng: 112.189 },
  { name: "Kota Kediri", lat: -7.836, lng: 112.032 },
  { name: "Kota Madiun", lat: -7.65, lng: 111.499 },
  { name: "Kota Malang", lat: -7.947, lng: 112.613 },
  { name: "Kota Mojokerto", lat: -7.447, lng: 112.414 },
  { name: "Kota Pasuruan", lat: -7.625, lng: 112.886 },
  { name: "Kota Probolinggo", lat: -7.735, lng: 113.184 },
  { name: "Kota Surabaya", lat: -7.257, lng: 112.752 },
];

export const MAP_CENTER: [number, number] = [-7.55, 112.55];
export const MAP_ZOOM = 8;

export function coordFor(region: string): RegionCoord | undefined {
  return REGION_COORDS.find((r) => r.name === region);
}
