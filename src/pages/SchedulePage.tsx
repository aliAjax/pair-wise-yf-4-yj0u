import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  Bus,
  CalendarDays,
  ClipboardCheck,
  CircleSlash,
  CheckCircle2,
} from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import type { RouteSchedule, ScheduledTrip } from '@/types'
import { formatWeekdays } from '@/services/schedule'
import {
  formatTripDate,
  formatTripTime,
  getTripTiming,
  TRIP_TIMING_LABEL,
} from '@/utils/scheduleHelpers'
import ScheduleFormModal from '@/components/ScheduleFormModal'
import BackfillDialog from '@/components/BackfillDialog'

export default function SchedulePage() {
  const {
    schedules,
    trips,
    loadAll,
    saveRouteSchedule,
    removeSchedule,
    backfillTrip,
  } = useSceneStore()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RouteSchedule | null>(null)
  const [backfillTarget, setBackfillTarget] = useState<ScheduledTrip | null>(null)
  const now = new Date()

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const tripsBySchedule = useMemo(() => {
    const map = new Map<string, ScheduledTrip[]>()
    for (const t of trips) {
      const list = map.get(t.scheduleId) ?? []
      list.push(t)
      map.set(t.scheduleId, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    }
    return map
  }, [trips])

  const handleDelete = (schedule: RouteSchedule) => {
    if (
      window.confirm(
        `删除「${schedule.routeName}」的日程？\n未发生的趟次会一并移除，已采到和待补的记录会保留。`
      )
    ) {
      removeSchedule(schedule.id)
    }
  }

  return (
    <div className="min-h-screen bg-teal-950 font-sans text-mist-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-serif font-bold text-dusk-400">
            <CalendarClock className="w-7 h-7" />
            观察日程
          </h1>
          <button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-xl bg-dusk-400 px-3.5 py-2 text-sm font-medium text-teal-950 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            新建日程
          </button>
        </div>

        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-mist-400">
            <div className="mb-4 w-16 h-16 rounded-2xl bg-dusk-400/10 flex items-center justify-center">
              <CalendarDays className="w-8 h-8 text-dusk-400/60" />
            </div>
            <p className="font-serif text-lg mb-1">还没有观察日程</p>
            <p className="text-xs text-mist-500">
              为常坐的线路定好每周哪几天、哪个车行时段，记录页会提示接下来的趟次
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {schedules.map((schedule) => {
              const scheduleTrips = tripsBySchedule.get(schedule.id) ?? []
              const upcoming = scheduleTrips
                .filter((t) => new Date(t.endsAt) > now && t.status === 'upcoming')
                .slice(0, 3)
              const pendingMissed = scheduleTrips.filter((t) => t.status === 'missed')
              const resolvedCount = scheduleTrips.filter(
                (t) => t.status === 'collected' || t.status === 'backfilled'
              ).length

              return (
                <section
                  key={schedule.id}
                  className="rounded-2xl border border-teal-800 bg-teal-900/50 p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h2 className="flex items-center gap-2 font-serif text-lg text-mist-100">
                        <Bus className="w-4.5 h-4.5 text-dusk-400" />
                        {schedule.routeName}
                      </h2>
                      <p className="mt-1 text-xs text-mist-400">
                        每周 {formatWeekdays(schedule.weekdays)}
                        <span className="mx-1.5 text-teal-700">·</span>
                        {schedule.windows
                          .map(
                            (w) =>
                              `${formatTripTime(w.start)}–${formatTripTime(w.end)}${
                                w.label ? `（${w.label}）` : ''
                              }`
                          )
                          .join('，')}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditing(schedule)
                          setFormOpen(true)
                        }}
                        className="p-2 rounded-lg text-mist-400 hover:text-dusk-400 hover:bg-white/5 transition"
                        title="编辑日程"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(schedule)}
                        className="p-2 rounded-lg text-mist-400 hover:text-red-400 hover:bg-white/5 transition"
                        title="删除日程"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {pendingMissed.length > 0 && (
                    <div className="mb-3 rounded-xl border border-red-900/40 bg-red-950/20 p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-red-300">
                        <CircleSlash className="w-3.5 h-3.5" />
                        {pendingMissed.length} 趟待补录
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pendingMissed.slice(0, 5).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setBackfillTarget(t)}
                            className="flex items-center gap-1.5 rounded-lg bg-red-900/30 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-900/50 transition"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            {formatTripDate(t.date)} {formatTripTime(t.start)}
                          </button>
                        ))}
                        {pendingMissed.length > 5 && (
                          <span className="px-1 py-1.5 text-xs text-mist-500">
                            等 {pendingMissed.length} 趟
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wider text-mist-500">
                      接下来的趟次
                    </p>
                    {upcoming.length === 0 ? (
                      <p className="text-xs text-mist-500 py-1">近两周没有排到趟次</p>
                    ) : (
                      upcoming.map((t) => {
                        const timing = getTripTiming(t, now)
                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between rounded-lg bg-teal-850/60 px-3 py-2 text-sm"
                          >
                            <span className="text-mist-200">
                              {formatTripDate(t.date)}
                              <span className="mx-2 text-teal-700">·</span>
                              {formatTripTime(t.start)}–{formatTripTime(t.end)}
                            </span>
                            {timing !== 'later' && (
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full ${
                                  timing === 'ongoing'
                                    ? 'bg-dusk-400/20 text-dusk-300'
                                    : 'bg-teal-800 text-mist-400'
                                }`}
                              >
                                {TRIP_TIMING_LABEL[timing]}
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {resolvedCount > 0 && (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-mist-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      已完成 {resolvedCount} 趟（已采 / 已补录）
                    </p>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>

      {formOpen && (
        <ScheduleFormModal
          schedule={editing}
          existingRouteNames={schedules.map((s) => s.routeName)}
          onClose={() => setFormOpen(false)}
          onSubmit={(data) => {
            saveRouteSchedule(data)
            setFormOpen(false)
          }}
        />
      )}

      <BackfillDialog
        trip={backfillTarget}
        onClose={() => setBackfillTarget(null)}
        onSubmit={backfillTrip}
      />
    </div>
  )
}
