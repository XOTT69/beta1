import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Bell, BellOff, Map as MapIcon, Radio, Siren, ShieldAlert } from "lucide-react"
import { GeoMap } from "@/components/geo-map"
import type { Level, LiveData, OblastLive, Track } from "@/lib/live.types"
import { getLive } from "@/lib/live"

const MAP_MS = 50 * 60 * 1000

type Tab = "map" | "feed" | "regions"

function worse(a: Level, b: Level): Level {
  const rank = { none: 0, yellow: 1, red: 2 }
  return rank[a] >= rank[b] ? a : b
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  if (min < 1) return "щойно"
  if (min < 60) return `${min} хв`
  const hours = Math.floor(min / 60)
  const rest = min % 60
  return rest ? `${hours} год ${rest} хв` : `${hours} год`
}

function fresh(track: Track, now: number): boolean {
  return now - Date.parse(track.at) < MAP_MS
}

function beep() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  const ctx = new Ctx()
  const tone = (freq: number, at: number) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28)
    osc.start(ctx.currentTime + at)
    osc.stop(ctx.currentTime + at + 0.3)
  }
  void ctx.resume().then(() => {
    tone(784, 0)
    tone(523, 0.16)
  })
}

export function KursApp({ initial }: { initial: LiveData }) {
  const [data, setData] = useState(initial)
  const [tab, setTab] = useState<Tab>("map")
  const [home, setHome] = useState("kyivska")
  const [sound, setSound] = useState(false)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<string | null>("kyivska")
  const [now, setNow] = useState(() => Date.parse(initial.fetchedAt))
  const [offline, setOffline] = useState(false)
  const seen = useRef<string[] | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("kurs-prefs")
      if (raw) {
        const parsed = JSON.parse(raw) as { home?: string; sound?: boolean }
        if (parsed.home) {
          setHome(parsed.home)
          setSelected(parsed.home === "kyiv" ? "kyivska" : parsed.home)
        }
        if (parsed.sound) setSound(true)
      }
    } catch {
      /* ignore broken prefs */
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem("kurs-prefs", JSON.stringify({ home, sound }))
  }, [home, sound, ready])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    const pull = window.setInterval(() => {
      getLive()
        .then((next) => {
          setData(next)
          setOffline(false)
        })
        .catch(() => setOffline(true))
    }, 30000)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(pull)
    }
  }, [])

  const oblastBySlug = useMemo(() => new Map(data.oblasts.map((row) => [row.slug, row])), [data.oblasts])

  const focus = useMemo(() => {
    if (home === "kyiv") {
      const city = data.cities.find((item) => item.slug === "kyiv")
      const oblast = oblastBySlug.get("kyivska")
      return {
        name: "Київ і Київщина",
        level: worse(city?.level ?? "none", oblast?.level ?? "none"),
        startedAt: [city?.startedAt, oblast?.startedAt].filter(Boolean).sort()[0] ?? null,
        partial: oblast?.partial ?? true,
        districts: oblast?.districts ?? [],
      }
    }
    const oblast = oblastBySlug.get(home)
    return {
      name: oblast?.name ?? "Регіон",
      level: oblast?.level ?? "none",
      startedAt: oblast?.startedAt ?? null,
      partial: oblast?.partial ?? false,
      districts: oblast?.districts ?? [],
    }
  }, [data.cities, home, oblastBySlug])

  const arrows = useMemo(() => {
    const kept: Track[] = []
    const keys = new Set<string>()
    for (const track of data.tracks) {
      if (track.kind !== "uav" || !fresh(track, now)) continue
      if (!track.to) continue
      const key = `${track.to.name}|${track.from?.name ?? ""}|${track.to.lon.toFixed(1)}`
      if (keys.has(key)) continue
      keys.add(key)
      kept.push(track)
    }
    return kept.slice(0, 18)
  }, [data.tracks, now])

  const incoming = useMemo(
    () =>
      arrows.filter((track) =>
        home === "kyiv" ? track.toward.includes("kyivska") || track.to?.name === "Київ" : track.toward.includes(home),
      ),
    [arrows, home],
  )

  useEffect(() => {
    const ids = incoming.map((track) => track.id)
    if (seen.current && sound) {
      const novel = ids.filter((id) => !seen.current?.includes(id))
      if (novel.length) {
        beep()
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const title = focus.level === "none" ? "Курс у ваш бік" : "Повітряна тривога"
          new Notification(title, { body: incoming[0]?.text ?? focus.name })
        }
      }
    }
    seen.current = ids
  }, [incoming, sound, focus.level, focus.name])

  const selectedOblast = selected ? oblastBySlug.get(selected) : undefined
  const activeCount = data.oblasts.filter((row) => row.level !== "none").length
  const updatedSec = Math.max(0, Math.round((now - Date.parse(data.fetchedAt)) / 1000))

  return (
    <main className="flex h-dvh w-full min-w-0 flex-col bg-bg text-fg">
      <header className="safe-top flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="grid size-10 place-items-center rounded-full bg-surface text-warn">
          <Siren className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold leading-none tracking-tight">Курс</p>
          <p className="mt-1 text-xs text-muted">
            {offline ? "немає зв'язку, показую останнє" : `оновлено ${updatedSec} с тому`}
            {activeCount ? ` · тривога в ${activeCount}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full bg-surface text-fg"
          aria-pressed={sound}
          aria-label={sound ? "Вимкнути сигнал" : "Увімкнути сигнал"}
          onClick={() => {
            setSound((value) => !value)
            if (!sound && typeof Notification !== "undefined" && Notification.permission === "default") {
              void Notification.requestPermission()
            }
          }}
        >
          {sound ? <Bell className="size-5" /> : <BellOff className="size-5 text-muted" />}
        </button>
      </header>

      {tab === "map" ? (
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:px-7">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Обраний регіон · {focus.name}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <h1 className="text-xl font-extrabold md:text-2xl"><StatusWord level={focus.level}/></h1>
                <span className="text-xs text-muted">{focus.startedAt ? "з " + clock(focus.startedAt) + " · " + ago(focus.startedAt, now) : "За останніми даними"}</span>
              </div>
              {incoming.length > 0 ? <p className="mt-1 max-w-[68ch] truncate text-xs text-warn">Орієнтир з допису: {incoming[0]?.to?.name || "напрямок"} · не радіолокація</p> : null}
            </div>
            <button className="min-h-10 rounded-xl border border-line bg-bg px-3 text-sm font-semibold hover:border-muted" type="button" onClick={() => selected && setHome(selected)}>
              <ShieldAlert className="mr-1 inline size-4"/> Мій регіон
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <GeoMap oblasts={data.oblasts} tracks={arrows} selected={selected} onSelect={setSelected} now={now}/>
          </div>
        </section>
      ) : null}
      {tab === "feed" ? <FeedPane tracks={data.tracks} now={now} warnings={data.warnings} /> : null}

      {tab === "regions" ? (
        <RegionsPane
          oblasts={data.oblasts}
          cities={data.cities}
          home={home}
          onHome={(slug) => {
            setHome(slug)
            setSelected(slug === "kyiv" ? "kyivska" : slug)
            setTab("map")
          }}
        />
      ) : null}

      <nav className="safe-bottom mx-auto grid w-full max-w-lg grid-cols-3 border-t border-line bg-surface md:max-w-xl" aria-label="Розділи">
        <TabButton current={tab} id="map" label="Мапа" icon={<MapIcon className="size-5" />} onSelect={setTab} />
        <TabButton current={tab} id="feed" label="Стрічка" icon={<Radio className="size-5" />} onSelect={setTab} />
        <TabButton current={tab} id="regions" label="Регіон" icon={<Siren className="size-5" />} onSelect={setTab} />
      </nav>
    </main>
  )
}

function TabButton({
  current,
  id,
  label,
  icon,
  onSelect,
}: {
  current: Tab
  id: Tab
  label: string
  icon: ReactNode
  onSelect: (tab: Tab) => void
}) {
  const active = current === id
  return (
    <button
      type="button"
      className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? "text-warn" : "text-muted"}`}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(id)}
    >
      {icon}
      {label}
    </button>
  )
}

