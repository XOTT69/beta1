export type Level = "red" | "yellow" | "none"

export type Point = { name: string; lon: number; lat: number }

export type TrackKind = "uav" | "fpv" | "ballistic"

export type Track = {
  id: string
  at: string
  source: string
  sourceLabel: string
  url: string
  text: string
  kind: TrackKind
  from: Point | null
  to: Point | null
  toward: string[]
}

export type DistrictAlert = {
  slug: string
  name: string
  level: "red" | "yellow"
  startedAt: string
}

export type OblastLive = {
  slug: string
  name: string
  level: Level
  partial: boolean
  startedAt: string | null
  districts: DistrictAlert[]
}

export type CityLive = {
  slug: string
  name: string
  level: Level
  startedAt: string | null
}

export type LiveData = {
  fetchedAt: string
  alertsUpdatedAt: string | null
  oblasts: OblastLive[]
  cities: CityLive[]
  tracks: Track[]
  warnings: string[]
}
