import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(err.message))

        filepath = os.path.abspath("site/index.html")
        await page.goto(f"file://{filepath}")

        await page.wait_for_timeout(2000)

        if errors:
            print("Console errors found:")
            for error in errors:
                print(f"- {error}")
        else:
            print("No console errors found.")

        # Check for elements
        load_more_wrap = await page.query_selector("#load-more-wrap")
        load_more_btn = await page.query_selector("#load-more-btn")

        print(f"load-more-wrap exists: {load_more_wrap is not None}")
        print(f"load-more-btn exists: {load_more_btn is not None}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
