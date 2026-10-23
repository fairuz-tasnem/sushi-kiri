/**
 * Small decorative divider: two chopsticks resting side by side.
 * Pure decoration, so it is hidden from assistive technology.
 */
export default function ChopstickRule() {
  return (
    <svg
      className="chopsticks"
      width="132"
      height="14"
      viewBox="0 0 132 14"
      aria-hidden="true"
      focusable="false"
    >
      <line className="chopsticks__a" x1="2" y1="4" x2="130" y2="3" />
      <line className="chopsticks__b" x1="2" y1="10" x2="112" y2="11" />
    </svg>
  )
}
