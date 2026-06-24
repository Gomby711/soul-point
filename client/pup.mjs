import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox","--disable-setuid-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:5173", { waitUntil: "networkidle0", timeout: 20000 });
await page.screenshot({ path: "C:/Users/leete/AppData/Local/Temp/sc_home.png" });
const navBtns = await page.$$("button");
for (const btn of navBtns) {
  const txt = await page.evaluate(el => el.textContent?.trim(), btn);
  if (txt && txt.toLowerCase() === "champions") { await btn.click(); break; }
}
await new Promise(r => setTimeout(r, 2500));
await page.screenshot({ path: "C:/Users/leete/AppData/Local/Temp/sc_champions.png" });
const gridBtns = await page.$$(".grid button");
if (gridBtns[0]) { await gridBtns[0].click(); }
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: "C:/Users/leete/AppData/Local/Temp/sc_build_top.png" });
await page.evaluate(() => window.scrollBy(0, 700));
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: "C:/Users/leete/AppData/Local/Temp/sc_build_runes.png" });
await browser.close();
console.log("Done");