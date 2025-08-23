const puppeteer = require('puppeteer');

async function scrape(siteKey, config) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    try {
        await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 30000 });

        if (config.waitForSelector) {
            await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
        }

        const selectors = config.selectors;
        const items = await page.$$eval(selectors.product, (els, selectors) => {
            return els.map(el => {
                const titleEl = el.querySelector(selectors.title);
                const descEl = el.querySelector(selectors.description);
                const valueEl = el.querySelector(selectors.value);
                const entriesEl = el.querySelector(selectors.entries_count);
                const timeLeftEl = el.querySelector(selectors.time_left);

                return {
                    title: titleEl ? titleEl.innerText.trim() : null,
                    description: descEl ? descEl.innerText.trim() : null,
                    value: valueEl ? valueEl.innerText.trim() : null,
                    entries_count: entriesEl ? entriesEl.innerText.trim() : null,
                    time_left: timeLeftEl ? timeLeftEl.innerText.trim() : null,
                };
            });
        }, selectors);

        await browser.close();
        return items;

    } catch (error) {
        console.error(`Erreur de scraping pour ${siteKey}: ${error.message}`);
        await browser.close();
        return [];
    }
}

if (require.main === module) {
    const siteKey = process.argv[2];
    const config = JSON.parse(process.argv[3]);

    scrape(siteKey, config)
        .then(data => {
            console.log(JSON.stringify(data, null, 2));
        })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
