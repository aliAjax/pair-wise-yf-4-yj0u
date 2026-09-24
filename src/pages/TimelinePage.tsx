import { useEffect, useState } from 'react'
import { Search, Route, X, Trash2, Clock, MapPin, EyeOff, CalendarCheck, PenLine } from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { useScheduleStore } from '@/store/useScheduleStore'
import {
  formatTimestamp,
  getTimeOfDay,
  getWeatherIcon,
  getTreeIcon,
  getPedestrianIcon,
} from '@/utils/sceneHelpers'
import { formatTripDate } from '@/utils/scheduleHelpers'
import type { TripRecord, WindowScene } from '@/types'

type TimelineItem =
  | { kind: 'scene'; sortAt: number; scene: WindowScene }
  | { kind: 'trip'; sortAt: number; trip: TripRecord }

export default function TimelinePage() {
  const { routeNames, selectedRoute, currentRouteScenes, selectRoute, loadAll, deleteScene } =
    useSceneStore()
  const { tripRecords, loadAll: loadSchedules, fillMissReason } = useScheduleStore()
  const [search, setSearch] = useState('')
  const [detailScene, setDetailScene] = useState<WindowScene | null>(null)
  const [backfillTrip, setBackfillTrip] = useState<TripRecord | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    loadAll()
    loadSchedules()
  }, [loadAll, loadSchedules])

  const filteredRoutes = routeNames.filter((r) =>
    r.toLowerCase().includes(search.toLowerCase())
  )

  const missedTrips = selectedRoute
    ? tripRecords.filter((r) => r.routeName === selectedRoute && r.status === 'missed')
    : []

  const items: TimelineItem[] = [
    ...currentRouteScenes.map((scene): TimelineItem => ({
      kind: 'scene',
      sortAt: new Date(scene.timestamp).getTime(),
      scene,
    })),
    ...missedTrips.map((trip): TimelineItem => ({
      kind: 'trip',
      sortAt: new Date(`${trip.date}T${trip.startTime}:00`).getTime(),
      trip,
    })),
  ].sort((a, b) => b.sortAt - a.sortAt)

  const tripOfScene = (scene: WindowScene) =>
    scene.tripId ? tripRecords.find((r) => r.id === scene.tripId) : undefined

  const handleDelete = (id: string) => {
    deleteScene(id)
    setDetailScene(null)
  }

  const openBackfill = (trip: TripRecord) => {
    setBackfillTrip(trip)
    setReason(trip.missReason)
  }

  const handleBackfillSave = () => {
    if (!backfillTrip || !reason.trim()) return
    fillMissReason(backfillTrip.id, reason)
    setBackfillTrip(null)
  }

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

        {items.length === 0 ? (
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
              {items.map((item) =>
                item.kind === 'scene' ? (
                  <SceneNode
                    key={item.scene.id}
                    scene={item.scene}
                    trip={tripOfScene(item.scene)}
                    onOpen={() => setDetailScene(item.scene)}
                  />
                ) : (
                  <TripNode key={item.trip.id} trip={item.trip} onOpen={() => openBackfill(item.trip)} />
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
              {tripOfScene(detailScene) && (
                <div className="flex items-center gap-2 text-mist-300">
                  <CalendarCheck className="w-4 h-4 text-dusk-400" />
                  <span>
                    {formatTripDate(tripOfScene(detailScene)!.date)}{' '}
                    {tripOfScene(detailScene)!.startTime}–{tripOfScene(detailScene)!.endTime} 趟
                  </span>
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

      {backfillTrip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setBackfillTrip(null)}
        >
          <div
            className="relative mx-4 w-full max-w-md animate-scale-in rounded-2xl border border-teal-700 bg-teal-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBackfillTrip(null)}
              className="absolute right-4 top-4 text-mist-400 hover:text-mist-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4 flex items-center gap-3">
              <EyeOff className="w-5 h-5 text-dusk-400" />
              <h2 className="text-xl font-bold text-dusk-400">漏采补录</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-mist-300">
                <MapPin className="w-4 h-4 text-dusk-400" />
                <span>{backfillTrip.routeName}</span>
              </div>
              <div className="flex items-center gap-2 text-mist-300">
                <Clock className="w-4 h-4 text-dusk-400" />
                <span>
                  {formatTripDate(backfillTrip.date)} · {backfillTrip.startTime}–{backfillTrip.endTime}
                </span>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="这趟为什么错过了？如：临时改了班次、下雨没出门…"
                className="w-full rounded-lg border border-teal-800 bg-teal-850 px-3 py-2 text-mist-100 placeholder:text-mist-500 outline-none focus:border-dusk-400 resize-none h-24"
              />
            </div>

            <button
              onClick={handleBackfillSave}
              disabled={!reason.trim()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-dusk-400 py-2.5 text-sm font-medium text-teal-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PenLine className="w-4 h-4" />
              {backfillTrip.missReason ? '更新原因' : '保存原因'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SceneNode({
  scene,
  trip,
  onOpen,
}: {
  scene: WindowScene
  trip: TripRecord | undefined
  onOpen: () => void
}) {
  return (
    <div className="relative flex gap-4">
      <div className="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full bg-dusk-400 ring-4 ring-teal-950" />
      <div className="w-20 shrink-0 pt-0.5 text-right">
        <p className="text-xs text-dusk-400">{formatTimestamp(scene.timestamp)}</p>
        <p className="mt-0.5 text-[10px] text-mist-500">{getTimeOfDay(scene.timestamp)}</p>
      </div>
      <button
        onClick={onOpen}
        className="group flex-1 rounded-xl border border-teal-800 bg-teal-900/50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-dusk-400/40 hover:shadow-lg hover:shadow-dusk-400/10"
      >
        <div className="flex items-center gap-2 mb-2">
          {getWeatherIcon(scene.weather)}
          <span className="text-sm font-semibold text-mist-100">{scene.segment}</span>
          {trip && (
            <span className="inline-flex items-center gap-1 rounded bg-dusk-400/15 px-1.5 py-0.5 text-[10px] text-dusk-300">
              <CalendarCheck className="w-3 h-3" />
              {trip.startTime} 趟
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

function TripNode({ trip, onOpen }: { trip: TripRecord; onOpen: () => void }) {
  const pending = !trip.missReason
  return (
    <div className="relative flex gap-4">
      <div className="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full bg-teal-700 ring-4 ring-teal-950" />
      <div className="w-20 shrink-0 pt-0.5 text-right">
        <p className="text-xs text-mist-500">{formatTripDate(trip.date)}</p>
        <p className="mt-0.5 text-[10px] text-mist-500">
          {trip.startTime}–{trip.endTime}
        </p>
      </div>
      <button
        onClick={onOpen}
        className="flex-1 rounded-xl border border-dashed border-teal-700 bg-teal-900/30 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-dusk-400/40"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <EyeOff className="w-4 h-4 text-mist-500" />
          <span className="text-sm font-semibold text-mist-300">漏采</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] ${
              pending ? 'bg-dusk-400/15 text-dusk-300' : 'bg-teal-800/60 text-mist-400'
            }`}
          >
            {pending ? '待补录 · 点击填写原因' : '已补录'}
          </span>
        </div>
        {trip.missReason && (
          <p className="text-xs text-mist-400 line-clamp-2">{trip.missReason}</p>
        )}
      </button>
    </div>
  )
}
