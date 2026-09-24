import type { RouteSchedule, ScheduledTrip, TimeWindow, WeekdayNumber } from '@/types'

const SCHEDULE_KEY = 'bus_route_schedules'
const TRIP_KEY = 'bus_scheduled_trips'
/** 未来趟次生成窗口（天） */
const GENERATE_HORIZON_DAYS = 14

/* ---------------- localStorage 基础读写 ---------------- */

export function getAllSchedules(): RouteSchedule[] {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as RouteSchedule[]
    return list.map(normalizeSchedule)
  } catch {
    return []
  }
}

export function getScheduleByRoute(routeName: string): RouteSchedule | undefined {
  return getAllSchedules().find((s) => s.routeName === routeName)
}

function writeSchedules(schedules: RouteSchedule[]): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules))
}

export function getAllTrips(): ScheduledTrip[] {
  try {
    const raw = localStorage.getItem(TRIP_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ScheduledTrip[]
  } catch {
    return []
  }
}

function writeTrips(trips: ScheduledTrip[]): void {
  localStorage.setItem(TRIP_KEY, JSON.stringify(trips))
}

/* ---------------- 日期工具 ---------------- */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dayOfWeek(d: Date): WeekdayNumber {
  // getDay: 0=周日 … 6=周六 → 我们用 1=周一 … 7=周日
  return ((d.getDay() + 6) % 7 + 1) as WeekdayNumber
}

export function combineDateTime(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

export const WEEKDAY_LABELS: Record<WeekdayNumber, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
}

export const WEEKDAY_SHORT_LABELS: Record<WeekdayNumber, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '日',
}

export function formatWeekdays(weekdays: WeekdayNumber[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b)
  if (sorted.length === 7) return '每天'
  if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d) => sorted.includes(d as WeekdayNumber))) {
    return '工作日'
  }
  if (sorted.length === 2 && sorted.includes(6) && sorted.includes(7)) return '周末'
  return sorted.map((d) => WEEKDAY_SHORT_LABELS[d]).join('·')
}

/* ---------------- 确定性趟次 ID（同一时段不会重复生成） ---------------- */

export function tripId(scheduleId: string, dateKey: string, windowId: string): string {
  return `${scheduleId}__${dateKey}__${windowId}`
}

/* ---------------- 日程 CRUD ---------------- */

function normalizeSchedule(raw: Partial<RouteSchedule>): RouteSchedule {
  return {
    id: raw.id ?? crypto.randomUUID(),
    routeName: raw.routeName ?? '',
    weekdays: (raw.weekdays ?? []).filter((d): d is WeekdayNumber => d >= 1 && d <= 7),
    windows: (raw.windows ?? []).map((w) => ({
      id: w.id ?? crypto.randomUUID(),
      start: w.start,
      end: w.end,
      label: w.label ?? '',
    })),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
  }
}

export function validateSchedule(schedule: {
  routeName: string
  weekdays: WeekdayNumber[]
  windows: Pick<TimeWindow, 'start' | 'end'>[]
}): string | null {
  if (!schedule.routeName.trim()) return '请填写线路名'
  if (schedule.weekdays.length === 0) return '至少选择一天'
  if (schedule.windows.length === 0) return '至少添加一个车行时段'
  for (const w of schedule.windows) {
    if (!w.start || !w.end) return '请补全时段时间'
    if (w.end <= w.start) return '时段结束时间必须晚于开始时间（暂不支持跨天）'
  }
  return null
}

/** 保存日程并同步趟次。已发生的趟次（已采/漏采/已补录）保持原样。 */
export function saveSchedule(schedule: RouteSchedule): void {
  const schedules = getAllSchedules()
  const idx = schedules.findIndex((s) => s.id === schedule.id)
  const updated: RouteSchedule = {
    ...schedule,
    routeName: schedule.routeName.trim(),
    updatedAt: new Date().toISOString(),
  }
  if (idx >= 0) schedules[idx] = updated
  else schedules.push(updated)
  writeSchedules(schedules)
  syncTripsForSchedule(updated)
}

export function deleteSchedule(id: string): void {
  writeSchedules(getAllSchedules().filter((s) => s.id !== id))
  // 只删除还没开始的趟次；已采到/待补的记录原样保留
  const now = new Date()
  const trips = getAllTrips().filter(
    (t) => !(t.scheduleId === id && new Date(t.startsAt) > now)
  )
  writeTrips(trips)
}

/* ---------------- 趟次同步 ---------------- */

function buildOccurrence(
  schedule: RouteSchedule,
  date: Date,
  window: TimeWindow
): ScheduledTrip | null {
  const dateKey = dateToKey(date)
  const startAt = combineDateTime(dateKey, window.start)
  const endAt = combineDateTime(dateKey, window.end)
  // 只生成在日程创建之后结束的趟次，避免为旧日期凭空造趟次
  if (endAt.getTime() <= new Date(schedule.createdAt).getTime()) return null
  return {
    id: tripId(schedule.id, dateKey, window.id),
    scheduleId: schedule.id,
    routeName: schedule.routeName,
    date: dateKey,
    start: window.start,
    end: window.end,
    startsAt: startAt.toISOString(),
    endsAt: endAt.toISOString(),
    status: 'upcoming',
    sceneIds: [],
  }
}

/**
 * 按日程生成未来趟次，并把过期未采的趟次标记为漏采。
 * 确定性 ID 保证同一时段不会重复生成。
 */
