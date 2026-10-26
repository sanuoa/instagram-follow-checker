import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("packaged extension opens its own tab and compares local files without host permissions", async () => {
  const profile = await mkdtemp(
    path.join(tmpdir(), "follow-checker-extension-"),
  );
  const extension = path.join(root, "dist-extension");
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      ignoreDefaultArgs: ["--disable-extensions"],
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
    const worker =
      context.serviceWorkers()[0] ??
      (await context
        .waitForEvent("serviceworker", { timeout: 10_000 })
        .catch(() => {
          throw new Error(
            "Extension did not load. Check whether your browser administrator blocks unpacked extensions; use a personal browser profile with extension installation allowed.",
          );
        }));
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toBeUndefined();
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();

    const requests = [];
    context.on("request", (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    // Invoke the same function registered for toolbar clicks, in the actual
    // extension service worker. This checks the real chrome.tabs API as well.
    const opened = context.waitForEvent("page");
    await worker.evaluate(() => openChecker());
    const page = await opened;
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForURL(/chrome-extension:\/\/.*\/index\.html/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Compare accounts", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Import Instagram JSON files")
      .setInputFiles([
        path.join(root, "tests/fixtures/followers_1.json"),
        path.join(root, "tests/fixtures/followers_2.json"),
        path.join(root, "tests/fixtures/following.json"),
      ]);
    await page
      .getByRole("button", { name: "Compare accounts", exact: true })
      .click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr")).toContainText("@bob");
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const csv = await readFile(await (await pending).path(), "utf8");
    expect(csv).toContain('"bob","https://www.instagram.com/bob/"');
    await page.getByRole("button", { name: /I do not follow back/ }).click();
    await expect(page.locator("tbody tr")).toContainText("@david");
    await page.getByRole("button", { name: /Mutual follows/ }).click();
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Your connection report" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Compare accounts", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Try a demo" }).click();
    await expect(page.locator("tbody tr")).toContainText("@bob");
    await page.getByRole("button", { name: "Clear all data" }).click();
    await expect(
      page.getByRole("heading", { name: "Your connection report" }),
    ).toHaveCount(0);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("ZIP contains only the installable app and extension assets", async () => {
  const files = unzipSync(
    await readFile(path.join(root, "instagram-follow-checker-extension.zip")),
  );
  expect(Object.keys(files)).toContain("manifest.json");
  expect(Object.keys(files)).toContain("index.html");
  expect(Object.keys(files)).toContain("background.js");
  const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toBeUndefined();
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest.content_scripts).toBeUndefined();
  expect(manifest.content_security_policy.extension_pages).toContain(
    "connect-src 'none'",
  );
  for (const size of [16, 32, 48, 128])
    expect(Object.keys(files)).toContain(`icons/icon-${size}.png`);
  expect(
    Object.keys(files).every((name) =>
      /^(assets\/|icons\/|index\.html$|manifest\.json$|background\.js$|favicon\.svg$)/.test(
        name,
      ),
    ),
  ).toBe(true);
});
