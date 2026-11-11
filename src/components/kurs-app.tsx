import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Bell, BellOff, Map as MapIcon, Radio, Siren, Plus, Minus, Maximize2 } from "lucide-react"
import { OBLASTS, project } from "@/data/oblasts"
import { PLACES } from "@/lib/places"
import { loadDistricts, type DistrictShape } from "@/lib/district-shapes"
import type { Level, LiveData, OblastLive, Track } from "@/lib/live.types"
import { getLive } from "@/lib/live"

const MAP_MS = 50 * 60 * 1000
const KYIV = { lon: 30.524, lat: 50.45 }

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
    <main className="mx-auto flex h-dvh max-w-lg flex-col bg-bg text-fg">
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
        <MapPane
          oblasts={data.oblasts}
          cities={data.cities}
          arrows={arrows}
          home={home === "kyiv" ? "kyivska" : home}
          selected={selected}
          onSelect={setSelected}
          focus={focus}
          incoming={incoming}
          now={now}
          detail={selectedOblast}
          onHome={() => {
            if (!selected) return
            setHome(selected)
          }}
        />
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

      <nav className="safe-bottom grid grid-cols-3 border-t border-line bg-surface" aria-label="Розділи">
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

function MapPane({
  oblasts,
  cities,
  arrows,
  home,
  selected,
  onSelect,
  focus,
  incoming,
  now,
  detail,
  onHome,
}: {
  oblasts: OblastLive[]
  cities: LiveData["cities"]
  arrows: Track[]
  home: string
  selected: string | null
  onSelect: (slug: string) => void
  focus: { name: string; level: Level; startedAt: string | null; partial: boolean }
  incoming: Track[]
  now: number
  detail?: OblastLive
  onHome: () => void
}) {
  const bySlug = new Map(oblasts.map((row) => [row.slug, row]))
  const kyiv = cities.find((city) => city.slug === "kyiv")
  const kyivPoint = project(KYIV.lon, KYIV.lat)
  const [districtShapes, setDistrictShapes] = useState<DistrictShape[]>([])
  const [districtError, setDistrictError] = useState(false)
  const [showTowns, setShowTowns] = useState(true)
  const [showDistricts, setShowDistricts] = useState(true)
  const districtSlug = selected ?? home
  useEffect(() => {
    let active = true
    setDistrictShapes([])
    setDistrictError(false)
    loadDistricts(districtSlug).then(data => {
      if (active) setDistrictShapes(data)
    }).catch(() => {
      if (active) setDistrictError(true)
    })
    return () => { active = false }
  }, [districtSlug])
  const towns = useMemo(() => PLACES.filter(p => p.kind === "city").filter((p, i) => {
    if (zoom < 1.65 && i > 24) return false
    const pt = project(p.lon, p.lat)
    return pt.x >= viewX - 35 && pt.x <= viewX + viewWidth + 35 &&
      pt.y >= viewY - 25 && pt.y <= viewY + viewHeight + 25
  }).slice(0, zoom < 1.65 ? 25 : zoom < 2.7 ? 65 : 120), [zoom, viewX, viewY, viewWidth, viewHeight])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const lastDistance = useRef<number | null>(null)
  const viewWidth = 1000 / zoom
  const viewHeight = 680 / zoom
  const viewX = Math.max(0, Math.min(1000 - viewWidth, (1000 - viewWidth) / 2 + pan.x))
  const viewY = Math.max(0, Math.min(680 - viewHeight, (680 - viewHeight) / 2 + pan.y))
  function pointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      lastDistance.current = Math.hypot(a.x-b.x, a.y-b.y)
    }
  }
  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, {x:e.clientX,y:e.clientY})
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    if (pointers.current.size === 2) {
      const [a,b] = [...pointers.current.values()]
      const d = Math.hypot(a.x-b.x,a.y-b.y)
      if(lastDistance.current) setZoom(z => Math.max(1,Math.min(5,z*d/lastDistance.current!)))
      lastDistance.current=d
    } else {
      const factor = Math.min(rect.width / 1000, rect.height / 680)
      setPan(p => ({x:p.x-(e.clientX-prev.x)/(factor*zoom),y:p.y-(e.clientY-prev.y)/(factor*zoom)}))
    }
  }
  function pointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId)
    lastDistance.current=null
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-3">
        <p className="text-sm text-muted">{focus.name}</p>
        <h1 className="text-4xl font-extrabold tracking-tight">
          <StatusWord level={focus.level} />
        </h1>
        <p className="mt-1 text-sm text-muted">
          {focus.level === "none"
            ? "Зараз без тривоги у вибраному регіоні"
            : `${focus.partial ? "Частково · " : ""}від ${focus.startedAt ? clock(focus.startedAt) : "—"} · ${focus.startedAt ? ago(focus.startedAt, now) : ""}`}
        </p>
        {incoming.length ? (
          <p className="mt-2 text-sm text-warn">
            За дописами курс у ваш бік: {incoming[0]?.to?.name}. Це приблизно, не радіолокація.
          </p>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 px-2 pt-2">
        <svg ref={svgRef} viewBox={[viewX,viewY,viewWidth,viewHeight].join(" ")} className="h-full w-full select-none" style={{touchAction:"none"}} role="img" aria-label="Інтерактивна мапа тривог України" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={e => {e.preventDefault();setZoom(z=>Math.max(1,Math.min(5,z*(e.deltaY<0?1.15:1/1.15))))}}>
          {OBLASTS.map((shape) => {
            const row = shape.slug ? bySlug.get(shape.slug) : undefined
            const level = row?.level ?? "none"
            const fill = !shape.covered
              ? "var(--color-bg)"
              : level === "red"
                ? "var(--color-danger)"
                : level === "yellow"
                  ? "var(--color-warn)"
                  : "var(--color-surface-2)"
            const opacity = !shape.covered ? 1 : level === "none" ? 1 : row?.partial ? 0.45 : 0.78
            const isHome = shape.slug === home
            const isSelected = shape.slug === selected
            return (
              <path
                key={shape.name}
                d={shape.d}
                fill={fill}
                fillOpacity={opacity}
                stroke={isSelected ? "var(--color-fg)" : "var(--color-line)"}
                strokeWidth={isHome ? 4 : isSelected ? 3 : 1.4}
                role={shape.slug ? "button" : undefined}
                tabIndex={shape.slug ? 0 : undefined}
                aria-label={shape.slug ? `${shape.name}, ${level === "none" ? "без тривоги" : level === "red" ? "тривога" : "загроза БпЛА"}` : undefined}
                onClick={() => shape.slug && onSelect(shape.slug)}
                onKeyDown={(event) => {
                  if (shape.slug && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault()
                    onSelect(shape.slug)
                  }
                }}
              />
            )
          })}
          {showDistricts && zoom >= 1.45 && districtShapes.map((district, i) => (
            <path key={district.name + i} d={district.d} fill="none" stroke="var(--color-fg)" strokeOpacity={0.5} strokeWidth={0.8 / Math.sqrt(zoom)} strokeDasharray="3 2" pointerEvents="none">
              <title>{district.name} · адміністративна межа, не межа тривоги</title>
            </path>
          ))}
          {showTowns && towns.map((town, i) => {
            const pt = project(town.lon, town.lat)
            const scale = Math.max(0.48, 1 / Math.sqrt(zoom))
            return (
              <g key={town.id} transform={"translate(" + pt.x + " " + pt.y + ") scale(" + scale + ")"} pointerEvents="none">
                <circle r={i < 25 ? 3.8 : 2.9} fill="var(--color-fg)" stroke="var(--color-bg)" strokeWidth="1.7"/>
                <text x="6" y="-6" fill="var(--color-fg)" fontSize={i < 25 ? 12 : 10} fontWeight={i < 25 ? 700 : 500} stroke="var(--color-bg)" strokeWidth="2.6" paintOrder="stroke">{town.name}</text>
              </g>
            )
          })}
          {arrows.map((track) => {
            if (!track.to) return null
            const point = project(track.to.lon, track.to.lat)
            const mine = track.toward.includes(home)
            const scale = Math.max(0.5, 1 / Math.sqrt(zoom))
            return (
              <g key={track.id} transform={["translate(",point.x," ",point.y,") scale(",scale,")"].join("")}>
                <title>{["Умовний орієнтир: ",track.to.name || "напрямок"," · ",track.sourceLabel," · ",clock(track.at),". Не точне місцезнаходження БпЛА"].join("")}</title>
                <circle r="22" fill="var(--color-bg)" stroke={mine ? "var(--color-danger)" : "var(--color-warn)"} strokeWidth="3"/>
                <path d="M-5 -12 L-20 -4 L-20 2 L-5 1 L-3 14 L0 18 L3 14 L5 1 L20 2 L20 -4 L5 -12 L3 -17 L-3 -17 Z" fill={mine ? "var(--color-danger)" : "var(--color-warn)"} stroke="var(--color-bg)" strokeWidth="1.5" />
                {track.to.name ? <text x="26" y="-8" fill="var(--color-fg)" fontSize="16" fontWeight="700" stroke="var(--color-bg)" strokeWidth="3" paintOrder="stroke">{track.to.name}</text> : null}
              </g>
            )
          })}
          <circle
            cx={kyivPoint.x}
            cy={kyivPoint.y}
            r={6}
            fill={kyiv?.level === "red" ? "var(--color-danger)" : kyiv?.level === "yellow" ? "var(--color-warn)" : "var(--color-fg)"}
            stroke="var(--color-bg)"
            strokeWidth={2}
          />
        </svg>
        <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
          <button type="button" aria-label="Наблизити карту" onClick={() => setZoom(z => Math.min(5,z*1.5))} className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-fg"><Plus className="size-5"/></button>
          <button type="button" aria-label="Віддалити карту" onClick={() => setZoom(z => Math.max(1,z/1.5))} className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-fg"><Minus className="size-5"/></button>
          <button type="button" aria-label="Вся Україна" onClick={() => {setZoom(1);setPan({x:0,y:0})}} className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-fg"><Maximize2 className="size-5"/></button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pb-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <i className="inline-block size-2 rounded-full bg-danger" /> ракети / тривога
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block size-2 rounded-full bg-warn" /> БпЛА
        </span>
        <span>БпЛА — умовний орієнтир із допису</span>
      </div>

      {detail ? (
        <div className="max-h-40 overflow-y-auto border-t border-line px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{detail.name}</p>
            <button type="button" className="min-h-11 rounded-full bg-warn px-4 text-sm font-bold text-bg" onClick={onHome}>
              Мій регіон
            </button>
          </div>
          {detail.districts.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {detail.districts.slice(0, 8).map((district) => (
                <li key={district.slug} className="flex justify-between gap-3 text-muted">
                  <span className={district.level === "red" ? "text-danger" : "text-warn"}>{district.name}</span>
                  <span>з {clock(district.startedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted">Районів під тривогою немає</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function FeedPane({ tracks, now, warnings }: { tracks: Track[]; now: number; warnings: string[] }) {
  const rows = tracks.filter((track) => fresh(track, now) || track.kind === "ballistic").slice(0, 40)
  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
        Тривоги: tryvoha.online за офіційною системою оповіщення. Шахеди на мапі — не координати радара, а текст з @kpszsu, @monitor1654 і @kharkivlife.
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
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
