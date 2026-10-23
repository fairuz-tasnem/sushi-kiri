import type { ScreenProps } from '../game/gameScreen'
import { useFocusOnMount } from '../hooks/useFocusOnMount'
import Button from '../components/Button'
import ChopstickRule from '../components/ChopstickRule'
import MakiMark from '../components/MakiMark'

/**
 * Main menu. There is deliberately no "Play" button: the game does not exist
 * yet, so the menu only offers the screens that are really available.
 */
export default function StartScreen({ onNavigate }: ScreenProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()

  return (
    <section className="start" aria-labelledby="screen-title">
      <div className="start__text">
        <h1 id="screen-title" className="start__title" ref={headingRef} tabIndex={-1}>
          Sushi Kiri
        </h1>
        <ChopstickRule />
        <p className="start__lead">
          A small game about slicing sushi with your hands, using nothing but a camera.
        </p>

        <nav className="menu" aria-label="Main menu">
          <Button variant="primary" onClick={() => onNavigate('instructions')}>
            Instructions
          </Button>
          <Button onClick={() => onNavigate('settings')}>Settings</Button>
          <Button onClick={() => onNavigate('calibration')} note="Placeholder">
            Calibration
          </Button>
        </nav>

        <p className="start__status">
          With your camera on, a thumbs-up starts the game, and a V-sign held for 1 second says
          goodbye. The camera starts when you open Calibration.
        </p>
      </div>

      <MakiMark />
    </section>
  )
}
