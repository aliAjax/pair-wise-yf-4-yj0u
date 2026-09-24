import { create } from 'zustand'
import type { ObservationSchedule, ScheduleFormData, TripRecord } from '@/types'
import { parseTimeToMinutes } from '@/utils/scheduleHelpers'
import { sweepMissedTrips } from '@/services/tripService'
import {
  deleteSchedule as storageDeleteSchedule,
  getAllSchedules,
  getAllTripRecords,
  getScheduleByRoute,
  saveSchedule as storageSaveSchedule,
  updateTripRecord,
} from '@/services/scheduleStorage'

interface ScheduleState {
  schedules: ObservationSchedule[]
  tripRecords: TripRecord[]

  /** 先把错过的趟次留痕，再加载最新数据 */
  loadAll: () => void
  /** 返回错误信息；保存成功返回 null */
  saveSchedule: (data: ScheduleFormData, editingId?: string) => string | null
  removeSchedule: (id: string) => void
  fillMissReason: (tripId: string, reason: string) => void
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  schedules: [],
  tripRecords: [],

  loadAll: () => {
    sweepMissedTrips()
    set({ schedules: getAllSchedules(), tripRecords: getAllTripRecords() })
  },

  saveSchedule: (data, editingId) => {
    const routeName = data.routeName.trim()
    if (!routeName) return '请填写线路名'
    if (data.daysOfWeek.length === 0) return '请至少选择一天'
    if (parseTimeToMinutes(data.startTime) >= parseTimeToMinutes(data.endTime))
      return '结束时间需晚于开始时间'
    const existing = getScheduleByRoute(routeName)
    if (existing && existing.id !== editingId) return '该线路已有日程，请直接编辑'

    // 先用旧日程把已错过的趟次留痕，保证本次修改只影响还没发生的趟次
    sweepMissedTrips()

    const now = new Date().toISOString()
    const schedule: ObservationSchedule = existing
      ? { ...existing, routeName, daysOfWeek: data.daysOfWeek, startTime: data.startTime, endTime: data.endTime, updatedAt: now }
      : { id: crypto.randomUUID(), routeName, daysOfWeek: data.daysOfWeek, startTime: data.startTime, endTime: data.endTime, createdAt: now, updatedAt: now }
    storageSaveSchedule(schedule)

    set({ schedules: getAllSchedules(), tripRecords: getAllTripRecords() })
    return null
  },

  removeSchedule: (id) => {
    // 只删日程，已生成的趟次记录保留原样
    storageDeleteSchedule(id)
    set({ schedules: getAllSchedules(), tripRecords: getAllTripRecords() })
  },

  fillMissReason: (tripId, reason) => {
    const record = getAllTripRecords().find((r) => r.id === tripId)
    if (!record || record.status !== 'missed') return
    updateTripRecord({ ...record, missReason: reason.trim(), updatedAt: new Date().toISOString() })
    set({ schedules: getAllSchedules(), tripRecords: getAllTripRecords() })
  },
}))
