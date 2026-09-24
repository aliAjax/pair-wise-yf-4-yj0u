import type { ScheduledTrip, WeekdayNumber } from '@/types'
import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT_LABELS,
  combineDateTime,
} from '@/services/schedule'

export { WEEKDAY_LABELS, WEEKDAY_SHORT_LABELS }

/** YYYY-MM-DD → M月D日 周X */
export function formatTripDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number)
  const weekday = weekdayOfDateKey(dateKey)
  return `${m}月${d}日 ${WEEKDAY_SHORT_LABELS[weekday]}`
}

export function weekdayOfDateKey(dateKey: string): WeekdayNumber {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return (((date.getDay() + 6) % 7) + 1) as WeekdayNumber
}

/** 去掉时间前导零：07:30 → 7:30 */
export function formatTripTime(time: string): string {
  const [hh, mm] = time.split(':')
  return `${Number(hh)}:${mm}`
}

export type TripTiming = 'ongoing' | 'today' | 'tomorrow' | 'later'

/** 趟次相对当前的时间归属，用于「接下来三趟」的标签 */
export function getTripTiming(trip: ScheduledTrip, now: Date = new Date()): TripTiming {
  const start = new Date(trip.startsAt)
  const end = new Date(trip.endsAt)
  if (start <= now && end > now) return 'ongoing'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tripDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  if (tripDay.getTime() === today.getTime()) return 'today'
  if (tripDay.getTime() === tomorrow.getTime()) return 'tomorrow'
  return 'later'
}

export const TRIP_TIMING_LABEL: Record<TripTiming, string> = {
  ongoing: '进行中',
  today: '今天',
  tomorrow: '明天',
  later: '',
}

/** 距趟次开始的人性化倒计时，如「25 分钟后」「3 小时后」 */
export function formatCountdown(trip: ScheduledTrip, now: Date = new Date()): string {
  const start = new Date(trip.startsAt)
  const diffMin = Math.round((start.getTime() - now.getTime()) / 60000)
  if (diffMin <= 0) return '即将发车'
  if (diffMin < 60) return `${diffMin} 分钟后`
  const hours = Math.floor(diffMin / 60)
  const mins = diffMin % 60
  if (hours < 24) return mins > 0 ? `${hours} 小时 ${mins} 分后` : `${hours} 小时后`
  const days = Math.floor(hours / 24)
  return `${days} 天后`
}

export { combineDateTime }
