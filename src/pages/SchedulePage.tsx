import { useEffect, useState } from 'react'
import { CalendarDays, Clock, Bus, Pencil, Trash2, X, CircleAlert, Check } from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { useScheduleStore } from '@/store/useScheduleStore'
import { WEEKDAY_LABELS, describeDays } from '@/utils/scheduleHelpers'
import type { ScheduleFormData } from '@/types'

// 按周一到周日展示，值为 Date.getDay()
const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0] as const

const initialForm: ScheduleFormData = {
  routeName: '',
  daysOfWeek: [],
  startTime: '08:00',
  endTime: '09:00',
}

export default function SchedulePage() {
  const routeNames = useSceneStore((s) => s.routeNames)
  const loadScenes = useSceneStore((s) => s.loadAll)
  const { schedules, tripRecords, loadAll, saveSchedule, removeSchedule } = useScheduleStore()

  const [form, setForm] = useState<ScheduleFormData>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadScenes()
    loadAll()
  }, [loadScenes, loadAll])

  const toggleDay = (day: number) =>
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = saveSchedule(form, editingId ?? undefined)
    setError(err)
    if (!err) {
      setForm(initialForm)
      setEditingId(null)
    }
  }

  const startEdit = (id: string) => {
    const s = schedules.find((item) => item.id === id)
    if (!s) return
    setForm({
      routeName: s.routeName,
      daysOfWeek: s.daysOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    })
    setEditingId(id)
    setError(null)
  }

  const cancelEdit = () => {
    setForm(initialForm)
    setEditingId(null)
    setError(null)
  }

  const pendingCount = (routeName: string) =>
    tripRecords.filter((r) => r.routeName === routeName && r.status === 'missed' && !r.missReason).length

  return (
    <div className="min-h-screen bg-teal-950 p-4 pb-24">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="w-6 h-6 text-dusk-400" />
          <h1 className="text-mist-100 font-serif text-2xl">观察日程</h1>
        </div>
        <p className="text-mist-400 text-xs leading-relaxed -mt-3">
          为线路排定每周观察时段，记录页会提示接下来三趟，错过的时段会留成漏采
        </p>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-teal-800 bg-teal-900/50 p-4 space-y-4">
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
              <Bus className="w-3 h-3" />线路
            </label>
            <input
              list="schedule-route-names"
              className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
              value={form.routeName}
              onChange={(e) => setForm((prev) => ({ ...prev, routeName: e.target.value }))}
              placeholder="如：47路"
              required
            />
            <datalist id="schedule-route-names">
              {routeNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-mist-300 text-xs mb-1 block">每周哪几天</label>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_OPTIONS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`py-2 rounded-xl text-xs transition ${
                    form.daysOfWeek.includes(day)
                      ? 'bg-dusk-400/20 text-dusk-400 border border-dusk-400'
                      : 'bg-teal-850 text-mist-300 border border-transparent'
                  }`}
                >
                  {WEEKDAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />车行时段
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                className="flex-1 bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
                value={form.startTime}
                onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                required
              />
              <span className="text-mist-500 text-sm">至</span>
              <input
                type="time"
                className="flex-1 bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
                value={form.endTime}
                onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                required
              />
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-300">
              <CircleAlert className="w-3.5 h-3.5" />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-dusk-400 text-teal-950 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Check className="w-4 h-4" />
              {editingId ? '保存修改' : '保存日程'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2.5 rounded-xl bg-teal-850 text-mist-300 text-sm flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />取消
              </button>
            )}
          </div>
          {editingId && (
            <p className="text-mist-500 text-[11px] leading-relaxed">
              修改只影响还没发生的趟次，已采到和待补录的记录保持原样
            </p>
          )}
        </form>

        <section className="space-y-3">
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-mist-400">
              <div className="mb-3 text-5xl opacity-30">🗓️</div>
              <p className="text-sm">还没有观察日程，先为一条线路排一张吧</p>
            </div>
          ) : (
            [...schedules]
              .sort((a, b) => a.routeName.localeCompare(b.routeName))
              .map((s) => {
                const pending = pendingCount(s.routeName)
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-teal-800 bg-teal-900/50 p-4 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Bus className="w-4 h-4 text-dusk-400" />
                        <span className="text-mist-100 font-medium">{s.routeName}</span>
                        {pending > 0 && (
                          <span className="rounded-full bg-dusk-400/15 px-2 py-0.5 text-[10px] text-dusk-300">
                            {pending} 趟待补录
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-mist-400">
                        {describeDays(s.daysOfWeek)} · {s.startTime}–{s.endTime}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => startEdit(s.id)}
                        className="p-2 rounded-lg bg-teal-850 text-mist-300 hover:text-dusk-300 transition-colors"
                        aria-label="编辑日程"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeSchedule(s.id)}
                        className="p-2 rounded-lg bg-teal-850 text-mist-300 hover:text-red-300 transition-colors"
                        aria-label="删除日程"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })
          )}
        </section>
      </div>
    </div>
  )
}
