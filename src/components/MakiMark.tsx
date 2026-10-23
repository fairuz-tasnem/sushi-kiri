/**
 * A plain geometric sushi roll seen end-on, drawn with three nested circles.
 * It is a simple mark for the start screen, not an illustration or an asset.
 */
export default function MakiMark() {
  return (
    <div className="maki" aria-hidden="true">
      <span className="maki__nori" />
      <span className="maki__rice" />
      <span className="maki__filling" />
    </div>
  )
}
