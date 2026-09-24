// 逻辑冒烟测试：趟次生成 / 防重复 / 漏采 / 补录 / 改日程只影响未来 / 旧数据兼容
import {
  getAllTrips,
  saveSchedule,
  deleteSchedule,
  syncAllTrips,
  backfillTrip,
  getUpcomingTrips,
  getPendingMissedTrips,
  findActiveTrip,
  tripId,
  dateToKey,
} from '../src/services/schedule'
import { saveScene, getAllScenes } from '../src/services/storage'
import type { RouteSchedule } from '../src/types'

let passed = 0
let failed = 0
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

// ---- 构造一个基准时间：2026-09-24（周四）10:00 ----
const NOW = new Date(2026, 8, 24, 10, 0, 0)

function makeSchedule(overrides: Partial<RouteSchedule> = {}): RouteSchedule {
  // 默认创建于前一天，使当天已结束的时段（07:30 趟）能生成并标记漏采
  const yesterday = new Date(NOW)
  yesterday.setDate(NOW.getDate() - 1)
  return {
    id: overrides.id ?? 'sched-1',
    routeName: overrides.routeName ?? '300路',
    weekdays: overrides.weekdays ?? [1, 2, 3, 4, 5], // 工作日
    windows: overrides.windows ?? [
      { id: 'w1', start: '07:30', end: '09:00', label: '早班' },
      { id: 'w2', start: '17:30', end: '19:00', label: '晚班' },
    ],
    createdAt: overrides.createdAt ?? yesterday.toISOString(),
    updatedAt: overrides.updatedAt ?? yesterday.toISOString(),
  }
}

console.log('1) 创建日程后同步趟次')
saveSchedule(makeSchedule())
let trips = getAllTrips()
// 今天 09-24：早班 07:30-09:00 已过且没采 → missed；晚班 17:30 还没到 → upcoming
const todayKey = dateToKey(NOW)
const morningToday = trips.find((t) => t.date === todayKey && t.start === '07:30')!
const eveningToday = trips.find((t) => t.date === todayKey && t.start === '17:30')!
assert(morningToday?.status === 'missed', '今天早班已结束且未采 → 漏采')
assert(eveningToday?.status === 'upcoming', '今天晚班未开始 → upcoming')

console.log('2) 同一时段不会重复生成')
const beforeCount = getAllTrips().length
syncAllTrips(NOW)
syncAllTrips(NOW)
assert(getAllTrips().length === beforeCount, '多次同步趟次总数不变')
assert(tripId('sched-1', todayKey, 'w1') === morningToday.id, '趟次 ID 由 日程+日期+时段 确定性生成')

console.log('3) 接下来三趟：进行中/未来按时间升序取前 3')
const upcoming = getUpcomingTrips(3, NOW)
assert(upcoming.length === 3, '取到 3 趟')
assert(upcoming[0].id === eveningToday.id, '第一趟是今天晚班')
for (let i = 1; i < upcoming.length; i++) {
  assert(
    new Date(upcoming[i].startsAt).getTime() >= new Date(upcoming[i - 1].startsAt).getTime(),
    `第 ${i + 1} 趟晚于第 ${i} 趟`
  )
}
assert(getUpcomingTrips(100, NOW).filter((t) => t.routeName === '300路').length > 3, '实际生成超过 3 趟，记录页只显示 3 趟')

console.log('4) 待补漏采列表')
const pending = getPendingMissedTrips(undefined, NOW)
assert(pending.length >= 1 && pending[0].status === 'missed', '存在待补漏采')
assert(morningToday.id === pending.find((t) => t.id === morningToday.id)?.id, '今天早班在待补列表中')

console.log('5) 补录：填原因后状态变为 backfilled，且不再出现在待补列表')
backfillTrip(morningToday.id, '临时改了地铁')
assert(getAllTrips().find((t) => t.id === morningToday.id)!.status === 'backfilled', '状态为 backfilled')
assert(
  getAllTrips().find((t) => t.id === morningToday.id)!.reason === '临时改了地铁',
  '原因已保存'
)
assert(!getPendingMissedTrips(undefined, NOW).some((t) => t.id === morningToday.id), '补录后从待补列表消失')

console.log('6) 窗景自动挂趟次（时间窗口 + 宽松前后宽限）')
// 17:40 正在晚班时段内
const atEvening = new Date(2026, 8, 24, 17, 40, 0)
const active = findActiveTrip('300路', atEvening)
assert(active?.id === eveningToday.id, '17:40 能匹配到当天晚班趟次')
// 开始前 10 分钟（提前上车）
const beforeStart = new Date(2026, 8, 24, 17, 20, 0)
assert(findActiveTrip('300路', beforeStart)?.id === eveningToday.id, '开始前 10 分钟也能挂（宽限）')
// 完全不沾边的时间
const far = new Date(2026, 8, 24, 13, 0, 0)
assert(findActiveTrip('300路', far) === null, '13:00 没有匹配趟次')
// 没有日程的线路
assert(findActiveTrip('999路', atEvening) === null, '没有日程的线路返回 null（走原记录方式）')

