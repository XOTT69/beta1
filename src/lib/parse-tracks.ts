import { ALIASES, type Place } from "@/lib/places"
import type { Point, Track, TrackKind } from "@/lib/live.types"

export type RawPost = {
  source: string
  sourceLabel: string
  post: string
  at: string
  text: string
}

type Bearing = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

const BEARING_SPECS: [string, Bearing][] = [
  ["північно-східн", "ne"],
  ["північно-західн", "nw"],
  ["південно-східн", "se"],
  ["південно-західн", "sw"],
  ["північ", "n"],
  ["півноч", "n"],
  ["півден", "s"],
  ["півд", "s"],
  ["захід", "w"],
  ["схід", "e"],
]

const OFFSET: Record<Bearing, [number, number]> = {
  n: [0, 0.42],
  s: [0, -0.42],
  e: [0.62, 0],
  w: [-0.62, 0],
  ne: [0.46, 0.3],
  nw: [-0.46, 0.3],
  se: [0.46, -0.3],
  sw: [-0.46, -0.3],
}

function nudge(lon: number, lat: number, bearing: Bearing): { lon: number; lat: number } {
  const [dx, dy] = OFFSET[bearing]
  return { lon: lon + dx, lat: lat + dy }
}

function isLetter(ch: string): boolean {
  return /\p{L}/u.test(ch)
}

