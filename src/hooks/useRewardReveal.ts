import { useEffect, useState } from 'react'
import { playSound, stopSound } from '../game/audio'
export function useRewardReveal() {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    setRevealed(false)
    playSound('level-complete')
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 500 : 1600
    const timer = window.setTimeout(() => setRevealed(true), delay)
    return () => { clearTimeout(timer); stopSound('level-complete') }
  }, [])
  return revealed
}
