import { OBLASTS } from "@/data/oblasts"
import type { CityLive, Level, LiveData, OblastLive } from "@/lib/live.types"
import { tracksFromPosts, type RawPost } from "@/lib/parse-tracks"

const ALERTS_URL = "https://tryvoha.online/api/v1/alerts"
const REGIONS_URL = "https://tryvoha.online/api/v1/regions"
const CHANNELS = [
  { id: "kpszsu", label: "Повітряні Сили" },
  { id: "monitor1654", label: "Моніторинг" },
  { id: "kharkivlife", label: "Харків" },
] as const

const CITY_PARENT: Record<string, { name: string; oblast: string }> = {
  kyiv: { name: "м. Київ", oblast: "kyivska" },
  "m-xarkiv-ta-xarkivska-teritorialna-gromada": { name: "м. Харків", oblast: "xarkivska-oblast" },
  "m-zaporizzia-ta-zaporizka-teritorialna-gromada": { name: "м. Запоріжжя", oblast: "zaporizka-oblast" },
  "m-xerson-ta-xersonska-teritorialna-gromada": { name: "м. Херсон", oblast: "xersonska-oblast" },
}

type ApiAlert = {
  slug?: string
  type?: string
  name_uk?: string
  oblast_slug?: string
  level?: string
  started_at?: string
}

type Cache = { at: number; data: LiveData }
let cache: Cache | null = null
let inflight: Promise<LiveData> | null = null
let regionTotals: { at: number; totals: Map<string, number> } | null = null

const rank: Record<Level, number> = { none: 0, yellow: 1, red: 2 }

function worse(a: Level, b: Level): Level {
  return rank[a] >= rank[b] ? a : b
}

function asLevel(value: string | undefined): "red" | "yellow" | null {
  if (value === "red" || value === "yellow") return value
  return null
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`${response.status}`)
  return response.json()
}

async function districtTotals(): Promise<Map<string, number>> {
  if (regionTotals && Date.now() - regionTotals.at < 6 * 60 * 60 * 1000) return regionTotals.totals
  const body = (await getJson(REGIONS_URL)) as { regions?: { type?: string; oblast_slug?: string }[] }
  const totals = new Map<string, number>()
  for (const region of body.regions ?? []) {
    if (region.type !== "district" || !region.oblast_slug) continue
    totals.set(region.oblast_slug, (totals.get(region.oblast_slug) ?? 0) + 1)
  }
  regionTotals = { at: Date.now(), totals }
  return totals
}

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
}

async function channelPosts(id: string, label: string): Promise<RawPost[]> {
  const response = await fetch(`https://t.me/s/${id}`, {
    headers: {
      accept: "text/html",
      "user-agent": "Mozilla/5.0 (compatible; KursAlert/1.0; +https://alerts.in.ua)",
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`${id} ${response.status}`)
  const html = await response.text()
  const posts: RawPost[] = []
  for (const part of html.split('data-post="').slice(1)) {
    const post = part.split('"', 1)[0] ?? ""
    const textMatch = part.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    const dateMatch = part.match(/datetime="([^"]+)"/)
    if (!post || !textMatch || !dateMatch) continue
    posts.push({
      source: id,
      sourceLabel: label,
      post,
      at: dateMatch[1] ?? "",
      text: decodeHtml(textMatch[1] ?? "").slice(0, 700),
    })
  }
  return posts
}

async function loadFresh(): Promise<LiveData> {
  const warnings: string[] = []
  const [alertsResult, totalsResult, ...channelResults] = await Promise.allSettled([
    getJson(ALERTS_URL),
    districtTotals(),
    ...CHANNELS.map((channel) => channelPosts(channel.id, channel.label)),
  ])

  let alertsUpdatedAt: string | null = null
  const alerts: ApiAlert[] = []
  if (alertsResult.status === "fulfilled") {
    const body = alertsResult.value as { updated_at?: string; alerts?: ApiAlert[] }
    alertsUpdatedAt = body.updated_at ?? null
    alerts.push(...(body.alerts ?? []))
  } else {
    warnings.push("Не вдалося оновити статуси тривог")
  }

  const totals = totalsResult.status === "fulfilled" ? totalsResult.value : new Map<string, number>()
  if (totalsResult.status === "rejected") warnings.push("Не вдалося уточнити межі районів")

  const posts: RawPost[] = []
  CHANNELS.forEach((channel, index) => {
    const result = channelResults[index]
    if (!result || result.status === "rejected") {
      warnings.push(`Канал ${channel.label} зараз недоступний`)
      return
    }
    if (result.status === "fulfilled") posts.push(...(result.value as RawPost[]))
  })

  const bySlug = new Map<string, OblastLive>()
  for (const shape of OBLASTS) {
    if (!shape.slug) continue
    bySlug.set(shape.slug, {
      slug: shape.slug,
      name: shape.name,
      level: "none",
      partial: false,
      startedAt: null,
      districts: [],
    })
  }

  const cities = new Map<string, CityLive>()
  for (const [slug, meta] of Object.entries(CITY_PARENT)) {
    cities.set(slug, { slug, name: meta.name, level: "none", startedAt: null })
  }

  const whole = new Set<string>()
  for (const alert of alerts) {
    const level = asLevel(alert.level)
    const slug = alert.slug
    const startedAt = alert.started_at
    if (!level || !slug || !startedAt) continue
    if (alert.type === "state" && bySlug.has(slug)) {
      whole.add(slug)
      const row = bySlug.get(slug)
      if (!row) continue
      row.level = worse(row.level, level)
      row.startedAt = row.startedAt && row.startedAt < startedAt ? row.startedAt : startedAt
      continue
    }
    const city = CITY_PARENT[slug]
    if (city) {
      const row = cities.get(slug)
      if (row) {
        row.level = worse(row.level, level)
        row.startedAt = startedAt
      }
      const parent = bySlug.get(city.oblast)
      if (parent) {
        parent.level = worse(parent.level, level)
        parent.startedAt = parent.startedAt && parent.startedAt < startedAt ? parent.startedAt : startedAt
        parent.districts.push({ slug, name: city.name, level, startedAt })
      }
      continue
    }
    const parentSlug = alert.oblast_slug
    if (!parentSlug || !bySlug.has(parentSlug)) continue
    const parent = bySlug.get(parentSlug)
    if (!parent) continue
    parent.level = worse(parent.level, level)
    parent.startedAt = parent.startedAt && parent.startedAt < startedAt ? parent.startedAt : startedAt
    parent.districts.push({
      slug,
      name: alert.name_uk ?? slug,
      level,
      startedAt,
    })
  }

  const oblasts = [...bySlug.values()].map((row) => {
    const total = totals.get(row.slug) ?? 0
    const districtCount = row.districts.filter((district) => !CITY_PARENT[district.slug]).length
    const partial = row.level !== "none" && !whole.has(row.slug) && (total === 0 || districtCount < total)
    row.districts.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    return { ...row, partial }
  })

  return {
    fetchedAt: new Date().toISOString(),
    alertsUpdatedAt,
    oblasts,
    cities: [...cities.values()],
    tracks: tracksFromPosts(posts),
    warnings,
  }
}

export async function loadLive(): Promise<LiveData> {
  if (cache && Date.now() - cache.at < 20_000) return cache.data
  if (!inflight) {
    inflight = loadFresh()
      .then((data) => {
        cache = { at: Date.now(), data }
        return data
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}
