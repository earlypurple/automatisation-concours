const puppeteer = require('puppeteer');
const https = require('https');

// --- NOUVELLE STRUCTURE DE GESTION DES CAPTCHA ---

async function handleCaptcha(page, config, log) {
    const captchaConfig = config.captcha_solver;
    if (!captchaConfig || !captchaConfig.enabled) {
        log('info', 'Solveur de CAPTCHA désactivé.');
        // Vérification rapide de la présence de n'importe quel type de captcha connu
        const hasCaptcha = await page.$('.g-recaptcha, .h-captcha, img[src*="captcha"]');
        return !hasCaptcha;
    }

    // Détection du type de CAPTCHA
    const recaptchaV2 = await page.$('.g-recaptcha');
    if (recaptchaV2) {
        log('info', 'reCAPTCHA V2 détecté.');
        return await solveRecaptchaV2(page, captchaConfig, recaptchaV2, log);
    }

    const hCaptcha = await page.$('.h-captcha');
    if (hCaptcha) {
        log('info', 'hCaptcha détecté.');
        return await solveHCaptcha(page, captchaConfig, hCaptcha, log);
    }

    const imageCaptcha = await page.$('img[src*="captcha"]');
    if (imageCaptcha) {
        log('info', 'Image CAPTCHA détectée.');
        return await solveImageCaptcha(page, captchaConfig, imageCaptcha, log);
    }

    log('info', 'Aucun CAPTCHA connu détecté.');
    return true;
}

async function solveRecaptchaV2(page, captchaConfig, element, log) {
    log('info', 'Démarrage de la résolution reCAPTCHA V2...');
    const sitekey = await page.evaluate(el => el.getAttribute('data-sitekey'), element);
    if (!sitekey) throw new Error('Impossible de trouver le sitekey du reCAPTCHA.');

    const params = `method=userrecaptcha&googlekey=${sitekey}`;
    const token = await solveWith2Captcha(captchaConfig.api_key, page.url(), params, log);

    await page.evaluate((token) => {
        const textarea = document.querySelector('textarea[name="g-recaptcha-response"]');
        if (textarea) textarea.value = token;
    }, token);

    log('info', 'Token reCAPTCHA V2 injecté.');
    return true;
}

async function solveHCaptcha(page, captchaConfig, element, log) {
    log('info', 'Démarrage de la résolution hCaptcha...');
    const sitekey = await page.evaluate(el => el.getAttribute('data-sitekey'), element);
    if (!sitekey) throw new Error('Impossible de trouver le sitekey du hCaptcha.');

    const params = `method=hcaptcha&sitekey=${sitekey}`;
    const token = await solveWith2Captcha(captchaConfig.api_key, page.url(), params, log);

    // hCaptcha injecte souvent le token dans plusieurs champs
    await page.evaluate((token) => {
        document.querySelectorAll('textarea[name^="h-captcha"], input[name^="h-captcha"]').forEach(el => {
            el.value = token;
        });
    }, token);

    log('info', 'Token hCaptcha injecté.');
    return true;
}

async function solveImageCaptcha(page, captchaConfig, element, log) {
    log('info', 'Démarrage de la résolution Image CAPTCHA...');

    // Obtenir l'image en base64
    const imageBase64 = await page.evaluate(async (el) => {
        const response = await fetch(el.src);
        const buffer = await response.arrayBuffer();
        const b64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        return `data:image/jpeg;base64,${b64}`;
    }, element);

    const params = `method=base64&body=${encodeURIComponent(imageBase64)}`;
    const text = await solveWith2Captcha(captchaConfig.api_key, page.url(), params, log);

    // Trouver le champ de saisie associé et y taper le texte
    // Cette partie est très dépendante du site, on utilise une heuristique
    await page.evaluate((text) => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
        // Chercher un input proche de l'image ou avec un label "captcha"
        let captchaInput = inputs.find(i => i.name.toLowerCase().includes('captcha') || i.id.toLowerCase().includes('captcha'));
        if (captchaInput) {
            captchaInput.value = text;
        } else {
            // Si pas trouvé, on suppose que c'est le dernier input texte avant un bouton submit
            // (logique à améliorer si nécessaire)
            const submitButton = document.querySelector('button[type="submit"], input[type="submit"]');
            if(submitButton){
                const allInputs = Array.from(document.querySelectorAll('input, button'));
                const submitIndex = allInputs.indexOf(submitButton);
                const textInputsBefore = allInputs.slice(0, submitIndex).filter(el => el.tagName === 'INPUT' && el.type === 'text');
                if(textInputsBefore.length > 0){
                    textInputsBefore[textInputsBefore.length-1].value = text;
                }
            }
        }
    }, text);

    log('info', `Texte du CAPTCHA Image injecté: "${text}"`);
    return true;
}


