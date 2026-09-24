export type SeatDirection = '左' | '右'

export type Weather = '晴' | '多云' | '阴' | '小雨' | '大雨' | '雪' | '雾'

export type TreeDensity = '稀疏' | '适中' | '茂密'

export type PedestrianStatus = '稀少' | '零星' | '密集'

export interface WindowScene {
  id: string
  routeName: string
  segment: string
  seatDirection: SeatDirection
  timestamp: string
  weather: Weather
  signText: string
  treeDensity: TreeDensity
  pedestrianStatus: PedestrianStatus
  note: string
  /** 归属的计划趟次；没有日程的线路或旧数据可能没有此字段 */
  tripId?: string
}

export interface SceneFormData {
  routeName: string
  segment: string
  seatDirection: SeatDirection
  weather: Weather
  signText: string
  treeDensity: TreeDensity
  pedestrianStatus: PedestrianStatus
  note: string
}

/** 周几，1=周一 … 7=周日 */
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** 车行时段（当天内，HH:MM，不跨天） */
export interface TimeWindow {
  id: string
  start: string
  end: string
  /** 时段备注，如「早班」「晚高峰」，可空 */
  label?: string
}

/** 线路观察日程：每周哪几天、哪几个车行时段 */
export interface RouteSchedule {
  id: string
  routeName: string
  weekdays: WeekdayNumber[]
  windows: TimeWindow[]
  /** ISO，只对创建之后结束的趟次生效 */
  createdAt: string
  updatedAt: string
}

export type TripStatus = 'upcoming' | 'collected' | 'missed' | 'backfilled'

/** 日程展开后的具体趟次，例如 2026-09-24 07:30–09:00 的某趟车 */
export interface ScheduledTrip {
  /** 确定性 ID：日程 + 日期 + 时段，同一时段不会重复生成 */
  id: string
  scheduleId: string
  routeName: string
  /** YYYY-MM-DD，本地日期 */
  date: string
  start: string
  end: string
  /** ISO 时间戳，仅用于比较与排序 */
  startsAt: string
  endsAt: string
  status: TripStatus
  /** 挂到这一趟的窗景记录 */
  sceneIds: string[]
  /** 漏采补录时填写的原因 */
  reason?: string
  resolvedAt?: string
}
