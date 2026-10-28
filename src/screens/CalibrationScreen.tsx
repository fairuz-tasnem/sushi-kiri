import { useEffect, useRef, useState } from 'react'
import type { ScreenProps } from '../game/gameScreen'
import { useHandTracking } from '../vision/HandTrackingContext'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'
import CameraNotice from '../components/CameraNotice'
import TrackingNotice from '../components/TrackingNotice'
export default function CalibrationScreen({ onNavigate }: ScreenProps) {
  const { subscribe, inputMode, setInputMode } = useHandTracking()
  useEffect(() => { if (inputMode === 'mouse') onNavigate('game') }, [inputMode, onNavigate])
  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)
  useEffect(() => {
    let since = 0
    let origin: { x: number; y: number } | null = null
    let moved = false
    return subscribe(sample => {
      if (!sample || sample.previous === null) {
        since = sample?.timestamp ?? 0; origin = sample?.point ?? null; moved = false
        if (readyRef.current) { readyRef.current = false; setReady(false) }
        return
      }
      if (!origin) { origin = sample.point; since = sample.timestamp }
      if (Math.hypot(sample.point.x - origin.x, sample.point.y - origin.y) > 0.05) moved = true
      const next = moved && sample.timestamp - since >= 800
      if (next !== readyRef.current) { readyRef.current = next; setReady(next) }
    })
  }, [subscribe])
  return <ScreenFrame title="Find your blade" actions={<>
    <Button variant="primary" disabled={!ready} onClick={() => onNavigate('game')}>Continue</Button>
    <Button onClick={() => setInputMode('mouse')}>Use mouse fallback</Button>
    <Button onClick={() => onNavigate('start')}>Main menu</Button>
  </>}>
    <p className="lead">Hold up one hand and move your index finger a little. The pointer should follow you like a mirror.</p>
    <p>On menus your hand controls the whole screen. During play it follows your fingertip in the full-screen camera picture.</p>
    <CameraNotice /><TrackingNotice />
    <p role="status">{ready ? 'Tracking is steady. Continue when ready.' : 'Waiting for steady tracking and a small finger movement.'}</p>
  </ScreenFrame>
}