function solveWith2Captcha(apiKey, pageUrl, params, log) {
    return new Promise(async (resolve, reject) => {
        if (!apiKey) return reject(new Error('Clé API du solveur de CAPTCHA non configurée.'));

        // 1. Envoyer la demande de résolution
        const requestUrl = `https://2captcha.com/in.php?key=${apiKey}&${params}&pageurl=${pageUrl}&json=1`;
        let requestId;
        try {
            requestId = await makeRequest(requestUrl);
            log('info', `CAPTCHA soumis au solveur. ID de la demande : ${requestId}`);
        } catch (error) {
            return reject(error);
        }

        // 2. Attendre le résultat
        const resultUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${requestId}&json=1`;
        const maxAttempts = 20;
        let attempt = 0;

        const interval = setInterval(async () => {
            if (attempt++ >= maxAttempts) {
                clearInterval(interval);
                return reject(new Error('Le solveur de CAPTCHA a mis trop de temps à répondre.'));
            }

            log('info', `Tentative de récupération de la solution (${attempt}/${maxAttempts})...`);
            try {
                const responseText = await makeRequest(resultUrl);
                const response = JSON.parse(responseText);
                if (response.status === 1) {
                    clearInterval(interval);
                    log('info', 'Solution CAPTCHA reçue !');
                    resolve(response.request);
                } else if (response.request !== 'CAPCHA_NOT_READY') {
                    clearInterval(interval);
                    reject(new Error(`Erreur de l'API 2Captcha : ${response.request}`));
                }
            } catch (error) {
                 clearInterval(interval);
                 reject(error);
            }
        }, 5000);
    });
}

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                     if (response.status !== 1 && response.request !== 'CAPCHA_NOT_READY') {
                        return reject(new Error(`Erreur de l'API 2Captcha : ${response.request}`));
                    }
                    resolve(response.status === 1 ? response.request : data);
                } catch(e) {
                    // Si la réponse n'est pas du JSON valide mais contient CAPCHA_NOT_READY
                    if(data.includes('CAPCHA_NOT_READY')) {
                        resolve(data);
                    } else {
                        reject(new Error(`Réponse invalide de 2Captcha: ${data}`));
                    }
                }
            });
        }).on('error', (err) => reject(err));
    });
}

async function fillForm(url, userData, config = {}) {
    let browser;
    const headless = config.puppeteer ? config.puppeteer.headless !== false : true;
    const logLevel = config.puppeteer ? config.puppeteer.log_level || 'info' : 'info';
    const proxyConfig = config.proxies;

    const log = (level, message) => {
        if (logLevel === 'debug' || (logLevel === 'info' && level !== 'debug')) {
            console.error(`[${level.toUpperCase()}] ${message}`);
        }
    };

    try {
        const launchOptions = {
            headless,
            args: []
        };
        let proxy = null;

        if (proxyConfig && proxyConfig.enabled && proxyConfig.list && proxyConfig.list.length > 0) {
            if (proxyConfig.rotation_mode === 'random') {
                proxy = proxyConfig.list[Math.floor(Math.random() * proxyConfig.list.length)];
            }

            if (proxy) {
                const proxyUrl = new URL(proxy);
                launchOptions.args.push(`--proxy-server=${proxyUrl.host}`);
                log('info', `Utilisation du proxy : ${proxyUrl.host}`);
            }
        }

        log('info', `Lancement de Puppeteer (headless: ${headless})`);
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        if (proxy) {
            const proxyUrl = new URL(proxy);
            if (proxyUrl.username && proxyUrl.password) {
                await page.authenticate({
                    username: proxyUrl.username,
                    password: proxyUrl.password
                });
                log('info', 'Authentification auprès du proxy effectuée.');
            }
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
