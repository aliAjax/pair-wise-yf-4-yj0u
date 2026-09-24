import { useEffect, useState } from 'react'
import { X, ClipboardCheck, Bus, Clock } from 'lucide-react'
import type { ScheduledTrip } from '@/types'
import { formatTripDate, formatTripTime } from '@/utils/scheduleHelpers'

interface Props {
  trip: ScheduledTrip | null
  onClose: () => void
  onSubmit: (tripId: string, reason: string) => void
}

/** 漏采补录弹窗：选中一趟漏采趟次并填写原因 */
export default function BackfillDialog({ trip, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (trip) setReason('')
  }, [trip])

  if (!trip) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    onSubmit(trip.id, reason.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-md animate-scale-in rounded-2xl border border-teal-700 bg-teal-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-mist-400 hover:text-mist-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dusk-400/15 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-dusk-400" />
          </div>
          <h2 className="text-xl font-serif font-bold text-dusk-400">漏采补录</h2>
        </div>

        <div className="mb-4 space-y-2 rounded-xl bg-teal-850/70 p-3 text-sm text-mist-300">
          <div className="flex items-center gap-2">
            <Bus className="w-4 h-4 text-dusk-400" />
            <span className="text-mist-100 font-medium">{trip.routeName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-dusk-400" />
            <span>{formatTripDate(trip.date)}（{formatTripTime(trip.start)}–{formatTripTime(trip.end)}）</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-mist-300 text-xs mb-1 block">
              漏掉这一趟的原因 <span className="text-dusk-400">*</span>
            </label>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="比如：临时改了出发时间、上车睡着了、天色太暗没来得及记……"
              className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400 resize-none h-24"
              required
            />
          </div>

          <button
            type="submit"
            disabled={!reason.trim()}
            className="w-full py-2.5 rounded-xl bg-dusk-400 text-teal-950 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            完成补录
          </button>
        </form>
      </div>
    </div>
  )
}
