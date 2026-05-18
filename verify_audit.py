import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        # Start local server
        os.system("npx http-server . -p 3000 > /dev/null 2>&1 &")
        await asyncio.sleep(3)

        base_url = "http://localhost:3000"

        # 1. Home
        await page.goto(f"{base_url}/index.html")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="screenshot_home.png")

        # 2. Lobby (Multi)
        await page.goto(f"{base_url}/tetris-multi.html")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="screenshot_multi_lobby.png")

        # 3. AI League
        await page.goto(f"{base_url}/ai-battle.html")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="screenshot_ai_league.png")

        # 4. Sprint
        await page.goto(f"{base_url}/sprint.html")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="screenshot_sprint.png")

        # 5. Admin
        await page.goto(f"{base_url}/admin.html")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="screenshot_admin.png")

        # Get some performance metrics
        metrics = await page.evaluate("() => JSON.stringify(window.performance.getEntries())")
        with open("perf_metrics.json", "w") as f:
            f.write(metrics)

        await browser.close()
        os.system("kill $(lsof -t -i :3000)")

if __name__ == "__main__":
    asyncio.run(main())
