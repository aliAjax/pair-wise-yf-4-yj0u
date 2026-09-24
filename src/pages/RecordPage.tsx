import { useState, useEffect, useMemo } from 'react'
import {
  Bus,
  MapPin,
  Armchair,
  Clock,
  CloudSun,
  Signpost,
  TreePine,
  Users,
  FileText,
  Send,
  CircleSlash,
  Check,
  X,
  Link2,
  ChevronRight,
} from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { getWeatherIcon, getTreeIcon, getPedestrianIcon, formatTimestamp } from '@/utils/sceneHelpers'
import {
  formatTripDate,
  formatTripTime,
  getTripTiming,
  TRIP_TIMING_LABEL,
  formatCountdown,
} from '@/utils/scheduleHelpers'
import type { SceneFormData, Weather, TreeDensity, PedestrianStatus, SeatDirection, ScheduledTrip } from '@/types'
import BackfillDialog from '@/components/BackfillDialog'

const WEATHERS: Weather[] = ['晴', '多云', '阴', '小雨', '大雨', '雪', '雾']
const TREES: TreeDensity[] = ['稀疏', '适中', '茂密']
const PEDESTRIANS: PedestrianStatus[] = ['稀少', '零星', '密集']

const initialForm: SceneFormData = {
  routeName: '',
  segment: '',
  seatDirection: '左',
  weather: '晴',
  signText: '',
  treeDensity: '适中',
  pedestrianStatus: '稀少',
  note: '',
}