// 通过 storage 保存并挂载
const scene = {
  routeName: '300路',
  segment: '双井—国贸',
  seatDirection: '左' as const,
  timestamp: atEvening.toISOString(),
  weather: '晴' as const,
  signText: '',
  treeDensity: '适中' as const,
  pedestrianStatus: '零星' as const,
  note: '夕照打在玻璃幕墙上',
  id: 'scene-1',
}
saveScene(scene, eveningToday.id)
assert(
  getAllTrips().find((t) => t.id === eveningToday.id)!.status === 'collected',
  '挂上窗景后晚班状态 → collected'
)
assert(
  getAllTrips().find((t) => t.id === eveningToday.id)!.sceneIds.includes('scene-1'),
  'sceneIds 含该窗景'
)
assert(getAllScenes()[0].tripId === eveningToday.id, '窗景记录带上 tripId')

console.log('7) 改日程：只影响还没发生的趟次，已采/待补保持原样')
// 改成只在周一，时段改成 08:00-08:30
saveSchedule(makeSchedule({
  weekdays: [1],
  windows: [{ id: 'w1', start: '08:00', end: '08:30', label: '' }],
  updatedAt: NOW.toISOString(),
}))
trips = getAllTrips()
// 今天的晚班 upcoming → 开始时间晚于 now，应被删除重建规则删掉（新日程周四没车）
assert(!trips.some((t) => t.id === eveningToday.id), '今天晚班（未开始）已随改日程移除')
// 早班 backfilled 的历史保留
const keptMorning = trips.find((t) => t.id === morningToday.id)
assert(keptMorning?.status === 'backfilled', '今天早班已补录记录原样保留')
assert(keptMorning?.reason === '临时改了地铁', '补录原因保留')
// 新日程生成的趟次都是周一
const newOnes = trips.filter((t) => t.status === 'upcoming')
assert(newOnes.every((t) => t.start === '08:00' && t.end === '08:30'), '新趟次使用新时段')
const dayOfWeek = (d: Date) => ((d.getDay() + 6) % 7) + 1
assert(newOnes.every((t) => dayOfWeek(new Date(t.startsAt)) === 1), '新趟次都在周一')

console.log('8) 窗口 ID 变了但同一天 → 旧 upcoming 删除，新确定性 ID 生成，不重复')
saveSchedule(makeSchedule({
  weekdays: [4], // 周四
  windows: [{ id: 'w99', start: '06:00', end: '06:30', label: '' }],
}))
trips = getAllTrips()
const thursdaySix = trips.find((t) => t.date === todayKey && t.start === '06:00')
assert(!!thursdaySix, '新窗口生成了周四 06:00 趟次')
assert(
  trips.filter((t) => t.date === todayKey && t.start === '06:00').length === 1,
  '同一时段只有一条，无重复'
)

console.log('9) 删除日程：未开始的趟次删掉，历史保留')
const histCount = trips.filter((t) => t.status !== 'upcoming').length
deleteSchedule('sched-1')
const after = getAllTrips()
assert(after.every((t) => t.status !== 'upcoming'), '删除后没有 upcoming 趟次')
assert(after.length === histCount, '已采/已补录的历史趟次全部保留')
assert(getAllScenes().length === 1, '窗景记录不受影响')

console.log('10) 旧数据兼容：没有 tripId 的旧窗景照常读取')
assert(getAllScenes()[0].routeName === '300路', '旧窗景字段完整可读')
// 再保存一条无 tripId 的（无日程线路）
const legacyScene = {
  routeName: '老线路', segment: 'A—B', seatDirection: '右' as const,
  timestamp: NOW.toISOString(), weather: '阴' as const, signText: '招牌',
  treeDensity: '稀疏' as const, pedestrianStatus: '稀少' as const, note: '旧的',
  id: 'scene-old',
}
saveScene(legacyScene)
assert(getAllScenes().length === 2, '无日程线路窗景照常保存')
assert(getAllScenes().find((s) => s.id === 'scene-old')!.tripId === undefined, '无 tripId')

console.log('11) 日程创建时间之后结束的趟次才生成（不为历史凭空造趟次）')
// createdAt 设在未来 → 今天的趟次都不该出现
const futureSchedule = makeSchedule({
  id: 'sched-future',
  weekdays: [1, 2, 3, 4, 5],
  windows: [{ id: 'wf', start: '07:30', end: '09:00', label: '' }],
  createdAt: new Date(2026, 8, 25, 0, 0, 0).toISOString(),
})
saveSchedule(futureSchedule)
const futureTrips = getAllTrips().filter((t) => t.scheduleId === 'sched-future')
assert(
  !futureTrips.some((t) => t.date === todayKey),
  '创建于明天零点的日程，不为今天生成趟次'
)
assert(futureTrips.length > 0, '仍会为之后的工作日生成趟次')

console.log('12) 删除已挂载的窗景，趟次回到漏采')
deleteSchedule('sched-future')
// 重建基础场景
saveSchedule(makeSchedule())
saveScene({ ...scene, id: 'scene-2' }, eveningToday.id)
assert(
  getAllTrips().find((t) => t.id === eveningToday.id)!.status === 'collected',
  '晚班重新采到 → collected'
)
const { deleteScene } = await import('../src/services/storage')
deleteScene('scene-2')
assert(
  getAllTrips().find((t) => t.id === eveningToday.id)!.status === 'upcoming',
  '删掉唯一窗景且时段尚未结束 → 回到 upcoming（之后过点无采会自动转 missed）'
)
// 模拟时间走到当晚 19:30 再同步 → 漏采
syncAllTrips(new Date(2026, 8, 24, 19, 30, 0))
assert(
  getAllTrips().find((t) => t.id === eveningToday.id)!.status === 'missed',
  '时段过去仍无窗景 → 同步时转为 missed'
)

console.log(`\n结果：${passed} 通过，${failed} 失败`)
if (failed > 0) process.exit(1)
