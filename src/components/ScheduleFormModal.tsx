import { useEffect, useState } from 'react'
import { X, Plus, Trash2, CalendarClock, Bus } from 'lucide-react'
import type { RouteSchedule, TimeWindow, WeekdayNumber } from '@/types'
import { validateSchedule, WEEKDAY_LABELS } from '@/services/schedule'

const ALL_WEEKDAYS: WeekdayNumber[] = [1, 2, 3, 4, 5, 6, 7]

interface Props {
  /** 编辑时传现有日程，新建时传 null */
  schedule: RouteSchedule | null
  /** 已被其它日程占用的线路名（避免同一条线路重复建日程） */
  existingRouteNames: string[]
  onClose: () => void
  onSubmit: (schedule: RouteSchedule) => void
}

export default function ScheduleFormModal({
  schedule,
  existingRouteNames,
  onClose,
  onSubmit,
}: Props) {
  const [routeName, setRouteName] = useState('')
  const [weekdays, setWeekdays] = useState<WeekdayNumber[]>([])
  const [windows, setWindows] = useState<TimeWindow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (schedule) {
      setRouteName(schedule.routeName)
      setWeekdays([...schedule.weekdays])
      setWindows(schedule.windows.map((w) => ({ ...w })))
    } else {
      setRouteName('')
      setWeekdays([1, 2, 3, 4, 5])
      setWindows([{ id: crypto.randomUUID(), start: '07:30', end: '09:00', label: '' }])
    }
    setError(null)
  }, [schedule])

  const toggleWeekday = (d: WeekdayNumber) => {
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  const updateWindow = (id: string, patch: Partial<TimeWindow>) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }

  const addWindow = () => {
    setWindows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), start: '17:30', end: '19:00', label: '' },
    ])
  }

  const removeWindow = (id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const dup = existingRouteNames
      .filter((name) => name !== schedule?.routeName)
      .some((name) => name === routeName.trim())
    if (dup) {
      setError(`线路「${routeName.trim()}」已经有日程了，请直接编辑原日程`)
      return
    }
    const validationError = validateSchedule({ routeName, weekdays, windows })
    if (validationError) {
      setError(validationError)
      return
    }
    const now = new Date().toISOString()
    onSubmit({
      id: schedule?.id ?? crypto.randomUUID(),
      routeName: routeName.trim(),
      weekdays: [...weekdays].sort((a, b) => a - b),
      windows: windows
        .map((w) => ({ ...w, label: w.label?.trim() ?? '' }))
        .sort((a, b) => a.start.localeCompare(b.start)),
      createdAt: schedule?.createdAt ?? now,
      updatedAt: now,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in rounded-2xl border border-teal-700 bg-teal-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-mist-400 hover:text-mist-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dusk-400/15 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-dusk-400" />
          </div>
          <h2 className="text-xl font-serif font-bold text-dusk-400">
            {schedule ? '编辑观察日程' : '新建观察日程'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
              <Bus className="w-3 h-3" />线路
            </label>
            <input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="如 300 路"
              className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
              required
            />
          </div>

          <div>
            <label className="text-mist-300 text-xs mb-2 block">每周观察哪几天</label>
            <div className="flex flex-wrap gap-2">
              {ALL_WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  className={`min-w-11 px-2 py-2 rounded-xl text-xs transition ${
                    weekdays.includes(d)
                      ? 'bg-dusk-400/20 text-dusk-400 border border-dusk-400'
                      : 'bg-teal-850 text-mist-300 border border-transparent hover:text-mist-100'
                  }`}
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2 text-[11px]">
              {([
                ['每天', [1, 2, 3, 4, 5, 6, 7]],
                ['工作日', [1, 2, 3, 4, 5]],
                ['周末', [6, 7]],
              ] as const).map(([label, days]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setWeekdays([...days])}
                  className="px-2 py-0.5 rounded-full bg-teal-850 text-mist-400 hover:text-dusk-400 transition"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-mist-300 text-xs">车行时段</label>
              <button
                type="button"
                onClick={addWindow}
                className="flex items-center gap-1 text-xs text-dusk-400 hover:text-dusk-300 transition"
              >
                <Plus className="w-3.5 h-3.5" />加一个时段
              </button>
            </div>
            <div className="space-y-2">
              {windows.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 bg-teal-850/70 rounded-xl p-2.5"
                >
                  <input
                    type="time"
                    value={w.start}
                    onChange={(e) => updateWindow(w.id, { start: e.target.value })}
                    className="bg-teal-950 text-mist-100 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-dusk-400 [color-scheme:dark]"
                  />
                  <span className="text-mist-500 text-xs">至</span>
                  <input
                    type="time"
                    value={w.end}
                    onChange={(e) => updateWindow(w.id, { end: e.target.value })}
                    className="bg-teal-950 text-mist-100 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-dusk-400 [color-scheme:dark]"
                  />
                  <input
                    value={w.label ?? ''}
                    onChange={(e) => updateWindow(w.id, { label: e.target.value })}
                    placeholder="备注（早班）"
                    className="flex-1 min-w-0 bg-transparent text-mist-300 text-xs outline-none placeholder:text-mist-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeWindow(w.id)}
                    disabled={windows.length <= 1}
                    className="text-mist-500 hover:text-red-400 transition disabled:opacity-30 disabled:hover:text-mist-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-mist-500">
              时段需在当天内，暂不支持跨天；修改日程只影响还没发生的趟次
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-dusk-400 text-teal-950 font-medium text-sm transition"
          >
            {schedule ? '保存修改' : '创建日程'}
          </button>
        </form>
      </div>
    </div>
  )
}
