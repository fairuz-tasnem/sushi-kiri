import { useEffect, useRef } from 'react'
import { mapVideoPointToScreen, isInsideRect } from '../vision/coordinateMapper'
import { useHandTracking } from '../vision/HandTrackingContext'
import type { HandTrackingState } from '../vision/useHandTracker'

interface Props { video: HTMLVideoElement | null; subscribe: HandTrackingState['subscribe']; visible: boolean; playing: boolean; screen: string }
/** Menu control uses the whole viewport; gameplay uses the visible camera crop. */
export default function HandCursor({ video, subscribe, visible, playing, screen }: Props) {
  const { inputMode } = useHandTracking()
  const cursor = useRef<SVGSVGElement>(null)
  const ring = useRef<SVGRectElement>(null)
  const lock = useRef<{ left: number; top: number; width: number; height: number } | null>(null)
  useEffect(() => {
    const cursorElement = cursor.current
    const ringElement = ring.current
    if (!cursorElement || !ringElement) return
    let target: HTMLButtonElement | null = null
    let since = 0
    let last = 0
    const hide = () => { cursorElement.style.visibility = 'hidden'; ringElement.style.strokeDashoffset = '100'; target = null }
    const unsubscribe = subscribe(sample => {
      if (inputMode === 'mouse') return
      if (!sample || document.hidden || !video) { hide(); return }
      const rect = playing ? video.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight }
      const point = playing ? mapVideoPointToScreen(sample.point, { width: video.videoWidth, height: video.videoHeight }, rect)
        : { x: (1 - sample.point.x) * innerWidth, y: sample.point.y * innerHeight }
      if (!point || !isInsideRect(point, rect)) { hide(); return }
      const el = cursorElement
      el.style.visibility = 'visible'
      el.style.transform = `translate(${point.x - 8}px, ${point.y - 8}px)`
      if (sample.previous === null || sample.timestamp - last > 300) target = null
      last = sample.timestamp
      if (lock.current) {
        if (isInsideRect(point, lock.current)) return
        lock.current = null
      }
      const hit = document.elementFromPoint(point.x, point.y)?.closest('button') as HTMLButtonElement | null
      const button = hit && !hit.disabled && !hit.closest('.dev-picker') ? hit : null
      if (button !== target) { target = button; since = sample.timestamp }
      const progress = target ? Math.min(1, (sample.timestamp - since) / 700) : 0
      ringElement.style.strokeDashoffset = String(100 * (1 - progress))
      if (target && progress === 1) {
        const button = target
        const bounds = button.getBoundingClientRect()
        lock.current = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
        target = null
        ringElement.style.strokeDashoffset = '100'
        button.click()
      }
    })
    const mouse = (event: PointerEvent) => {
      if (inputMode !== 'mouse' || event.pointerType === 'touch') return
      cursorElement.style.visibility = 'visible'
      cursorElement.style.transform = `translate(${event.clientX - 8}px, ${event.clientY - 8}px)`
      ringElement.style.strokeDashoffset = '100'
    }
    const leave = () => hide()
    window.addEventListener('pointermove', mouse)
    document.documentElement.addEventListener('pointerleave', leave)
    return () => { unsubscribe(); hide(); window.removeEventListener('pointermove', mouse); document.documentElement.removeEventListener('pointerleave', leave) }
  }, [video, subscribe, playing, screen, inputMode])
  return <svg ref={cursor} className="dwell-cursor chopstick-cursor" width="70" height="70" viewBox="0 0 70 70" style={{ display: visible ? undefined : 'none' }} aria-hidden="true">
    <path d="M8 6 L64 34 L60 40 L7 10 Z" fill="#9d573a" stroke="#f5efdf" strokeWidth="1.5" />
    <path d="M6 9 L36 65 L43 61 L10 8 Z" fill="#735139" stroke="#f5efdf" strokeWidth="1.5" />
    <path d="M51 29 L48 34 M54 31 L51 36 M31 51 L36 48 M33 55 L39 52" stroke="#233d2b" strokeWidth="2" />
    <rect ref={ring} x="2" y="2" width="14" height="14" fill="none" stroke="#a84a28" strokeWidth="2" pathLength="100" strokeDasharray="100" strokeDashoffset="100" />
  </svg>
}
