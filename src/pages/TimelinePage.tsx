import { useEffect, useMemo, useState } from 'react'
import { Search, Route, X, Trash2, Clock, MapPin, CircleSlash, ClipboardCheck } from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import {
  formatTimestamp,
  getTimeOfDay,
  getWeatherIcon,
  getTreeIcon,
  getPedestrianIcon,
} from '@/utils/sceneHelpers'
import { formatTripDate, formatTripTime } from '@/utils/scheduleHelpers'
import type { WindowScene, ScheduledTrip } from '@/types'
import BackfillDialog from '@/components/BackfillDialog'

type TimelineEntry =
  | { kind: 'scene'; time: number; data: WindowScene }
  | { kind: 'trip'; time: number; data: ScheduledTrip }

export default function TimelinePage() {
  const {
    scenes,
    routeNames,
    selectedRoute,
    currentRouteScenes,
    selectRoute,
    loadAll,
    deleteScene,
    trips,
    backfillTrip,
  } = useSceneStore()
  const [search, setSearch] = useState('')
  const [detailScene, setDetailScene] = useState<WindowScene | null>(null)
  const [backfillTarget, setBackfillTarget] = useState<ScheduledTrip | null>(null)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // 排了日程但还没有窗景的线路，也出现在筛选标签里
  const allRouteNames = useMemo(() => {
    const set = new Set(routeNames)
    trips.forEach((t) => set.add(t.routeName))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'))
  }, [routeNames, trips])

  const filteredRoutes = allRouteNames.filter((r) =>
    r.toLowerCase().includes(search.toLowerCase())
  )

  // 合并窗景与趟次：漏采/已补录的趟次作为缺口卡片，按结束时间插入
  const entries = useMemo<TimelineEntry[]>(() => {
    const result: TimelineEntry[] = []

    const sceneSource = selectedRoute
      ? currentRouteScenes
      : [...scenes].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
    sceneSource.forEach((s) =>
      result.push({ kind: 'scene', time: new Date(s.timestamp).getTime(), data: s })
    )

    const relevantTrips = trips.filter(
      (t) => (t.status === 'missed' || t.status === 'backfilled') &&
        (!selectedRoute || t.routeName === selectedRoute)
    )
    relevantTrips.forEach((t) =>
      result.push({ kind: 'trip', time: new Date(t.endsAt).getTime(), data: t })
    )

    return result.sort((a, b) => b.time - a.time)
  }, [scenes, currentRouteScenes, selectedRoute, trips])

  const handleDelete = (id: string) => {
    deleteScene(id)
    setDetailScene(null)
  }

  const sceneTripMap = useMemo(() => {
    const map = new Map<string, ScheduledTrip>()
    trips.forEach((t) => map.set(t.id, t))
    return map
  }, [trips])

  return (
    <div className="min-h-screen bg-teal-950 font-serif text-mist-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold tracking-wide text-dusk-400">
          窗景时间线
        </h1>

        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-mist-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索路线..."
              className="w-full rounded-lg border border-teal-800 bg-teal-900/60 py-2.5 pl-10 pr-4 text-sm text-mist-100 placeholder:text-mist-500 focus:border-dusk-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => selectRoute('')}
              className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                !selectedRoute
                  ? 'bg-dusk-400 text-teal-950'
                  : 'bg-teal-900 text-mist-300 hover:bg-teal-800'
              }`}
            >
              全部
            </button>
            {filteredRoutes.map((name) => (
              <button
                key={name}
                onClick={() => selectRoute(name)}
                className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                  selectedRoute === name
                    ? 'bg-dusk-400 text-teal-950'
                    : 'bg-teal-900 text-mist-300 hover:bg-teal-800'
                }`}
              >
                <Route className="mr-1 inline w-3 h-3" />
                {name}
              </button>
            ))}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-mist-400">
            <div className="mb-4 text-6xl opacity-30">🪟</div>
            <p className="text-lg">
              {selectedRoute ? '该路线暂无窗景记录' : '选择一条路线，开始浏览窗景'}
            </p>
          </div>
        ) : (
          <div className="relative pl-8">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-teal-800" />
            <div className="space-y-6">
              {entries.map((entry) =>
                entry.kind === 'scene' ? (
                  <SceneTimelineItem
                    key={`scene-${entry.data.id}`}
                    scene={entry.data}
                    trip={entry.data.tripId ? sceneTripMap.get(entry.data.tripId) : undefined}
                    onClick={() => setDetailScene(entry.data)}
                  />
                ) : (
                  <MissedTimelineItem
                    key={`trip-${entry.data.id}`}
                    trip={entry.data}
                    onBackfill={() => setBackfillTarget(entry.data)}
                  />
                )
              )}
            </div>
          </div>
        )}
      </div>

      {detailScene && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setDetailScene(null)}
        >
          <div
            className="relative mx-4 w-full max-w-md animate-scale-in rounded-2xl border border-teal-700 bg-teal-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDetailScene(null)}
              className="absolute right-4 top-4 text-mist-400 hover:text-mist-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4 flex items-center gap-3">
              {getWeatherIcon(detailScene.weather)}
              <h2 className="text-xl font-bold text-dusk-400">{detailScene.segment}</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-mist-300">
                <MapPin className="w-4 h-4 text-dusk-400" />
                <span>{detailScene.routeName}</span>
                <span className="text-teal-600">·</span>
                <span>{detailScene.seatDirection}侧</span>
              </div>
              <div className="flex items-center gap-2 text-mist-300">
                <Clock className="w-4 h-4 text-dusk-400" />
                <span>{formatTimestamp(detailScene.timestamp)}</span>
                <span className="text-teal-600">·</span>
                <span>{getTimeOfDay(detailScene.timestamp)}</span>
              </div>
              {detailScene.tripId && sceneTripMap.get(detailScene.tripId) && (
                <div className="flex items-center gap-1.5 rounded-lg bg-dusk-400/10 px-2.5 py-1.5 text-xs text-dusk-300">
                  <Route className="w-3.5 h-3.5" />
                  属于 {formatTripDate(sceneTripMap.get(detailScene.tripId)!.date)}{' '}
                  {formatTripTime(sceneTripMap.get(detailScene.tripId)!.start)} 趟次
                </div>
              )}
              <div className="flex items-center gap-3 text-mist-300">
                {getTreeIcon(detailScene.treeDensity)}
                <span>{detailScene.treeDensity}</span>
                {getPedestrianIcon(detailScene.pedestrianStatus)}
                <span>{detailScene.pedestrianStatus}</span>
              </div>
              {detailScene.signText && (
                <div className="rounded-lg bg-teal-800/50 px-3 py-2 text-mist-200">
                  招牌: {detailScene.signText}
                </div>
              )}
              {detailScene.note && (
                <div className="rounded-lg border border-teal-800 px-3 py-2 text-mist-300">
                  {detailScene.note}
                </div>
              )}
            </div>

            <button
              onClick={() => handleDelete(detailScene.id)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-red-900/40 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-900/60"
            >
              <Trash2 className="w-4 h-4" />
              删除此窗景
            </button>
          </div>
        </div>
      )}

      <BackfillDialog
        trip={backfillTarget}
        onClose={() => setBackfillTarget(null)}
        onSubmit={backfillTrip}
      />
    </div>
  )
}

