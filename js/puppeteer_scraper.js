const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

async function scrape(siteKey, siteConfig, globalConfig) {
    const proxyConfig = globalConfig.proxies;
    const launchOptions = {
        headless: true,
        args: []
    };
    let proxy = null;

    if (proxyConfig && proxyConfig.enabled && proxyConfig.list && proxyConfig.list.length > 0) {
        if (proxyConfig.rotation_mode === 'random') {
            proxy = proxyConfig.list[Math.floor(Math.random() * proxyConfig.list.length)];
        }
        // On pourrait ajouter un mode 'sequential' ici plus tard

        if (proxy) {
            const proxyUrl = new URL(proxy);
            launchOptions.args.push(`--proxy-server=${proxyUrl.host}`);
        }
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (proxy) {
        const proxyUrl = new URL(proxy);
        if (proxyUrl.username && proxyUrl.password) {
            await page.authenticate({
                username: proxyUrl.username,
                password: proxyUrl.password
            });
        }
    }

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    try {
        await page.goto(siteConfig.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Stratégie d'attente améliorée
        if (siteConfig.waitForSelector) {
            await page.waitForSelector(siteConfig.waitForSelector, { timeout: 15000 });
        } else {
            // Fallback: attendre un peu que le JS se charge s'il n'y a pas de sélecteur spécifique
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const selectors = siteConfig.selectors;
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
        const debugDir = path.join(__dirname, '..', 'debug');
        if (!fs.existsSync(debugDir)){
            fs.mkdirSync(debugDir);
        }
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = path.join(debugDir, `${siteKey}-${timestamp}-error.png`);
        const htmlPath = path.join(debugDir, `${siteKey}-${timestamp}-error.html`);

        await page.screenshot({ path: screenshotPath });
        const html = await page.content();
        fs.writeFileSync(htmlPath, html);

        console.error(`Erreur de scraping pour ${siteKey}: ${error.message}. Une capture d'écran et le HTML ont été sauvegardés dans le dossier 'debug'.`);
        await browser.close();
        return [];
    }
}

if (require.main === module) {
    const siteKey = process.argv[2];
    const siteConfig = JSON.parse(process.argv[3]);
    const globalConfig = JSON.parse(process.argv[4]);

    scrape(siteKey, siteConfig, globalConfig)
        .then(data => {
            console.log(JSON.stringify(data, null, 2));
        })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
