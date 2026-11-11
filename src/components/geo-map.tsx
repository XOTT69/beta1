import { useEffect, useRef, useState } from "react"
import { Layers3, LocateFixed, MapPinned, Minus, Plus } from "lucide-react"
import { OBLASTS } from "@/data/oblasts"
import { PLACES } from "@/lib/places"
import { DISTRICT_FILES } from "@/lib/district-shapes"
import type { LiveData, OblastLive, Track } from "@/lib/live.types"

type MapProps = {
  oblasts: OblastLive[]
  tracks: Track[]
  selected: string | null
  onSelect: (slug: string) => void
  now: number
}
type LObject = Record<string, any>
type MapInstance = any

const MAP_SOURCE = "https://cdn.jsdelivr.net/gh/darmat1/ukraine-geo-data@main/geodata/Ukraine.geojson"
const LIB_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
const LIB_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
const BOUNDS: [[number, number], [number, number]] = [[44.25, 21.6], [52.5, 40.5]]
const MAX_AGE_MS = 50 * 60 * 1000

function normalized(name: string): string {
  return name.toLocaleLowerCase("uk-UA").replace(/['’]/g, "").replace(/\\s+/g, " ").trim()
}
const SLUG_BY_NAME = new Map(OBLASTS.filter(item => item.slug).map(item => [normalized(item.name), item.slug as string]))

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}
function timeSince(value: string | null, now: number): string {
  if (!value || !Number.isFinite(Date.parse(value))) return ""
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000))
  if (minutes < 60) return minutes + " хв"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours + " год" + (rest ? " " + rest + " хв" : "")
}
let leafletLoader: Promise<MapInstance> | null = null
function loadLeaflet(): Promise<MapInstance> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"))
  if ((window as any).L) return Promise.resolve((window as any).L)
  if (leafletLoader) return leafletLoader
  leafletLoader = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-kurs-leaflet]')) {
      const css = document.createElement("link")
      css.rel = "stylesheet"
      css.href = LIB_CSS
      css.dataset.kursLeaflet = "true"
      document.head.appendChild(css)
    }
    const script = document.createElement("script")
    script.src = LIB_JS
    script.async = true
    script.onload = () => (window as any).L ? resolve((window as any).L) : reject(new Error("Leaflet was not loaded"))
    script.onerror = () => reject(new Error("Could not load map library"))
    document.head.appendChild(script)
  }).catch(error => { leafletLoader = null; throw error })
  return leafletLoader
}

function mapStyle(level: string, partial: boolean, selected: boolean): Record<string, unknown> {
  const active = level === "red" || level === "yellow"
  return {
    color: selected ? "#273b49" : active ? "#906e68" : "#b8b5ae",
    weight: selected ? 2.7 : 1.1,
    opacity: 0.9,
    fillColor: level === "red" ? "#e97871" : level === "yellow" ? "#ffcb48" : "#fffdf8",
    fillOpacity: active ? (partial ? 0.5 : 0.81) : 0.59,
  }
}
function markerHtml(track: Track, isLocal: boolean): string {
  const accent = isLocal ? "#f14b60" : "#7657db"
  return '<span class="kurs-aircraft' + (isLocal ? " kurs-aircraft-near" : "") + '" aria-hidden="true">' +
    '<svg viewBox="0 0 48 48" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M23.4 5.5h1.2l3.2 13.5L43 26.2v5.2l-16-4.3-1.2 11.8 5.6 3.9v2.5L24 43.2l-7.4 2.1v-2.5l5.6-3.9L21 27.1 5 31.4v-5.2l15.2-7.2L23.4 5.5Z" fill="' + accent + '" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>' +
    '</svg></span>'
}
const districtCache = new Map<string, Promise<unknown>>()
async function districtGeoJson(slug: string): Promise<unknown> {
  const file = DISTRICT_FILES[slug]
  if (!file) return { type: "FeatureCollection", features: [] }
  if (!districtCache.has(file)) {
    const promise = fetch("https://cdn.jsdelivr.net/gh/darmat1/ukraine-geo-data@main/geodata/" + file + ".geojson")
      .then(response => { if (!response.ok) throw Error("Districts " + response.status); return response.json() })
      .catch(error => { districtCache.delete(file); throw error })
    districtCache.set(file, promise)
  }
  return districtCache.get(file)!
}

