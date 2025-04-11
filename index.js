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
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://www.yatirimadestek.gov.tr/arama", {
      waitUntil: "networkidle2",
    });

    // Doğru input alanını bekle ve yaz
    await page.waitForSelector("input.homeSearchInput", { timeout: 10000 });
    await page.type("input.homeSearchInput", keyword);

    // "ARA" butonuna tıkla
    await Promise.all([
      page.click("div.button > a"),
      page.waitForNavigation({ waitUntil: "networkidle2" }),
    ]);

    // Sonuçları topla
    const results = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll(".search-result-item"));
      return items.slice(0, 3).map((item) => ({
        title: item.querySelector("h5")?.innerText || "",
        summary: item.querySelector("p")?.innerText || "",
        link: item.querySelector("a")?.href || "",
      }));
    });

    await browser.close();

    // Webhook'a gönder
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, results }),
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