function norm(text: string): string {
  return text.toLowerCase().replace(/['’ʼ]/g, "").replace(/\s+/g, " ").trim()
}

function cleanup(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/надіслати новину[\s\S]*$/i, "")
    .replace(/підписат\p{L}*/giu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

function kindOf(text: string): TrackKind | null {
  const t = norm(text)
  if (/відбій/u.test(t)) return null
  if (/влучан|постражд|пожеж|наслід|зафіксован|попередн|ворожий удар|обстріл|поране|горить/u.test(t) && !/курс/u.test(t)) {
    return null
  }
  if (/балістич/u.test(t)) return "ballistic"
  if (/(^|[^\p{L}])(фпв|fpv)([^\p{L}]|$)/u.test(t)) return "fpv"
  if (/шахед|геран|реактив|ударн|бпла|дрон|камікадз|курс/u.test(t)) return "uav"
  return null
}

type Hit = { start: number; end: number; place: Place }

function findHits(text: string): Hit[] {
  const lower = norm(text)
  const hits: Hit[] = []
  let i = 0
  while (i < lower.length) {
    if (!isLetter(lower[i] ?? "") || (i > 0 && isLetter(lower[i - 1] ?? ""))) {
      i += 1
      continue
    }
    let found: { place: Place; len: number } | null = null
    for (const entry of ALIASES) {
      if (lower.startsWith(entry.alias, i)) {
        found = { place: entry.place, len: entry.alias.length }
        break
      }
    }
    if (!found) {
      i += 1
      continue
    }
    let end = i + found.len
    while (end < lower.length && isLetter(lower[end] ?? "")) end += 1
    hits.push({ start: i, end, place: found.place })
    i = end
  }
  return hits
}

function beforeOf(text: string, start: number): string {
  return norm(text).slice(Math.max(0, start - 46), start)
}

function bearingInText(text: string): Bearing | null {
  for (const [stem, id] of BEARING_SPECS) {
    if (text.includes(stem)) return id
  }
  return null
}

function comesFrom(before: string): boolean {
  if (/(?:з|із|зі)\s+$/u.test(before)) return true
  return BEARING_SPECS.some(([stem]) => new RegExp(`(?:з|із|зі)\\s+${stem}\\p{L}*\\s+$`, "u").test(before))
}

function sitsAt(before: string): boolean {
  return BEARING_SPECS.some(([stem]) => new RegExp(`(?:на|у|в)\\s+${stem}\\p{L}*\\s+$`, "u").test(before))
}

function roleOf(text: string, hit: Hit): "from" | "to" | "at" | "via" {
  const b = beforeOf(text, hit.start)
  if (/\(\s*$/u.test(b) && /курс/u.test(norm(text))) return "to"
  if (/(курсом на|курс на|курсом|курс|в напрямку|у напрямку|напрямку)\s+$/u.test(b)) return "to"
  if (comesFrom(b)) return "from"
  if (sitsAt(b)) return "at"
  if (/(через|над)\s+$/u.test(b)) return "via"
  if (/(на|до)\s+$/u.test(b)) return "to"
  if (/:\s*$/u.test(b) || hit.start < 2) return "at"
  return "to"
}

function inboundBearing(text: string): Bearing | null {
  const t = norm(text)
  const rules: [RegExp, Bearing][] = [
    [/з\p{L}?\s+північно-схід/u, "ne"],
    [/з\p{L}?\s+північно-захід/u, "nw"],
    [/з\p{L}?\s+південно-схід/u, "se"],
    [/з\p{L}?\s+південно-захід/u, "sw"],
    [/з\p{L}?\s+півноч/u, "n"],
    [/з\p{L}?\s+півд/u, "s"],
    [/з\p{L}?\s+захід/u, "w"],
    [/з\p{L}?\s+схід/u, "e"],
  ]
  for (const [re, id] of rules) {
    if (re.test(t)) return id
  }
  return null
}

function headingBearing(text: string): Bearing | null {
  const t = norm(text)
  for (const [stem, id] of BEARING_SPECS) {
    if (new RegExp(`курс\\p{L}*\\s+(?:на\\s+)?${stem}`, "u").test(t)) return id
  }
  return null
}

function explode(segment: string, base: { idStem: string; at: string; source: string; sourceLabel: string; url: string }): Track[] {
  const kind = kindOf(segment)
  if (!kind) return []
  const hits = findHits(segment).map((hit) => ({
    ...hit,
    role: roleOf(segment, hit),
    edge: bearingInText(beforeOf(segment, hit.start)),
  }))
  const froms = hits.filter((hit) => hit.role === "from")
  const tos = hits.filter((hit) => hit.role === "to")
  const ats = hits.filter((hit) => hit.role === "at" || hit.role === "via")

  const mentionsCity = /напрямку міста|на місто|курсом на місто/u.test(norm(segment))
  if (mentionsCity) {
    for (const hit of ats) {
      if (hit.place.kind === "city") tos.push(hit)
    }
  }

  let destinations = tos.filter((hit, index, all) => all.findIndex((item) => item.place.id === hit.place.id) === index)
  const cityDestinations = destinations.filter((hit) => hit.place.kind === "city")
  if (cityDestinations.length) destinations = cityDestinations

  const fromHit = froms[0]
  const atHit = ats.find((hit) => hit.place.kind === "city") ?? ats[0]
  const fromBearing = inboundBearing(segment)
  const heading = headingBearing(segment)

  const originOf = (): Point | null => {
    if (fromHit) {
      const shift = fromHit.place.kind === "city" ? null : fromHit.edge
      const moved = shift ? nudge(fromHit.place.lon, fromHit.place.lat, shift) : fromHit.place
      return { name: fromHit.place.name, lon: moved.lon, lat: moved.lat }
    }
    if (atHit) {
      const shift = atHit.place.kind === "city" ? null : atHit.edge
      const moved = shift ? nudge(atHit.place.lon, atHit.place.lat, shift) : atHit.place
      return { name: atHit.place.name, lon: moved.lon, lat: moved.lat }
    }
    return null
  }

  const arrows: { from: Point | null; to: Point | null; toward: string[] }[] = []
  if (destinations.length) {
    const origin = originOf()
    for (const dest of destinations) {
      let from = origin && origin.name !== dest.place.name ? origin : null
      if (!from && fromBearing) {
        const shifted = nudge(dest.place.lon, dest.place.lat, fromBearing)
        from = { name: "", lon: shifted.lon, lat: shifted.lat }
      }
      const to = { name: dest.place.name, lon: dest.place.lon, lat: dest.place.lat }
      if (from && Math.hypot(from.lon - to.lon, from.lat - to.lat) < 0.08) from = null
      if (to && !from && heading) {
        const tip = nudge(to.lon, to.lat, heading)
        arrows.push({
          from: to,
          to: { name: "", lon: tip.lon, lat: tip.lat },
          toward: dest.place.oblast ? [dest.place.oblast] : [],
        })
        continue
      }
      arrows.push({ from, to, toward: dest.place.oblast ? [dest.place.oblast] : [] })
    }
  } else if (atHit && heading) {
    const origin = originOf()
    if (origin) {
      const tip = nudge(origin.lon, origin.lat, heading)
      arrows.push({
        from: origin,
        to: { name: "", lon: tip.lon, lat: tip.lat },
        toward: atHit.place.oblast ? [atHit.place.oblast] : [],
      })
    }
  } else if (atHit) {
    arrows.push({
      from: null,
      to: { name: atHit.place.name, lon: atHit.place.lon, lat: atHit.place.lat },
      toward: atHit.place.oblast ? [atHit.place.oblast] : [],
    })
  } else {
    arrows.push({ from: null, to: null, toward: [] })
  }

  return arrows.map((arrow, index) => ({
    id: `${base.idStem}:${index}`,
    at: base.at,
    source: base.source,
    sourceLabel: base.sourceLabel,
    url: base.url,
    text: segment.replace(/\s+/g, " ").trim(),
    kind,
    from: arrow.from,
    to: arrow.to,
    toward: arrow.toward,
  }))
}

export function tracksFromPosts(posts: RawPost[]): Track[] {
  const out: Track[] = []
  for (const post of posts) {
    const cleaned = cleanup(post.text)
    if (!cleaned) continue
    const parts = cleaned
      .split(/\n+|🔻/g)
      .map((part) => part.replace(/[❗️⚠️✅‼️]+/gu, " ").trim())
      .filter((part) => part.length > 2)
    const segments = parts.length ? parts : [cleaned]
    segments.forEach((segment, index) => {
      out.push(
        ...explode(segment, {
          idStem: `${post.post}:${index}`,
          at: post.at,
          source: post.source,
          sourceLabel: post.sourceLabel,
          url: `https://t.me/${post.post}`,
        }),
      )
    })
  }
  const seen = new Set<string>()
  const deduped: Track[] = []
  for (const track of out) {
    const key = `${track.kind}|${norm(track.text)}|${track.to?.name ?? ""}|${track.from?.name ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(track)
  }
  deduped.sort((a, b) => (a.at < b.at ? 1 : -1))
  return deduped
}
