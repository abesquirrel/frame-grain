import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Listen for console errors
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(err.message))

        # We need a web server to serve the file
        # Or we can use file:// protocol but some features might be restricted
        filepath = os.path.abspath("site/index.html")
        await page.goto(f"file://{filepath}")

        # Wait for some time to let JS run
        await page.wait_for_timeout(2000)

        if errors:
            print("Console errors found:")
            for error in errors:
                print(f"- {error}")
        else:
            print("No console errors found.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
