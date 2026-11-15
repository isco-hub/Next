import type { GeoPoint } from "./types";

export interface Subcounty {
  id: string;
  name: string;
  district_id: string;
  lat: number;
  lon: number;
}

export interface District {
  id: string;
  name: string;
  lat: number;
  lon: number;
  subcounties: Subcounty[];
}

export const SUPPORTED_REGION_NAME = "Lango sub-region, Uganda";

/**
 * Configurable region polygon (FR-LOC-02). Coordinates are [lon, lat].
 * Replace with the authoritative boundary (OI-01) when it is signed off.
 */
export const SUPPORTED_REGION: [number, number][] = [
  [32.2, 1.7],
  [32.55, 1.55],
  [33.1, 1.62],
  [33.45, 1.95],
  [33.4, 2.45],
  [33.15, 2.85],
  [32.7, 2.95],
  [32.3, 2.75],
  [32.1, 2.3],
  [32.08, 1.98],
];

export const REGION_CENTRE: GeoPoint = { lat: 2.25, lon: 32.85 };

const district = (
  id: string,
  name: string,
  lat: number,
  lon: number,
  names: string[],
): District => ({
  id,
  name,
  lat,
  lon,
  subcounties: names.map((subcountyName) => ({
    id: `${id}.${subcountyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: subcountyName,
    district_id: id,
    lat,
    lon,
  })),
});

export const DISTRICTS: readonly District[] = [
  district("lira", "Lira", 2.25, 32.9, [
    "Lira",
    "Adekokwok",
    "Agweng",
    "Barr",
    "Ogur",
    "Aromo",
  ]),
  district("alebtong", "Alebtong", 2.25, 33.3, [
    "Alebtong",
    "Abako",
    "Aloi",
    "Amugu",
    "Omoro",
    "Adwir",
  ]),
  district("apac", "Apac", 2.53, 32.46, [
    "Apac",
    "Aduku",
    "Ibuje",
    "Akokoro",
    "Chegere",
    "Arocha",
  ]),
  district("oyam", "Oyam", 2.24, 32.38, [
    "Oyam",
    "Aber",
    "Acaba",
    "Iceme",
    "Minakulu",
    "Ngai",
  ]),
  district("kole", "Kole", 2.18, 32.75, [
    "Kole",
    "Aboke",
    "Akalo",
    "Alito",
    "Ayer",
    "Bala",
  ]),
  district("dokolo", "Dokolo", 1.92, 33.17, [
    "Dokolo",
    "Bata",
    "Kangai",
    "Kwera",
    "Okwang",
    "Adok",
  ]),
  district("amolatar", "Amolatar", 1.64, 32.83, [
    "Amolatar",
    "Agikdak",
    "Aputi",
    "Etam",
    "Namasale",
    "Arwotcek",
  ]),
  district("otuke", "Otuke", 2.5, 33.3, [
    "Otuke",
    "Adwari",
    "Ogwete",
    "Olur",
    "Orum",
    "Okwang",
  ]),
  district("kwania", "Kwania", 2.02, 32.72, [
    "Kwania",
    "Chawente",
    "Inomo",
    "Nambieso",
    "Aduku",
    "Abongomola",
  ]),
];

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const distanceKm = (a: GeoPoint, b: GeoPoint): number => {
  const earthRadius = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

/** Ray-casting point-in-polygon. Points outside Lango are rejected (FR-LOC-02). */
export const containsPoint = (
  point: GeoPoint,
  polygon: [number, number][] = SUPPORTED_REGION,
): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i];
    const previous = polygon[j];
    if (!current || !previous) continue;
    const [xi, yi] = current;
    const [xj, yj] = previous;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const gridCellForPoint = (point: GeoPoint): string =>
  `LC-${point.lat.toFixed(2)}-${point.lon.toFixed(2)}`;

export const findDistrict = (districtId: string | undefined): District | undefined =>
  DISTRICTS.find((entry) => entry.id === districtId);

export const findSubcounty = (subcountyId: string | undefined): Subcounty | undefined =>
  DISTRICTS.flatMap((entry) => entry.subcounties).find(
    (entry) => entry.id === subcountyId,
  );

export const nearestSubcounty = (point: GeoPoint): Subcounty => {
  const all = DISTRICTS.flatMap((entry) => entry.subcounties);
  return all.reduce((best, candidate) =>
    distanceKm(point, candidate) < distanceKm(point, best) ? candidate : best,
  );
};

export interface ResolvedLocation {
  district: District;
  subcounty: Subcounty;
  point: GeoPoint;
  grid_cell_id: string;
  inside_region: boolean;
}

export const resolveLocation = (input: {
  lat?: number;
  lon?: number;
  district_id?: string;
  subcounty_id?: string;
}): ResolvedLocation => {
  const subcounty = findSubcounty(input.subcounty_id);
  const district = findDistrict(input.district_id) ?? (subcounty ? findDistrict(subcounty.district_id) : undefined);
  let point: GeoPoint;
  let chosenSubcounty: Subcounty;
  if (typeof input.lat === "number" && typeof input.lon === "number") {
    point = { lat: input.lat, lon: input.lon };
    chosenSubcounty = subcounty ?? nearestSubcounty(point);
  } else if (subcounty) {
    point = { lat: subcounty.lat, lon: subcounty.lon };
    chosenSubcounty = subcounty;
  } else {
    const fallbackDistrict = district ?? DISTRICTS[0]!;
    const firstSubcounty = fallbackDistrict.subcounties[0]!;
    point = { lat: firstSubcounty.lat, lon: firstSubcounty.lon };
    chosenSubcounty = firstSubcounty;
  }
  const chosenDistrict = findDistrict(chosenSubcounty.district_id) ?? district ?? DISTRICTS[0]!;
  return {
    district: chosenDistrict,
    subcounty: chosenSubcounty,
    point,
    grid_cell_id: gridCellForPoint(point),
    inside_region: containsPoint(point),
  };
};

export const districtOptions = () =>
  DISTRICTS.map((entry) => ({ value: entry.id, label: entry.name }));

export const subcountyOptions = (districtId: string) =>
  (findDistrict(districtId)?.subcounties ?? []).map((entry) => ({
    value: entry.id,
    label: entry.name,
  }));