export default function RecordPage() {
  const { saveScene, loadAll, trips, backfillTrip } = useSceneStore()
  const [form, setForm] = useState<SceneFormData>(initialForm)
  const [now, setNow] = useState(new Date())
  const [showSuccess, setShowSuccess] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<ScheduledTrip | null>(null)
  const [backfillTarget, setBackfillTarget] = useState<ScheduledTrip | null>(null)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  // 接下来三趟：进行中优先，其余按开始时间
  const upcomingTrips = useMemo(() => {
    return trips
      .filter((t) => new Date(t.endsAt) > now && t.status === 'upcoming')
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 3)
  }, [trips, now])

  // 待补漏采，最多展示 3 条
  const missedTrips = useMemo(() => {
    return trips
      .filter((t) => t.status === 'missed' && new Date(t.endsAt) <= now)
      .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
      .slice(0, 3)
  }, [trips, now])

  const update = <K extends keyof SceneFormData>(key: K, val: SceneFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const pickTrip = (trip: ScheduledTrip) => {
    setSelectedTrip(trip)
    setForm((prev) => ({ ...prev, routeName: trip.routeName }))
  }

  const clearSelectedTrip = () => {
    setSelectedTrip(null)
    setForm((prev) => ({ ...prev, routeName: '' }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveScene(form, selectedTrip?.id)
    setShowSuccess(true)
    setSelectedTrip(null)
    setTimeout(() => {
      setShowSuccess(false)
      setForm(initialForm)
    }, 1500)
  }

  return (
    <div className="relative min-h-screen bg-teal-950 p-4 pb-24">
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="animate-bounce flex flex-col items-center gap-2 opacity-0" style={{ animation: 'fadeInUp 1.5s ease forwards' }}>
            <Bus className="w-16 h-16 text-dusk-400" />
            <span className="text-mist-100 font-serif text-lg">记录已保存</span>
          </div>
          <style>{`@keyframes fadeInUp { 0% { opacity:0; transform:translateY(20px) } 40% { opacity:1; transform:translateY(0) } 100% { opacity:0; transform:translateY(-40px) } }`}</style>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Bus className="w-6 h-6 text-dusk-400" />
          <h1 className="text-mist-100 font-serif text-2xl">窗景记录</h1>
        </div>

        {/* 接下来三趟 */}
        {upcomingTrips.length > 0 && (
          <section className="rounded-2xl border border-dusk-400/25 bg-dusk-400/5 p-4">
            <h2 className="flex items-center gap-2 mb-3 text-dusk-300 font-serif text-base">
              <Clock className="w-4 h-4" />
              接下来的趟次
              <span className="text-[11px] text-mist-500 font-sans font-normal">点选后本次记录自动挂到这一趟</span>
            </h2>
            <div className="space-y-2">
              {upcomingTrips.map((trip) => {
                const timing = getTripTiming(trip, now)
                const active = selectedTrip?.id === trip.id
                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => (active ? clearSelectedTrip() : pickTrip(trip))}
                    className={`group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? 'bg-dusk-400/25 border border-dusk-400'
                        : 'bg-teal-850/70 border border-transparent hover:border-dusk-400/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Bus className={`w-4 h-4 shrink-0 ${active ? 'text-dusk-300' : 'text-dusk-400/70'}`} />
                      <div className="min-w-0">
                        <p className={`truncate ${active ? 'text-dusk-300' : 'text-mist-100'}`}>
                          {trip.routeName}
                          <span className="mx-1.5 text-teal-700">·</span>
                          {formatTripDate(trip.date)}
                          <span className="mx-1.5 text-teal-700">·</span>
                          {formatTripTime(trip.start)}–{formatTripTime(trip.end)}
                        </p>
                        {timing !== 'later' && (
                          <p className="text-[11px] text-mist-500">
                            {timing === 'ongoing' ? '正在车行中，现在就记' : formatCountdown(trip, now)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {timing !== 'later' && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            timing === 'ongoing'
                              ? 'bg-dusk-400 text-teal-950 font-medium'
                              : 'bg-teal-800 text-mist-400'
                          }`}
                        >
                          {TRIP_TIMING_LABEL[timing]}
                        </span>
                      )}
                      {active ? (
                        <Check className="w-4 h-4 text-dusk-300" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-mist-500 group-hover:text-dusk-400 transition" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            {selectedTrip && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-dusk-300/80">
                <Link2 className="w-3 h-3" />
                本次窗景将归属 {selectedTrip.routeName} · {formatTripDate(selectedTrip.date)} {formatTripTime(selectedTrip.start)} 的趟次
                <button type="button" onClick={clearSelectedTrip} className="ml-auto text-mist-500 hover:text-mist-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </p>
            )}
          </section>
        )}

        {/* 待补漏采 */}
        {missedTrips.length > 0 && (
          <section className="rounded-2xl border border-red-900/40 bg-red-950/15 p-4">
            <h2 className="flex items-center gap-2 mb-3 text-red-300 font-serif text-base">
              <CircleSlash className="w-4 h-4" />
              漏掉的趟次
              <span className="text-[11px] text-mist-500 font-sans font-normal">事后补录原因，时间线不再留空</span>
            </h2>
            <div className="space-y-2">
              {missedTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-teal-850/70 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-mist-200">
                      {trip.routeName}
                      <span className="mx-1.5 text-teal-700">·</span>
                      {formatTripDate(trip.date)}
                      <span className="mx-1.5 text-teal-700">·</span>
                      {formatTripTime(trip.start)}–{formatTripTime(trip.end)}
                    </p>
                    <p className="text-[11px] text-mist-500">未采到窗景</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBackfillTarget(trip)}
                    className="shrink-0 rounded-lg bg-red-900/30 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-900/50 transition"
                  >
                    补录
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-dusk-400 font-serif text-lg flex items-center gap-2">
            <MapPin className="w-4 h-4" />路线信息
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><Bus className="w-3 h-3" />线路</label>
              <input className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400" value={form.routeName} onChange={(e) => update('routeName', e.target.value)} required />
            </div>
            <div>
              <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />区间</label>
              <input className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400" value={form.segment} onChange={(e) => update('segment', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><Armchair className="w-3 h-3" />座位方向</label>
            <div className="flex gap-2">
              {(['左', '右'] as SeatDirection[]).map((d) => (
                <button key={d} type="button" onClick={() => update('seatDirection', d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${form.seatDirection === d ? 'bg-dusk-400/20 text-dusk-400 border border-dusk-400' : 'bg-teal-850 text-mist-300 border border-transparent'}`}>
                  {d}侧
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-dusk-400 font-serif text-lg flex items-center gap-2">
            <CloudSun className="w-4 h-4" />窗景信息
          </h2>
          <div>
            <label className="text-mist-300 text-xs mb-1 block">天气</label>
            <div className="grid grid-cols-4 gap-2">
              {WEATHERS.map((w) => (
                <button key={w} type="button" onClick={() => update('weather', w)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs transition ${form.weather === w ? 'bg-dusk-400/20 border border-dusk-400 text-dusk-400' : 'bg-teal-850 border border-transparent text-mist-300'}`}>
                  {getWeatherIcon(w)}{w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><Signpost className="w-3 h-3" />招牌文字</label>
            <input className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400" value={form.signText} onChange={(e) => update('signText', e.target.value)} />
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><TreePine className="w-3 h-3" />树木密度</label>
            <div className="grid grid-cols-3 gap-2">
              {TREES.map((t) => (
                <button key={t} type="button" onClick={() => update('treeDensity', t)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs transition ${form.treeDensity === t ? 'bg-dusk-400/20 border border-dusk-400 text-dusk-400' : 'bg-teal-850 border border-transparent text-mist-300'}`}>
                  {getTreeIcon(t)}{t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><Users className="w-3 h-3" />行人状态</label>
            <div className="grid grid-cols-3 gap-2">
              {PEDESTRIANS.map((p) => (
                <button key={p} type="button" onClick={() => update('pedestrianStatus', p)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs transition ${form.pedestrianStatus === p ? 'bg-dusk-400/20 border border-dusk-400 text-dusk-400' : 'bg-teal-850 border border-transparent text-mist-300'}`}>
                  {getPedestrianIcon(p)}{p}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-dusk-400 font-serif text-lg flex items-center gap-2">
            <FileText className="w-4 h-4" />观察笔记
          </h2>
          <textarea className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400 resize-none h-24" value={form.note} onChange={(e) => update('note', e.target.value)} />
        </section>

        <div className="flex items-center gap-2 text-mist-400 text-xs">
          <Clock className="w-3 h-3" />
          <span>{formatTimestamp(now.toISOString())}</span>
          {!selectedTrip && form.routeName && (
            <span className="ml-auto text-mist-500">未选趟次，将按当前时间尝试自动匹配</span>
          )}
        </div>

        <button type="submit"
          className="w-full py-3 rounded-xl bg-dusk-400 text-teal-950 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition">
          <Send className="w-4 h-4" />保存记录
        </button>
      </form>

      <BackfillDialog
        trip={backfillTarget}
        onClose={() => setBackfillTarget(null)}
        onSubmit={backfillTrip}
      />
    </div>
  )
}
