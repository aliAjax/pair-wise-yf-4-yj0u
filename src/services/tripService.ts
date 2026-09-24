import type { TripRecord, WindowScene } from '@/types'
import { listElapsedWindows, tripKeyOfRecord, windowOnDate } from '@/utils/scheduleHelpers'
import { getAllScenes } from '@/services/storage'
import {
  getAllSchedules,
  getAllTripRecords,
  getScheduleByRoute,
  saveTripRecords,
  updateTripRecord,
} from '@/services/scheduleStorage'

/**
 * 把所有日程中「已经错过且尚未留痕」的趟次补成漏采记录。
 * 按 日程+日期+开始时间 去重，重复调用不会重复生成。
 */
export function sweepMissedTrips(now: Date = new Date()): void {
  const schedules = getAllSchedules()
  if (schedules.length === 0) return

  const existingKeys = new Set(getAllTripRecords().map(tripKeyOfRecord))
  const fresh: TripRecord[] = []

  for (const schedule of schedules) {
    for (const w of listElapsedWindows(schedule, now)) {
      if (existingKeys.has(w.key)) continue
      existingKeys.add(w.key)
      const timestamp = new Date().toISOString()
      fresh.push({
        id: crypto.randomUUID(),
        scheduleId: w.scheduleId,
        routeName: w.routeName,
        date: w.date,
        startTime: w.startTime,
        endTime: w.endTime,
        status: 'missed',
        missReason: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
  }

  if (fresh.length > 0) saveTripRecords(fresh)
}

/**
 * 保存窗景时调用：当前时刻落在该线路日程的趟次窗口内，
 * 则把窗景挂到对应趟次，趟次记为已采到。
 * 返回挂上的趟次记录；无日程或不在窗口内返回 null。
 */
export function attachSceneToTrip(scene: WindowScene, now: Date = new Date()): TripRecord | null {
  const schedule = getScheduleByRoute(scene.routeName)
  if (!schedule) return null

  const w = windowOnDate(schedule, now)
  if (!w || now < w.startAt || now >= w.endAt) return null

  const existing = getAllTripRecords().find((r) => tripKeyOfRecord(r) === w.key)
  const timestamp = new Date().toISOString()
  if (existing) {
    const record: TripRecord = { ...existing, status: 'collected', updatedAt: timestamp }
    updateTripRecord(record)
    return record
  }
  const record: TripRecord = {
    id: crypto.randomUUID(),
    scheduleId: w.scheduleId,
    routeName: w.routeName,
    date: w.date,
    startTime: w.startTime,
    endTime: w.endTime,
    status: 'collected',
    missReason: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  saveTripRecords([record])
  return record
}

/**
 * 删除窗景后调用：若该趟次下已没有其他窗景，
 * 趟次回退为待补录的漏采记录。
 */
export function revertTripForDeletedScene(tripId: string): void {
  const stillLinked = getAllScenes().some((s) => s.tripId === tripId)
  if (stillLinked) return
  const record = getAllTripRecords().find((r) => r.id === tripId)
  if (!record || record.status !== 'collected') return
  updateTripRecord({
    ...record,
    status: 'missed',
    missReason: '',
    updatedAt: new Date().toISOString(),
  })
}
