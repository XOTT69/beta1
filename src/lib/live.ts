import { createServerFn } from "@tanstack/react-start"

import type { LiveData } from "@/lib/live.types"

export type { CityLive, DistrictAlert, Level, LiveData, OblastLive, Track, TrackKind } from "@/lib/live.types"

export const getLive = createServerFn({ method: "GET" }).handler(async (): Promise<LiveData> => {
  const { loadLive } = await import("./live.server")
  return loadLive()
})
