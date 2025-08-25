const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const PORT = 3000;

app.post('/scrape', async (req, res) => {
    const { siteKey, siteConfig, config } = req.body;

    if (!siteKey || !siteConfig || !config) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath(),
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        await page.goto(siteConfig.url, { waitUntil: 'networkidle2' });

        const items = await page.evaluate((siteConfig) => {
            const results = [];
            const itemSelector = siteConfig.selectors.item;
            const titleSelector = siteConfig.selectors.title;
            const urlSelector = siteConfig.selectors.url;
            const valueSelector = siteConfig.selectors.value;
            const entriesCountSelector = siteConfig.selectors.entries_count;
            const timeLeftSelector = site.selectors.time_left;

            document.querySelectorAll(itemSelector).forEach(el => {
                results.push({
                    title: el.querySelector(titleSelector)?.innerText,
                    url: el.querySelector(urlSelector)?.href,
                    value: el.querySelector(valueSelector)?.innerText,
                    entries_count: el.querySelector(entriesCountSelector)?.innerText,
                    time_left: el.querySelector(timeLeftSelector)?.innerText
                });
            });
            return results;
        }, siteConfig);

        await browser.close();

        res.json(items);
    } catch (error) {
        console.error(`Error scraping ${siteKey}:`, error);
        res.status(500).json({ error: `Failed to scrape ${siteKey}` });
    }
});

app.listen(PORT, () => {
    console.log(`Scraper server listening on port ${PORT}`);
});
