import type { WindowScene } from '@/types'
import { attachSceneToTrip, detachSceneFromTrip } from './schedule'

const STORAGE_KEY = 'bus_window_scenes'

export function getAllScenes(): WindowScene[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WindowScene[]
  } catch {
    return []
  }
}

export function saveScene(scene: WindowScene, tripId?: string): void {
  const scenes = getAllScenes()
  if (tripId) {
    scene.tripId = tripId
    attachSceneToTrip(tripId, scene.id)
  }
  scenes.push(scene)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes))
}

export function deleteScene(id: string): void {
  const scene = getAllScenes().find((s) => s.id === id)
  if (scene?.tripId) detachSceneFromTrip(scene.tripId, id)
  const scenes = getAllScenes().filter((s) => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes))
}

export function getScenesByRoute(routeName: string): WindowScene[] {
  return getAllScenes()
    .filter((s) => s.routeName === routeName)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function getAllRouteNames(): string[] {
  const scenes = getAllScenes()
  const routeSet = new Set(scenes.map((s) => s.routeName))
  return Array.from(routeSet).sort()
}

export function getRandomScene(): WindowScene | null {
  const scenes = getAllScenes()
  if (scenes.length === 0) return null
  return scenes[Math.floor(Math.random() * scenes.length)]
}
