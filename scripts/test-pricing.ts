import { computeNewPrice } from "../src/lib/pricing";

let failed = 0;
function eq(name: string, got: number, want: number) {
  const ok = Math.abs(got - want) < 1e-9;
  if (!ok) failed += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}: got ${got}, want ${want}`);
}

// MID β=0.75. P=6 actual=10 → EP=4.5, raw=5.5, smoothed=2.475, move=+0.124 → 6.1
eq("MID overperforms rises to 6.1",
  computeNewPrice({ actualPoints: 10, currentPrice: 6, originalPrice: 6, position: "MID", prevSmoothedDelta: 0 }).newPrice, 6.1);

// ATT β=0.8. P=8 actual=0 → EP=6.4, raw=-6.4, smoothed=-2.88, move=-0.144 → 7.9
eq("ATT blanks drops to 7.9",
  computeNewPrice({ actualPoints: 0, currentPrice: 8, originalPrice: 8, position: "ATT", prevSmoothedDelta: 0 }).newPrice, 7.9);

// Ceiling: DEF P=9 orig=5 (ceiling 9) actual=100 → clamped to 9.0
eq("ceiling clamp 9.0",
  computeNewPrice({ actualPoints: 100, currentPrice: 9, originalPrice: 5, position: "DEF", prevSmoothedDelta: 0 }).newPrice, 9.0);

// Floor: GK P=3 orig=5 (floor 3) actual=0 → clamped to 3.0
eq("floor clamp 3.0",
  computeNewPrice({ actualPoints: 0, currentPrice: 3, originalPrice: 5, position: "GK", prevSmoothedDelta: 0 }).newPrice, 3.0);

// maxMove: MID P=10 actual=1000 → move capped at 5% of 10 = 0.5 → 10.5
eq("maxMove cap +0.5 → 10.5",
  computeNewPrice({ actualPoints: 1000, currentPrice: 10, originalPrice: 10, position: "MID", prevSmoothedDelta: 0 }).newPrice, 10.5);

console.log(failed === 0 ? "\nPRICING TESTS PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