export function syncTripsForSchedule(schedule: RouteSchedule, now: Date = new Date()): ScheduledTrip[] {
  let trips = getAllTrips()
  const byId = new Map(trips.map((t) => [t.id, t]))

  // 1. 删掉这条日程「还没开始」的旧趟次——改日程只影响还没发生的
  trips = trips.filter(
    (t) => !(t.scheduleId === schedule.id && new Date(t.startsAt) > now)
  )
  byId.clear()
  trips.forEach((t) => byId.set(t.id, t))

  // 2. 按新日程展开 [今天, 今天+HORIZON] 的趟次
  for (let offset = 0; offset <= GENERATE_HORIZON_DAYS; offset++) {
    const date = new Date(now)
    date.setDate(now.getDate() + offset)
    if (!schedule.weekdays.includes(dayOfWeek(date))) continue
    for (const window of schedule.windows) {
      const occurrence = buildOccurrence(schedule, date, window)
      if (!occurrence) continue
      const existing = byId.get(occurrence.id)
      if (existing) {
        // 已结束但在第 1 步被保留的趟次，字段按最新日程刷新（路线改名等）
        if (
          existing.status === 'upcoming' &&
          new Date(existing.endsAt) <= now &&
          existing.sceneIds.length === 0
        ) {
          existing.status = 'missed'
        }
        continue
      }
      byId.set(occurrence.id, occurrence)
    }
  }

  // 3. 该日程所有已过结束时间且没采到的 upcoming 趟次 → 漏采
  for (const trip of byId.values()) {
    if (
      trip.scheduleId === schedule.id &&
      trip.status === 'upcoming' &&
      new Date(trip.endsAt) <= now &&
      trip.sceneIds.length === 0
    ) {
      trip.status = 'missed'
    }
  }

  trips = Array.from(byId.values())
  writeTrips(trips)
  return trips
}

/** 全量同步：刷新所有日程的趟次（页面加载时调用） */
export function syncAllTrips(now: Date = new Date()): ScheduledTrip[] {
  for (const schedule of getAllSchedules()) {
    syncTripsForSchedule(schedule, now)
  }
  // 日程被删除后遗留的 upcoming 趟次没有存在意义，一并清理
  const scheduleIds = new Set(getAllSchedules().map((s) => s.id))
  const trips = getAllTrips().filter(
    (t) => scheduleIds.has(t.scheduleId) || t.status !== 'upcoming'
  )
  writeTrips(trips)
  return trips
}

/* ---------------- 趟次状态流转 ---------------- */

export function attachSceneToTrip(tripIdValue: string, sceneId: string): void {
  const trips = getAllTrips()
  const trip = trips.find((t) => t.id === tripIdValue)
  if (!trip) return
  if (!trip.sceneIds.includes(sceneId)) trip.sceneIds.push(sceneId)
  if (trip.status === 'upcoming' || trip.status === 'missed') {
    trip.status = 'collected'
    trip.resolvedAt = new Date().toISOString()
  }
  writeTrips(trips)
}

/** 窗景被删除后，如果趟次上没有别的窗景，回到漏采/待补状态 */
export function detachSceneFromTrip(tripIdValue: string, sceneId: string): void {
  const trips = getAllTrips()
  const trip = trips.find((t) => t.id === tripIdValue)
  if (!trip) return
  trip.sceneIds = trip.sceneIds.filter((id) => id !== sceneId)
  if (trip.status === 'collected' && trip.sceneIds.length === 0) {
    trip.status = new Date(trip.endsAt) < new Date() ? 'missed' : 'upcoming'
    trip.resolvedAt = undefined
  }
  writeTrips(trips)
}

export function backfillTrip(tripIdValue: string, reason: string): void {
  const now = new Date()
  const trips = getAllTrips()
  const trip = trips.find((t) => t.id === tripIdValue)
  if (!trip || trip.status !== 'missed') return
  trip.status = 'backfilled'
  trip.reason = reason.trim()
  trip.resolvedAt = now.toISOString()
  writeTrips(trips)
}

/* ---------------- 查询 ---------------- */

export function getTripsByRoute(routeName: string): ScheduledTrip[] {
  return getAllTrips()
    .filter((t) => t.routeName === routeName)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
}

/** 接下来的三趟：进行中优先，其余按开始时间 */
export function getUpcomingTrips(limit = 3, now: Date = new Date()): ScheduledTrip[] {
  return getAllTrips()
    .filter((t) => new Date(t.endsAt) > now && t.status === 'upcoming')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, limit)
}

/** 待补录的漏采趟次，越早的越靠前 */
export function getPendingMissedTrips(limit?: number, now: Date = new Date()): ScheduledTrip[] {
  const list = getAllTrips()
    .filter((t) => t.status === 'missed' && new Date(t.endsAt) <= now)
    .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
  return typeof limit === 'number' ? list.slice(0, limit) : list
}

/**
 * 找一条线路在某个时刻「正在进行」的趟次，保存窗景时自动挂载用。
 * 允许落在开始前 15 分钟内（提前上车）或结束后 30 分钟内（刚下车补记）。
 */
export function findActiveTrip(
  routeName: string,
  at: Date = new Date()
): ScheduledTrip | null {
  const GRACE_BEFORE = 15 * 60 * 1000
  const GRACE_AFTER = 30 * 60 * 1000
  const candidates = getAllTrips().filter((t) => {
    if (t.routeName !== routeName) return false
    if (t.status === 'backfilled') return false
    const start = new Date(t.startsAt).getTime()
    const end = new Date(t.endsAt).getTime()
    return at.getTime() >= start - GRACE_BEFORE && at.getTime() <= end + GRACE_AFTER
  })
  candidates.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
  return candidates[0] ?? null
}

export function getScheduledRouteNames(): string[] {
  return getAllSchedules()
    .map((s) => s.routeName)
    .sort((a, b) => a.localeCompare(b, 'zh'))
}