export function GeoMap({ oblasts, tracks, selected, onSelect, now }: MapProps) {
  const root = useRef<HTMLDivElement | null>(null)
  const map = useRef<MapInstance | null>(null)
  const leaflet = useRef<MapInstance | null>(null)
  const alertLayer = useRef<MapInstance | null>(null)
  const districtLayer = useRef<MapInstance | null>(null)
  const citiesLayer = useRef<MapInstance | null>(null)
  const labelsLayer = useRef<MapInstance | null>(null)
  const aircraftLayer = useRef<MapInstance | null>(null)
  const geojson = useRef<unknown>(null)
  const onSelectLatest = useRef(onSelect)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [zoom, setZoom] = useState(6)
  const [showDistricts, setShowDistricts] = useState(true)
  const [showCities, setShowCities] = useState(true)
  const [showAircraft, setShowAircraft] = useState(true)
  const [districtError, setDistrictError] = useState(false)
  const bySlug = new Map(oblasts.map(row => [row.slug, row]))
  onSelectLatest.current = onSelect

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      try {
        const L = await loadLeaflet()
        if (cancelled || !root.current) return
        leaflet.current = L
        const instance = L.map(root.current, {
          zoomControl: false,
          preferCanvas: true,
          minZoom: 5,
          maxZoom: 13,
          zoomSnap: 0.25,
          attributionControl: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
        })
        map.current = instance
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          className: "kurs-basemap",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(instance)
        instance.fitBounds(BOUNDS, { padding: [14, 14], animate: false })
        instance.on("zoomend", () => setZoom(instance.getZoom()))
        const [response] = await Promise.all([
          fetch(MAP_SOURCE),
          new Promise(resolve => window.setTimeout(resolve, 50)),
        ])
        if (!response.ok) throw new Error("GeoJSON: " + response.status)
        const shapes = await response.json()
        if (cancelled) return
        geojson.current = shapes
        setZoom(instance.getZoom())
        setReady(true)
        window.requestAnimationFrame(() => instance.invalidateSize())
      } catch {
        if (!cancelled) setError("Не вдалося завантажити географічну карту. Перевірте інтернет-з'єднання.")
      }
    }
    void initialize()
    return () => {
      cancelled = true
      if (map.current) {
        map.current.remove()
        map.current = null
      }
      leaflet.current = null
    }
  }, [])

  useEffect(() => {
    const L = leaflet.current, instance = map.current
    if (!ready || !L || !instance || !geojson.current) return
    if (alertLayer.current) instance.removeLayer(alertLayer.current)
    if (labelsLayer.current) instance.removeLayer(labelsLayer.current)
    const polygons = L.geoJSON(geojson.current, {
      style: (feature: any) => {
        const slug = SLUG_BY_NAME.get(normalized(feature?.properties?.name || ""))
        const row = slug ? bySlug.get(slug) : null
        return mapStyle(row?.level || "none", row?.partial || false, slug === selected)
      },
      onEachFeature: (feature: any, layer: any) => {
        const name = String(feature?.properties?.name || "")
        const slug = SLUG_BY_NAME.get(normalized(name))
        const row = slug ? bySlug.get(slug) : null
        layer.bindTooltip(name + (row?.level === "red" ? " · Тривога" : row?.level === "yellow" ? " · Загроза" : ""), { sticky: true })
        if (slug) layer.on("click", () => onSelectLatest.current(slug))
      },
    }).addTo(instance)
    alertLayer.current = polygons
    const markers = L.layerGroup().addTo(instance)
    labelsLayer.current = markers
    for (const shape of OBLASTS) {
      if (!shape.slug || !shape.covered) continue
      const row = bySlug.get(shape.slug)
      const active = row?.level === "red" || row?.level === "yellow"
      const age = active ? timeSince(row?.startedAt || null, now) : ""
      const html = '<div class="kurs-oblast-label ' + (active ? "kurs-oblast-alert" : "") + '">' +
        '<strong>' + escapeHtml(shape.short) + '</strong>' +
        (age ? '<span>' + escapeHtml(age) + '</span>' : "") + '</div>'
      L.marker([shape.lat, shape.lon], {
        icon: L.divIcon({ className: "kurs-oblast-icon", html, iconSize: [120, 48], iconAnchor: [60, 24] }),
        interactive: false,
      }).addTo(markers)
    }
  }, [ready, oblasts, selected, now])

  useEffect(() => {
    const L = leaflet.current, instance = map.current
    if (!ready || !L || !instance) return
    if (aircraftLayer.current) instance.removeLayer(aircraftLayer.current)
    const group = L.layerGroup().addTo(instance)
    aircraftLayer.current = group
    if (!showAircraft) return
    const unique = new Set<string>()
    for (const track of tracks) {
      if (track.kind !== "uav" || !track.to || !Number.isFinite(Date.parse(track.at))) continue
      if (now - Date.parse(track.at) > MAX_AGE_MS || Date.parse(track.at) > now + 120000) continue
      const key = track.to.name + ":" + Math.round(track.to.lat * 10) + ":" + Math.round(track.to.lon * 10)
      if (unique.has(key)) continue
      unique.add(key)
      const local = Boolean(selected && track.toward.includes(selected))
      const marker = L.marker([track.to.lat, track.to.lon], {
        icon: L.divIcon({ className: "kurs-aircraft-icon", html: markerHtml(track, local), iconSize: [36, 36], iconAnchor: [18, 18] }),
        zIndexOffset: 700,
      }).addTo(group)
      const popup = document.createElement("div")
      popup.className = "kurs-threat-popup"
      const heading = document.createElement("strong")
      heading.textContent = "БпЛА · Орієнтир з допису"
      const description = document.createElement("p")
      description.textContent = track.text.slice(0, 240)
      const source = document.createElement("a")
      source.href = track.url
      source.target = "_blank"
      source.rel = "noopener noreferrer"
      source.textContent = track.sourceLabel + " · " + new Date(track.at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" })
      const note = document.createElement("small")
      note.textContent = "Це не радіолокаційні координати чи поточна позиція дрона."
      popup.append(heading, description, source, note)
      marker.bindPopup(popup, { maxWidth: 290 })
      if (unique.size >= 35) break
    }
  }, [ready, tracks, selected, now, showAircraft])

  useEffect(() => {
    const L = leaflet.current, instance = map.current
    if (!ready || !L || !instance) return
    if (citiesLayer.current) instance.removeLayer(citiesLayer.current)
    const group = L.layerGroup().addTo(instance)
    citiesLayer.current = group
    if (!showCities) return
    const limit = zoom < 6.3 ? 25 : zoom < 8 ? 55 : 130
    PLACES.filter(place => place.kind === "city").slice(0, limit).forEach((place, index) => {
      const html = '<span class="kurs-city-dot"></span><span class="kurs-city-name">' + escapeHtml(place.name) + '</span>'
      L.marker([place.lat, place.lon], {
        icon: L.divIcon({ className: "kurs-city-marker" + (index < 25 ? " kurs-major-city" : ""), html, iconSize: [120, 20], iconAnchor: [5, 10] }),
        interactive: false,
      }).addTo(group)
    })
  }, [ready, showCities, zoom])

  useEffect(() => {
    const L = leaflet.current, instance = map.current
    if (!ready || !L || !instance) return
    if (districtLayer.current) instance.removeLayer(districtLayer.current)
    if (!showDistricts || zoom < 7.1) return
    let cancelled = false
    setDistrictError(false)
    const chosen = selected || "kyivska"
    void districtGeoJson(chosen).then(data => {
      if (cancelled || !map.current) return
      const group = L.geoJSON(data, {
        filter: (feature: any) => String(feature?.properties?.admin_level || "") === "6",
        style: { color: "#806e64", weight: 1.1, opacity: 0.64, fillOpacity: 0, dashArray: "3 3", interactive: false },
      }).addTo(instance)
      districtLayer.current = group
    }).catch(() => { if (!cancelled) setDistrictError(true) })
    return () => { cancelled = true }
  }, [ready, showDistricts, zoom, selected])

  function fitAll() {
    map.current?.fitBounds(BOUNDS, { padding: [14, 14] })
  }

  return (
    <section className="kurs-map-shell relative h-full w-full overflow-hidden" aria-label="Інтерактивна карта України">
      <div ref={root} className="kurs-leaflet h-full w-full" />
      {!ready && !error ? <div className="kurs-map-loading">Завантаження карти України…</div> : null}
      {error ? <div className="kurs-map-loading">{error}</div> : null}
      <div className="kurs-map-actions absolute right-3 top-3 z-[800] flex flex-col gap-2">
        <button aria-label="Наблизити карту" onClick={() => map.current?.zoomIn()}><Plus size={19}/></button>
        <button aria-label="Віддалити карту" onClick={() => map.current?.zoomOut()}><Minus size={19}/></button>
        <button aria-label="Показати всю Україну" onClick={fitAll}><LocateFixed size={19}/></button>
      </div>
      <div className="kurs-map-layer-actions absolute left-3 top-3 z-[800] flex flex-wrap items-center gap-2">
        <span className="kurs-map-layer-title"><Layers3 size={15}/> Шари</span>
        <label><input type="checkbox" checked={showCities} onChange={event => setShowCities(event.target.checked)}/> Міста</label>
        <label><input type="checkbox" checked={showDistricts} onChange={event => setShowDistricts(event.target.checked)}/> Райони</label>
        <label><input type="checkbox" checked={showAircraft} onChange={event => setShowAircraft(event.target.checked)}/> БпЛА</label>
      </div>
      <div className="kurs-map-legend absolute bottom-6 left-3 z-[800] flex flex-wrap items-center gap-3">
        <span><i className="kurs-legend-red"/> Тривога</span>
        <span><i className="kurs-legend-yellow"/> Загроза</span>
        <span><i className="kurs-legend-white"/> Без тривоги</span>
        <span className="kurs-legend-note"><MapPinned size={13}/> БпЛА — з повідомлень, не GPS</span>
        {districtError ? <span>Межі районів недоступні</span> : null}
      </div>
    </section>
  )
}
