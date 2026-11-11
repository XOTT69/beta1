import { OBLASTS } from "@/data/oblasts"

type IncomingAlert = {
  id?: number
  location_title?: string
  location_type?: string
  location_oblast?: string
  location_oblast_uid?: string
  alert_level?: string
  alert_type?: string
  started_at?: string
  updated_at?: string
}
export type NormalizedAlert = {
  slug?: string
  type?: string
  name_uk?: string
  oblast_slug?: string
  level?: string
  started_at?: string
}

function clean(name: string): string {
  return name.toLowerCase()
    .replace(/^м\.\s*/u, "")
    .replace(/['’ʼ]/gu, "")
    .replace(/\s+(область|район)$/u, "")
    .replace(/і/g, "i")
    .trim()
}
const aliases: Record<string, string> = {
  "київ": "kyivska",
  "київська": "kyivska",
  "крим": "",
  "автономна республіка крим": "",
}
const oblastLookup = new Map(OBLASTS.filter(o => o.slug).flatMap(o => [
  [clean(o.name), o.slug as string],
  [clean(o.short), o.slug as string],
] as [string, string][]))
function oblastSlug(name: string): string | undefined {
  const key = clean(name)
  return aliases[key] ?? oblastLookup.get(key)
}

export function normalizeAlertsInUa(rows: IncomingAlert[]): NormalizedAlert[] {
  const result: NormalizedAlert[] = []
  for (const alert of rows) {
    if (!alert.started_at || !alert.location_title) continue
    const level = alert.alert_level === "yellow" ? "yellow" : "red"
    const slug = oblastSlug(alert.location_title)
    const parent = oblastSlug(alert.location_oblast || alert.location_title)
    const isOblast = alert.location_type === "oblast"
    if (isOblast && slug) {
      result.push({ slug, type: "state", name_uk: alert.location_title, level, started_at: alert.started_at })
    } else if (parent) {
      const city = clean(alert.location_title) === "київ"
      result.push({
        slug: city ? "kyiv" : "alerts-in-ua:" + (alert.id || alert.location_title),
        type: city ? "city" : "district",
        name_uk: alert.location_title,
        oblast_slug: parent,
        level,
        started_at: alert.started_at,
      })
    }
  }
  return result
}

export async function fetchAlertsInUa(token: string): Promise<NormalizedAlert[]> {
  const response = await fetch("https://api.alerts.in.ua/v1/alerts/active.json", {
    headers: { authorization: "Bearer " + token, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error("alerts.in.ua HTTP " + response.status)
  const data = await response.json() as { alerts?: IncomingAlert[] }
  if (!Array.isArray(data.alerts)) throw new Error("alerts.in.ua invalid response")
  return normalizeAlertsInUa(data.alerts)
}