function StatusWord({ level }: { level: Level }) {
  if (level === "red") return <span className="text-danger">Тривога</span>
  if (level === "yellow") return <span className="text-warn">Загроза БпЛА</span>
  return <span className="text-safe">Тихо</span>
}

function FeedPane({ tracks, now, warnings }: { tracks: Track[]; now: number; warnings: string[] }) {
  const rows = tracks.filter((track) => fresh(track, now) || track.kind === "ballistic").slice(0, 40)
  return (
    <section className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-4 py-5 md:px-8">
      <p className="text-sm text-muted">
        Публічні дописи каналів. Курси приблизні й запізнюються. Укриття — за сиреною та офіційним застосунком «Повітряна тривога».
      </p>
      {warnings.length ? <p className="mt-2 text-sm text-warn">{warnings[0]}</p> : null}
      <ul className="mt-3 space-y-2">
        {rows.length ? (
          rows.map((track) => (
            <li key={track.id} className="rounded-2xl bg-surface px-3 py-3">
              <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
                <span>
                  {clock(track.at)} · {track.sourceLabel}
                  {track.kind === "ballistic" ? " · балістика" : track.kind === "fpv" ? " · FPV" : ""}
                </span>
                <a className="font-semibold text-warn" href={track.url} target="_blank" rel="noreferrer">
                  допис
                </a>
              </div>
              <p className="mt-1 text-sm leading-snug">{track.text}</p>
              {track.to?.name ? (
                <p className="mt-1 text-xs text-warn">
                  {track.from?.name ? `${track.from.name} → ` : ""}
                  {track.to.name}
                </p>
              ) : null}
            </li>
          ))
        ) : (
          <li className="rounded-2xl bg-surface px-3 py-4 text-sm text-muted">Свіжих дописів про курси немає.</li>
        )}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Тривоги: alerts.in.ua (за наявності серверного токена), резервне джерело — tryvoha.online. Орієнтири БпЛА — з публічних Telegram-дописів, не координати радара. Повідомлення можуть бути неповними або застарілими.
      </p>
    </section>
  )
}

