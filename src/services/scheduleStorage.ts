import type { ObservationSchedule, TripRecord } from '@/types'

const SCHEDULE_KEY = 'bus_window_schedules'
const TRIP_RECORD_KEY = 'bus_window_trip_records'

export function getAllSchedules(): ObservationSchedule[] {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ObservationSchedule[]
  } catch {
    return []
  }
}

function persistSchedules(schedules: ObservationSchedule[]): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules))
}

export function getScheduleByRoute(routeName: string): ObservationSchedule | undefined {
  return getAllSchedules().find((s) => s.routeName === routeName)
}

export function saveSchedule(schedule: ObservationSchedule): void {
  const schedules = getAllSchedules().filter((s) => s.id !== schedule.id)
  schedules.push(schedule)
  persistSchedules(schedules)
}

export function deleteSchedule(id: string): void {
  persistSchedules(getAllSchedules().filter((s) => s.id !== id))
}

export function getAllTripRecords(): TripRecord[] {
  try {
    const raw = localStorage.getItem(TRIP_RECORD_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TripRecord[]
  } catch {
    return []
  }
}

function persistTripRecords(records: TripRecord[]): void {
  localStorage.setItem(TRIP_RECORD_KEY, JSON.stringify(records))
}

export function saveTripRecords(records: TripRecord[]): void {
  persistTripRecords([...getAllTripRecords(), ...records])
}

export function updateTripRecord(record: TripRecord): void {
  const records = getAllTripRecords().map((r) => (r.id === record.id ? record : r))
  persistTripRecords(records)
}

export function getTripRecordsByRoute(routeName: string): TripRecord[] {
  return getAllTripRecords()
    .filter((r) => r.routeName === routeName)
    .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`))
}
