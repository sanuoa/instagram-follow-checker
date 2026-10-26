import { test, expect, chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

test("packaged app imports and downloads CSV under extension CSP", async () => {
  const root = new URL("../../", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("dist-extension/manifest.json", root), "utf8"),
  );
  const browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.cspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) =>
        window.cspViolations.push(event.violatedDirective),
      );
    });
    await page.route("http://127.0.0.1:4180/**", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "content-security-policy":
            manifest.content_security_policy.extension_pages,
        },
      });
    });
    await page.goto("http://127.0.0.1:4180/");
    await page
      .getByLabel("Import Instagram JSON files")
      .setInputFiles([
        fileURLToPath(new URL("tests/fixtures/followers_1.json", root)),
        fileURLToPath(new URL("tests/fixtures/followers_2.json", root)),
        fileURLToPath(new URL("tests/fixtures/following.json", root)),
      ]);
    await page
      .getByRole("button", { name: "Compare accounts", exact: true })
      .click();
    await expect(page.locator("tbody tr")).toContainText("@bob");
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    expect(await readFile(await (await pending).path(), "utf8")).toContain(
      '"bob","https://www.instagram.com/bob/"',
    );
    await page.getByRole("button", { name: /Mutual follows/ }).click();
    await expect(page.locator("tbody tr")).toHaveCount(2);
    expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Compare accounts", exact: true }),
    ).toBeDisabled();
    expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  } finally {
    await browser.close();
  }
});
