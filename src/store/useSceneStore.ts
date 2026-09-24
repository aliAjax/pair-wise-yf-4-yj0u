import { create } from 'zustand'
import type { WindowScene, SceneFormData, RouteSchedule, ScheduledTrip } from '@/types'
import {
  getAllScenes,
  saveScene as storageSaveScene,
  deleteScene as storageDeleteScene,
  getScenesByRoute,
  getAllRouteNames,
  getRandomScene,
} from '@/services/storage'
import {
  getAllSchedules,
  saveSchedule as storageSaveSchedule,
  deleteSchedule as storageDeleteSchedule,
  getAllTrips,
  syncAllTrips,
  backfillTrip as storageBackfillTrip,
  findActiveTrip,
} from '@/services/schedule'

interface SceneState {
  scenes: WindowScene[]
  routeNames: string[]
  currentRouteScenes: WindowScene[]
  selectedRoute: string
  randomScene: WindowScene | null

  schedules: RouteSchedule[]
  trips: ScheduledTrip[]

  loadAll: () => void
  /** tripId 显式指定趟次；不传则按线路 + 当前时间自动匹配 */
  saveScene: (data: SceneFormData, tripId?: string) => void
  deleteScene: (id: string) => void
  selectRoute: (routeName: string) => void
  refreshRandom: () => void

  saveRouteSchedule: (schedule: RouteSchedule) => void
  removeSchedule: (id: string) => void
  backfillTrip: (tripId: string, reason: string) => void
}

export const useSceneStore = create<SceneState>((set) => ({
  scenes: [],
  routeNames: [],
  currentRouteScenes: [],
  selectedRoute: '',
  randomScene: null,

  schedules: [],
  trips: [],

  loadAll: () => {
    const trips = syncAllTrips()
    const scenes = getAllScenes()
    const routeNames = getAllRouteNames()
    const schedules = getAllSchedules()
    set({ scenes, routeNames, schedules, trips })
  },

  saveScene: (data, tripId) => {
    const now = new Date()
    const scene: WindowScene = {
      ...data,
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
    }
    // 未显式选趟次时，按线路 + 当前时间自动挂到正在进行的趟次
    const matchedTripId = tripId ?? findActiveTrip(data.routeName, now)?.id
    storageSaveScene(scene, matchedTripId)
    const scenes = getAllScenes()
    const routeNames = getAllRouteNames()
    const trips = getAllTrips()
    set((state) => {
      const currentRouteScenes =
        state.selectedRoute ? getScenesByRoute(state.selectedRoute) : []
      return { scenes, routeNames, trips, currentRouteScenes }
    })
  },

  deleteScene: (id) => {
    storageDeleteScene(id)
    const scenes = getAllScenes()
    const routeNames = getAllRouteNames()
    const trips = getAllTrips()
    set((state) => {
      const currentRouteScenes =
        state.selectedRoute ? getScenesByRoute(state.selectedRoute) : []
      return { scenes, routeNames, trips, currentRouteScenes }
    })
  },

  selectRoute: (routeName) => {
    const currentRouteScenes = routeName ? getScenesByRoute(routeName) : []
    set({ selectedRoute: routeName, currentRouteScenes })
  },

  refreshRandom: () => {
    const randomScene = getRandomScene()
    set({ randomScene })
  },

  saveRouteSchedule: (schedule) => {
    storageSaveSchedule(schedule)
    set({ schedules: getAllSchedules(), trips: getAllTrips() })
  },

  removeSchedule: (id) => {
    storageDeleteSchedule(id)
    set({ schedules: getAllSchedules(), trips: getAllTrips() })
  },

  backfillTrip: (tripId, reason) => {
    storageBackfillTrip(tripId, reason)
    set({ trips: getAllTrips() })
  },
}))
