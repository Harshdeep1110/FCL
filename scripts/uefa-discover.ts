import "dotenv/config";
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

// Discovery: load the UEFA UCL Fantasy SPA in a real browser and capture the
// JSON API endpoints it calls (PRD §8a). Dumps interesting payloads so we can
// inspect whether raw per-player stats (goals/assists/minutes/defensive
// actions) are exposed.
async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
  });
  const page = await ctx.newPage();

  const seen = new Map<string, { status: number; ct: string; sample?: string }>();

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    if (seen.has(url)) return;
    let sample: string | undefined;
    try {
      const text = await res.text();
      sample = text.slice(0, 600);
      // Save any player/stats feed in full for inspection.
      if (/player|stat|fantasy|feed/i.test(url)) {
        const fname = `uefa-${seen.size}.json`;
        writeFileSync(`D:/FCL/${fname}`, text);
      }
    } catch {
      /* ignore */
    }
    seen.set(url, { status: res.status(), ct, sample });
  });

  const target = "https://gaming.uefa.com/en/uclfantasy/create-team";
  console.log("Navigating:", target);
  try {
    await page.goto(target, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) {
    console.log("goto note:", e instanceof Error ? e.message : String(e));
  }
  // Give client-side calls time to fire.
  await page.waitForTimeout(5000);
  console.log("Final URL:", page.url());
  console.log("Page title:", await page.title());

  console.log(`\n=== ${seen.size} JSON responses captured ===`);
  for (const [url, meta] of seen) {
    console.log(`\n[${meta.status}] ${url}`);
    if (meta.sample) console.log("  ", meta.sample.replace(/\n/g, " ").slice(0, 300));
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
