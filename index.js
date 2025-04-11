const express = require("express");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

app.post("/crawl", async (req, res) => {
  const { keyword, webhook } = req.body;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.yatirimadestek.gov.tr/arama");

  await page.type("#aranan", keyword);
  await Promise.all([
    page.keyboard.press("Enter"),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  const results = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".search-result-item"));
    return items.slice(0, 3).map((item) => ({
      title: item.querySelector("h5")?.innerText || "",
      link: item.querySelector("a")?.href || "",
      summary: item.querySelector("p")?.innerText || "",
    }));
  });

  await browser.close();

  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, results }),
  });

  res.json({ status: "ok", keyword });
});

app.listen(3000);
