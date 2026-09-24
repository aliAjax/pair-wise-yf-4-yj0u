import { create } from 'zustand'
import type { WindowScene, SceneFormData, TripRecord } from '@/types'
import {
  getAllScenes,
  saveScene as storageSaveScene,
  deleteScene as storageDeleteScene,
  getScenesByRoute,
  getAllRouteNames,
  getRandomScene,
} from '@/services/storage'
import { attachSceneToTrip, revertTripForDeletedScene } from '@/services/tripService'
import { useScheduleStore } from '@/store/useScheduleStore'

interface SceneState {
  scenes: WindowScene[]
  routeNames: string[]
  currentRouteScenes: WindowScene[]
  selectedRoute: string
  randomScene: WindowScene | null

  loadAll: () => void
  /** 保存窗景；若落在日程趟次窗口内会自动挂趟，返回挂上的趟次 */
  saveScene: (data: SceneFormData) => TripRecord | null
  deleteScene: (id: string) => void
  selectRoute: (routeName: string) => void
  refreshRandom: () => void
}

export const useSceneStore = create<SceneState>((set) => ({
  scenes: [],
  routeNames: [],
  currentRouteScenes: [],
  selectedRoute: '',
  randomScene: null,

  loadAll: () => {
    const scenes = getAllScenes()
    const routeNames = getAllRouteNames()
    set({ scenes, routeNames })
  },

  saveScene: (data: SceneFormData) => {
    const scene: WindowScene = {
      ...data,
      routeName: data.routeName.trim(),
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }
    const trip = attachSceneToTrip(scene)
    if (trip) scene.tripId = trip.id
    storageSaveScene(scene)
    useScheduleStore.getState().loadAll()

    const scenes = getAllScenes()
    const routeNames = getAllRouteNames()
    set((state) => {
      const currentRouteScenes =
        state.selectedRoute ? getScenesByRoute(state.selectedRoute) : []
      return { scenes, routeNames, currentRouteScenes }
    })
    return trip
  },

  deleteScene: (id: string) => {
    const scene = getAllScenes().find((s) => s.id === id)
    storageDeleteScene(id)
    if (scene?.tripId) {
      revertTripForDeletedScene(scene.tripId)
      useScheduleStore.getState().loadAll()
    }
    const scenes = getAllScenes()
    const routeNames = getAllRouteNames()
    set((state) => {
      const currentRouteScenes =
        state.selectedRoute ? getScenesByRoute(state.selectedRoute) : []
      return { scenes, routeNames, currentRouteScenes }
    })
  },

  selectRoute: (routeName: string) => {
    const currentRouteScenes = routeName ? getScenesByRoute(routeName) : []
    set({ selectedRoute: routeName, currentRouteScenes })
  },

  refreshRandom: () => {
    const randomScene = getRandomScene()
    set({ randomScene })
  },
}))
