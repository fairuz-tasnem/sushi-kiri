import type { ScreenProps } from '../game/gameScreen'
import type { Preferences } from '../game/preferences'
import { useFocusOnMount } from '../hooks/useFocusOnMount'
import Button from '../components/Button'
import BrandLogo from '../components/BrandLogo'
import { getAssetUrl } from '../game/assetManifest'
interface Props extends ScreenProps { preferences: Preferences; selectedLevel: number; onSelectLevel: (level: number) => void }
export default function StartScreen({ onNavigate, preferences, selectedLevel, onSelectLevel }: Props) {
  const heading = useFocusOnMount<HTMLHeadingElement>()
  return <section className="start" aria-label="Sushi Kiri main menu">
    <div className="brand-panel">
      <h1 ref={heading} tabIndex={-1}><BrandLogo /></h1>
      <div className="food-guide" aria-label="What to slice">
        <div><img src={getAssetUrl('sushi', 'salmon-nigiri')!} alt="Salmon sushi" /><strong>+10 points</strong></div>
        <div><img src={getAssetUrl('powerups', 'soy-sauce')!} alt="Soy sauce bottle" /><strong>2× points</strong></div>
        <div><img src={getAssetUrl('hazards', 'wasabi')!} alt="Wasabi tube" /><strong>−1 life</strong></div>
      </div>
    </div>
    <div className="start__controls">
      <nav className="menu" aria-label="Main menu">
        <Button variant="primary" onClick={() => onNavigate('game')}>Play <span className="menu-level">/ {selectedLevel.toString().padStart(2, '0')}</span></Button>
        <Button onClick={() => onNavigate('instructions')}>How to play</Button>
        <Button onClick={() => onNavigate('settings')}>Settings</Button>
        <Button onClick={() => onNavigate('goodbye')}>Exit</Button>
      </nav>
      <div className="level-select" aria-label="Unlocked levels">{Array.from({ length: preferences.unlocked }, (_, i) => i + 1).map(level =>
        <Button key={level} aria-pressed={selectedLevel === level} onClick={() => onSelectLevel(level)}>Level {level}</Button>)}</div>
      <p className="start__status">Best: {preferences.best[selectedLevel] ?? 0} pts · Level {selectedLevel}</p>
      <p className="menu-hint">Click to choose, or point and hold.</p>
    </div>
  </section>
}
