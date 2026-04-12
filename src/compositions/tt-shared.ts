// Shared design tokens for TTLowerThird and TTCallToAction.
// Change values here and both compositions update automatically.

export const TT_SPRINGS = {
  popDamping:       14,
  popStiffness:     300,
  slideDamping:     26,   // overdamped (critical ≈ 23.7 for stiffness 140) — no overshoot
  slideStiffness:   140,
  exitSlideDamping: 30,   // overdamped on exit — no oscillation
};

export const TT_COLORS = {
  stripColor:    '#fef244',
  textColor:     '#040371',
  subtitleColor: '#f82381',
  line1Color:    '#040371',
  line2Color:    '#f82381',
};

export const TT_FONT = '"Montserrat", "Arial Black", Arial, sans-serif';
