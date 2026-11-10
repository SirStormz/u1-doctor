/** SVG filter of the liquid glass lens (Obsidian theme): a soft displacement that makes the lens edge and its content ripple. */
export function LiquidDefs() {
  return (
    <svg className="lq-defs" width="0" height="0" aria-hidden focusable="false" style={{ position: "absolute" }}>
      <filter id="lq-lens" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.011 0.017" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
