const puppeteer = require('puppeteer');
const https = require('https');

async function handleCaptcha(page, config, log) {
    const captchaConfig = config.captcha_solver;
    if (!captchaConfig || !captchaConfig.enabled) {
        log('info', 'Solveur de CAPTCHA désactivé.');
        const hasCaptcha = await page.$('.g-recaptcha');
        return !hasCaptcha; // Continuer seulement si aucun CAPTCHA n'est présent
    }

    const recaptcha = await page.$('.g-recaptcha');
    if (!recaptcha) {
        log('info', 'Aucun reCAPTCHA V2 détecté.');
        return true;
    }

    log('info', 'reCAPTCHA V2 détecté. Démarrage de la résolution...');
    const sitekey = await page.evaluate(el => el.getAttribute('data-sitekey'), recaptcha);
    if (!sitekey) throw new Error('Impossible de trouver le sitekey du reCAPTCHA.');

    const apiKey = captchaConfig.api_key;
    if (!apiKey) throw new Error('Clé API du solveur de CAPTCHA non configurée.');

    // 1. Envoyer la demande de résolution
    const requestId = await requestCaptcha(apiKey, sitekey, page.url(), log);
    log('info', `CAPTCHA soumis au solveur. ID de la demande : ${requestId}`);

    // 2. Attendre le résultat
    await page.waitForTimeout(15000); // Attente initiale de 15s
    const token = await pollForResult(apiKey, requestId, log);
    log('info', 'Token CAPTCHA reçu !');

    // 3. Injecter le token
    await page.evaluate((token) => {
        const textarea = document.querySelector('textarea[name="g-recaptcha-response"]');
        if (textarea) textarea.value = token;
    }, token);

    log('info', 'Token injecté dans la page.');
    return true;
}

function requestCaptcha(apiKey, sitekey, pageUrl, log) {
    return new Promise((resolve, reject) => {
        const url = `https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${sitekey}&pageurl=${pageUrl}&json=1`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const response = JSON.parse(data);
                if (response.status !== 1) {
                    return reject(new Error(`Erreur de l'API 2Captcha : ${response.request}`));
                }
                resolve(response.request);
            });
        }).on('error', (err) => reject(err));
    });
}

function pollForResult(apiKey, requestId, log) {
    return new Promise((resolve, reject) => {
        const url = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${requestId}&json=1`;
        const maxAttempts = 20;
        let attempt = 0;

        const interval = setInterval(() => {
            if (attempt++ >= maxAttempts) {
                clearInterval(interval);
                return reject(new Error('Le solveur de CAPTCHA a mis trop de temps à répondre.'));
            }

            log('info', `Tentative de récupération du token CAPTCHA (${attempt}/${maxAttempts})...`);
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    const response = JSON.parse(data);
                    if (response.status === 1) {
                        clearInterval(interval);
                        resolve(response.request);
                    } else if (response.request !== 'CAPCHA_NOT_READY') {
                        clearInterval(interval);
                        reject(new Error(`Erreur de l'API 2Captcha : ${response.request}`));
                    }
                });
            }).on('error', (err) => {
                clearInterval(interval);
                reject(err);
            });
        }, 5000); // Poll every 5 seconds
    });
}

async function fillForm(url, userData, config = {}) {
    let browser;
    const headless = config.headless !== false; // default to true
    const logLevel = config.log_level || 'info';
    const proxy = config.proxy;

    const log = (level, message) => {
        if (logLevel === 'debug' || (logLevel === 'info' && level !== 'debug')) {
            // Use console.error for logs to ensure they are captured by the Python subprocess stderr
            console.error(`[${level.toUpperCase()}] ${message}`);
        }
    };

    try {
        const launchOptions = {
            headless,
            args: []
        };

        if (proxy && proxy.server) {
            launchOptions.args.push(`--proxy-server=${proxy.server}`);
            log('info', `Utilisation du proxy : ${proxy.server}`);
        }

        log('info', `Lancement de Puppeteer (headless: ${headless})`);
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        if (proxy && proxy.username && proxy.password) {
            await page.authenticate({
                username: proxy.username,
                password: proxy.password
            });
            log('info', 'Authentification auprès du proxy effectuée.');
        }

        log('info', `Navigation vers ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Gestion du CAPTCHA
        const canContinue = await handleCaptcha(page, config, log);
        if (!canContinue) {
            throw new Error('Un CAPTCHA a été détecté et n\'a pas pu être résolu.');
        }

        // More advanced field detection
        await fillField(page, ['input[name*="name" i]', 'input[placeholder*="name" i]', 'input[aria-label*="name" i]'], userData.name);
        await fillField(page, ['input[name*="email" i]', 'input[placeholder*="email" i]', 'input[aria-label*="email" i]'], userData.email);
        await fillField(page, ['input[name*="phone" i]', 'input[placeholder*="phone" i]', 'input[aria-label*="phone" i]'], userData.phone);
        await fillField(page, ['input[name*="address" i]', 'input[placeholder*="address" i]', 'input[aria-label*="address" i]'], userData.address);

        // Try to find and click a submit button
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            const submitButton = buttons.find(btn => {
                const text = (btn.innerText || btn.value || '').toLowerCase();
                return text.includes('submit') || text.includes('register') || text.includes('send') || text.includes('participate');
            });
            if (submitButton) {
                submitButton.click();
            } else {
                throw new Error('Could not find a submit button.');
            }
        });

        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        const result = { success: true, message: `Form submitted successfully on ${url}` };
        // The final output must be a JSON string to stdout for the Python script to capture it.
        console.log(JSON.stringify(result));
        return result;

    } catch (error) {
        const errorMessage = `Erreur lors du remplissage du formulaire sur ${url}: ${error.message}`;
        log('error', errorMessage);
        // The final output must be a JSON string to stdout for the Python script to capture it.
        console.log(JSON.stringify({ success: false, error: errorMessage }));
        // In case of a crash before the final console.log, we need to exit to avoid hanging.
        process.exit(1);

    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function fillField(page, selectors, value) {
    if (!value) return;
    for (const selector of selectors) {
        try {
            await page.type(selector, value, { delay: 50 });
            return; // Field filled, exit
        } catch (error) {
            // Selector not found, try the next one
        }
    }
    console.error(`[WARN] Impossible de trouver un champ pour la valeur : ${value}`);
}

// This allows the script to be called from the command line.
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log(JSON.stringify({ success: false, error: 'Usage: node form_filler.js <url> <userData> [config]' }));
        process.exit(1);
    }
    const url = JSON.parse(args[0]);
    const userData = JSON.parse(args[1]);
    const config = args[2] ? JSON.parse(args[2]) : {};

    fillForm(url, userData, config);
}


module.exports = { fillForm };
