import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        def log_console(msg):
            print(f"Browser console: {msg.text}")

        page.on("console", log_console)

        await page.goto("http://localhost:3000")
        await page.wait_for_timeout(5000)  # Wait for 5 seconds
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
