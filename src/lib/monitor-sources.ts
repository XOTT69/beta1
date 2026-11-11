/** Public Telegram channels suggested by the project owner.
 * Availability and accuracy are not guaranteed; messages are unverified.
 */
export const MONITOR_SOURCES = [
  { id: "kpszsu", label: "Повітряні Сили" },
  { id: "monitor1654", label: "Моніторинг" },
  { id: "kharkivlife", label: "Харків" },
  { id: "chyste_nebo", label: "Чисте небо" },
  { id: "kyivschinanews", label: "Київщина News" },
  { id: "kiev_radar_truvoga_Vyshneve", label: "Радар Вишневе" },
  { id: "kryuvysh", label: "Крюківщина / Вишневе" },
  { id: "kyiv_airdef", label: "Київ ППО" },
  { id: "eRadarrua", label: "єРадар" },
  { id: "tviy_kyivv", label: "Твій Київ" },
  { id: "times_ukraina", label: "Times Україна" },
  { id: "waypoint_ua", label: "Waypoint" },
  { id: "KyivPolitic", label: "Київ Політика" },
  { id: "monitorwarr", label: "Monitor War" },
  { id: "kievinform_ua1", label: "Київ Інформ" },
  { id: "kiev_news24", label: "Київ News 24" },
  { id: "chyste_neboo", label: "Чисте небо 2" },
  { id: "kyiv_m0nitoring", label: "Київ Моніторинг" },
  { id: "kievkyiv", label: "Київ" },
  { id: "mon1tor_ua", label: "Монітор UA" },
] as const

export const MONITOR_SOURCE_IDS: string[] = MONITOR_SOURCES.map(source => source.id)