function RegionsPane({
  oblasts,
  cities,
  home,
  onHome,
}: {
  oblasts: OblastLive[]
  cities: LiveData["cities"]
  home: string
  onHome: (slug: string) => void
}) {
  const kyiv = cities.find((city) => city.slug === "kyiv")
  const rows = [{ slug: "kyiv", name: "м. Київ", level: kyiv?.level ?? "none" }, ...oblasts.map((row) => ({ slug: row.slug, name: row.name, level: row.level }))]
  return (
    <section className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-4 py-5 md:px-8">
      <h1 className="text-xl font-extrabold tracking-tight">Де ви</h1>
      <p className="mt-1 text-sm text-muted">Сигнал спрацює, якщо увімкнений, коли в стрічці з'явиться курс у цей регіон.</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const active = row.slug === home
          return (
            <li key={row.slug}>
              <button
                type="button"
                className={`flex min-h-12 w-full items-center justify-between rounded-2xl px-3 text-left ${active ? "bg-surface-2" : "bg-surface"}`}
                onClick={() => onHome(row.slug)}
              >
                <span className="font-semibold">{row.name}</span>
                <span className={row.level === "red" ? "text-danger" : row.level === "yellow" ? "text-warn" : "text-muted"}>
                  {row.level === "red" ? "тривога" : row.level === "yellow" ? "БпЛА" : "тихо"}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
