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
  /** 关联的趟次记录 id；无日程或未落在趟次窗口内时为空 */
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

/** 线路观察日程：每周哪几天、车行时段 */
export interface ObservationSchedule {
  id: string
  routeName: string
  /** 0-6，对应 Date.getDay()，0 为周日 */
  daysOfWeek: number[]
  /** "HH:MM" */
  startTime: string
  /** "HH:MM" */
  endTime: string
  createdAt: string
  /** 最近一次修改时间；只有在此之后才结束的趟次才会受当前日程约束 */
  updatedAt: string
}

export interface ScheduleFormData {
  routeName: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
}

export type TripStatus = 'collected' | 'missed'

/**
 * 趟次记录：日程落到具体日期的一趟车。
 * 已采到（collected）与漏采（missed）的趟次都会持久化，
 * 之后修改日程不影响这些已生成的记录。
 */
export interface TripRecord {
  id: string
  scheduleId: string
  routeName: string
  /** "YYYY-MM-DD"，本地日期 */
  date: string
  /** "HH:MM" */
  startTime: string
  /** "HH:MM" */
  endTime: string
  status: TripStatus
  /** 漏采原因；空串表示待补录 */
  missReason: string
  createdAt: string
  updatedAt: string
}
