const express = require("express");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

app.post("/crawl", async (req, res) => {
  const { keyword, webhook } = req.body;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // Doğrudan arama sonuç sayfasına git
    const query = encodeURIComponent(keyword);
    await page.goto(`https://www.yatirimadestek.gov.tr/arama?q=${query}`, {
      waitUntil: "networkidle2"
    });

    // Sayfa JS ile yükleniyor, destek blokları gelene kadar bekle
    await page.waitForSelector(".destek-item", { timeout: 15000 });

    // Sonuçları topla
    const results = await page.evaluate(() => {
      const blocks = document.querySelectorAll(".destek-item");

      return Array.from(blocks).map((block) => ({
        title: block.querySelector("h3")?.innerText || "",
        summary: block.querySelector(".ozet")?.innerText || "",
        status: block.querySelector(".durum")?.innerText || "",
        pdfs: Array.from(block.querySelectorAll("a[href$='.pdf']")).map(a => ({
          name: a.innerText.trim(),
          url: a.href
        }))
      }));
    });

    await browser.close();

    // Webhook'a POST et
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, resultCount: results.length, results })
    });

    res.json({ status: "done", keyword, count: results.length });
  } catch (error) {
    console.error("Crawler error:", error);
    res.status(500).json({ error: "Crawler failed", detail: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Agent is running. POST to /crawl");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Web agent live on port ${port}`));
