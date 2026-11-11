import { project } from "@/data/oblasts"

/** Ukrainian administrative subdivisions: OpenStreetMap-derived GeoJSON.
 * https://github.com/darmat1/ukraine-geo-data
 * Only the currently selected oblast is downloaded, so mobile startup stays light.
 */
export const DISTRICT_FILES: Record<string, string> = {
  "vinnicka-oblast": "vinnytska_oblast",
  "volinska-oblast": "volynska_oblast",
  dnipropetrovska: "dnipropetrovska_oblast",
  "donecka-oblast": "donetska_oblast",
  "zitomirska-oblast": "zhytomyrska_oblast",
  "zakarpatska-oblast": "zakarpatska_oblast",
  "zaporizka-oblast": "zaporizka_oblast",
  "ivano-frankivska-oblast": "ivano_frankivska_oblast",
  "kirovogradska-oblast": "kirovohradska_oblast",
  kyivska: "kyyivska_oblast",
  "luganska-oblast": "luhanska_oblast",
  lvivska: "lvivska_oblast",
  "mikolayivska-oblast": "mykolayivska_oblast",
  odeska: "odeska_oblast",
  "poltavska-oblast": "poltavska_oblast",
  "rivnenska-oblast": "rivnenska_oblast",
  "sumska-oblast": "sumska_oblast",
  "ternopilska-oblast": "ternopilska_oblast",
  "xarkivska-oblast": "kharkivska_oblast",
  "xmelnycka-oblast": "khmelnytska_oblast",
  "cerkaska-oblast": "cherkaska_oblast",
  "cernivecka-oblast": "chernivetska_oblast",
  "cernigivska-oblast": "chernihivska_oblast",
  "xersonska-oblast": "khersonska_oblast",
}
type Position = number[]
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] }
type Feature = { properties?: { name?: string; admin_level?: string }; geometry?: Geometry }
export type DistrictShape = { name: string; d: string }
const cache = new Map<string, Promise<DistrictShape[]>>()

function distanceToSegment(p: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = dx * dx + dy * dy ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

function simplify(points: Position[], tolerance = 0.35): Position[] {
  if (points.length <= 4) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()!
    let max = tolerance, index = -1
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegment(points[i], points[start], points[end])
      if (d > max) { max = d; index = i }
    }
    if (index > -1) {
      keep[index] = 1
      stack.push([start, index], [index, end])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

function ringPath(ring: Position[]): string {
  const points = ring.filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(p => { const pt = project(p[0], p[1]); return [pt.x, pt.y] })
  if (points.length < 3) return ""
  return simplify(points).map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("") + "Z"
}
function geometryPath(geometry: Geometry): string {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates as Position[][]] : geometry.coordinates as Position[][][]
  return polygons.flatMap(polygon => polygon.map(ringPath)).filter(Boolean).join("")
}

export function loadDistricts(slug: string): Promise<DistrictShape[]> {
  const key = DISTRICT_FILES[slug]
  if (!key) return Promise.resolve([])
  if (!cache.has(key)) {
    const promise = fetch("https://cdn.jsdelivr.net/gh/darmat1/ukraine-geo-data@main/geodata/" + key + ".geojson")
      .then(async response => {
        if (!response.ok) throw new Error("HTTP " + response.status)
        const json = await response.json() as { features?: Feature[] }
        return (json.features || [])
          .filter(f => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") && (f.properties?.admin_level === "6" || /район$/u.test(f.properties?.name || "")))
          .map(f => ({ name: f.properties?.name || "Район", d: geometryPath(f.geometry!) }))
          .filter(f => f.d.length > 0)
      })
      .catch(error => { cache.delete(key); throw error })
    cache.set(key, promise)
  }
  return cache.get(key)!
}
