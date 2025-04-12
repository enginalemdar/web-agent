const express = require("express");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

app.post("/crawl", async (req, res) => {
  const { keyword, webhook, ajans_id = "", status = "", il_id = "" } = req.body;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    const query = encodeURIComponent(keyword || "");
    const ajans = encodeURIComponent(ajans_id);
    const durum = encodeURIComponent(status);
    const il = encodeURIComponent(il_id);

    const url = `https://www.yatirimadestek.gov.tr/arama?q=${query}&ajans_id=${ajans}&status=${durum}&il_id=${il}`;
    console.log(`🔍 Navigating to: ${url}`);

    await page.goto(url, { waitUntil: "networkidle2" });
    await page.waitForSelector(".arama-sonuclar .item", { timeout: 20000 });

    const results = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".arama-sonuclar .item")).map((item) => {
        const title = item.querySelector(".baslik a")?.innerText?.trim() || "";
        const url = item.querySelector(".baslik a")?.href || "";
        const status = item.querySelector(".aktifCont .desc")?.innerText?.trim() || "";

        const pdfs = Array.from(item.querySelectorAll(".file-list .file-item a")).map((a) => ({
          name: a.querySelector(".file-desc")?.innerText?.trim() || "",
          url: a.href
        }));

        return { title, url, status, pdfs };
      });
    });

    await browser.close();

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