function SceneTimelineItem({
  scene,
  trip,
  onClick,
}: {
  scene: WindowScene
  trip?: ScheduledTrip
  onClick: () => void
}) {
  return (
    <div className="relative flex gap-4">
      <div className="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full bg-dusk-400 ring-4 ring-teal-950" />
      <div className="w-20 shrink-0 pt-0.5 text-right">
        <p className="text-xs text-dusk-400">{formatTimestamp(scene.timestamp)}</p>
        <p className="mt-0.5 text-[10px] text-mist-500">{getTimeOfDay(scene.timestamp)}</p>
      </div>
      <button
        onClick={onClick}
        className="group flex-1 rounded-xl border border-teal-800 bg-teal-900/50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-dusk-400/40 hover:shadow-lg hover:shadow-dusk-400/10"
      >
        <div className="flex items-center gap-2 mb-2">
          {getWeatherIcon(scene.weather)}
          <span className="text-sm font-semibold text-mist-100">{scene.segment}</span>
          {trip && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-dusk-400/10 px-2 py-0.5 text-[10px] text-dusk-300">
              <Route className="w-3 h-3" />
              {formatTripTime(trip.start)} 趟
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mb-1.5 text-mist-400">
          <MapPin className="w-3 h-3" />
          <span className="text-xs">{scene.routeName}</span>
          <span className="mx-1 text-teal-700">·</span>
          <span className="text-xs">{scene.seatDirection}侧</span>
        </div>
        {scene.note && (
          <p className="text-xs text-mist-400 line-clamp-2">{scene.note}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          {getTreeIcon(scene.treeDensity)}
          {getPedestrianIcon(scene.pedestrianStatus)}
          {scene.signText && (
            <span className="rounded bg-teal-800/60 px-1.5 py-0.5 text-[10px] text-mist-300">
              {scene.signText}
            </span>
          )}
        </div>
      </button>
    </div>
  )
}

function MissedTimelineItem({
  trip,
  onBackfill,
}: {
  trip: ScheduledTrip
  onBackfill: () => void
}) {
  const backfilled = trip.status === 'backfilled'
  return (
    <div className="relative flex gap-4">
      <div
        className={`absolute -left-[21px] top-2 h-3 w-3 rounded-full ring-4 ring-teal-950 ${
          backfilled ? 'bg-teal-600' : 'bg-red-700'
        }`}
      />
      <div className="w-20 shrink-0 pt-1 text-right">
        <p className="text-xs text-mist-500">{formatTripDate(trip.date)}</p>
        <p className="mt-0.5 text-[10px] text-mist-600">
          {formatTripTime(trip.start)}–{formatTripTime(trip.end)}
        </p>
      </div>
      <div
        className={`flex-1 rounded-xl border border-dashed p-4 ${
          backfilled
            ? 'border-teal-700 bg-teal-900/30'
            : 'border-red-900/50 bg-red-950/15'
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          {backfilled ? (
            <ClipboardCheck className="w-4 h-4 text-teal-500" />
          ) : (
            <CircleSlash className="w-4 h-4 text-red-500" />
          )}
          <span
            className={`text-sm font-medium ${
              backfilled ? 'text-mist-300' : 'text-red-300'
            }`}
          >
            {backfilled ? '已补录的漏采' : '漏采一趟'}
          </span>
          <span className="ml-auto text-xs text-mist-500">
            <MapPin className="mr-1 inline w-3 h-3" />
            {trip.routeName}
          </span>
        </div>
        {backfilled ? (
          <p className="text-xs leading-relaxed text-mist-400">
            原因：{trip.reason}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-mist-500">这趟没有留下窗景</p>
            <button
              onClick={onBackfill}
              className="shrink-0 rounded-lg bg-red-900/30 px-2.5 py-1 text-xs text-red-200 hover:bg-red-900/50 transition"
            >
              补录原因
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
