import type { ObservationSchedule, TripRecord } from '@/types'

/** 与 Date.getDay() 一致：0 为周日 */
export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 漏采扫描最多往回看的天数，避免久未打开时一次生成过多记录 */
export const MAX_BACKFILL_DAYS = 62

/** 一趟车的具体窗口：日程落到某一天后的起止时刻 */
export interface TripWindow {
  key: string
  scheduleId: string
  routeName: string
  date: string
  startTime: string
  endTime: string
  startAt: Date
  endAt: Date
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 趟次的去重键：同一日程同一日期同一开始时间只生成一条记录 */
export function tripKeyOf(scheduleId: string, date: string, startTime: string): string {
  return `${scheduleId}|${date}|${startTime}`
}

export function tripKeyOfRecord(r: Pick<TripRecord, 'scheduleId' | 'date' | 'startTime'>): string {
  return tripKeyOf(r.scheduleId, r.date, r.startTime)
}

function atTime(day: Date, time: string): Date {
  const d = new Date(day)
  d.setHours(Math.floor(parseTimeToMinutes(time) / 60), parseTimeToMinutes(time) % 60, 0, 0)
  return d
}

/** 日程在某一天对应的趟次窗口；当天不在排班日内返回 null */
export function windowOnDate(schedule: ObservationSchedule, day: Date): TripWindow | null {
  if (!schedule.daysOfWeek.includes(day.getDay())) return null
  const date = toDateKey(day)
  return {
    key: tripKeyOf(schedule.id, date, schedule.startTime),
    scheduleId: schedule.id,
    routeName: schedule.routeName,
    date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    startAt: atTime(day, schedule.startTime),
    endAt: atTime(day, schedule.endTime),
  }
}

/** 从 now 起（含正在进行中的）接下来 count 趟 */
export function getUpcomingWindows(
  schedule: ObservationSchedule,
  now: Date,
  count: number,
): TripWindow[] {
  const result: TripWindow[] = []
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // 一周排班最多 7 天，14 天内一定能凑满 count 趟
  for (let i = 0; i < 14 && result.length < count; i++) {
    const w = windowOnDate(schedule, day)
    if (w && w.endAt > now) result.push(w)
    day.setDate(day.getDate() + 1)
  }
  return result
}

/**
 * 扫描一张日程，列出「已经结束且应留痕」的趟次窗口：
 * 只取日程最近修改之后才结束的窗口（改日程只影响还没发生的趟次），
 * 且最多回溯 MAX_BACKFILL_DAYS 天。
 */
export function listElapsedWindows(schedule: ObservationSchedule, now: Date): TripWindow[] {
  const updatedAt = new Date(schedule.updatedAt)
  const result: TripWindow[] = []
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (let i = 0; i < MAX_BACKFILL_DAYS; i++) {
    const w = windowOnDate(schedule, day)
    if (w && w.endAt < now && w.endAt >= updatedAt) result.push(w)
    day.setDate(day.getDate() - 1)
    // 再往前一天的窗口必然早于 updatedAt，不可能入选
    if (day.getTime() + 24 * 3600 * 1000 <= updatedAt.getTime()) break
  }
  return result
}

/** "2026-09-24" -> "9月24日 周四" */
export function formatTripDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const weekday = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]
  return `${m}月${d}日 周${weekday}`
}

/** [1,3,5] -> "周一、三、五"；七天全选 -> "每天" */
export function describeDays(days: number[]): string {
  if (days.length === 7) return '每天'
  const sorted = [...days].sort((a, b) => a - b)
  return sorted.map((d) => `周${WEEKDAY_LABELS[d]}`).join('、')
}
