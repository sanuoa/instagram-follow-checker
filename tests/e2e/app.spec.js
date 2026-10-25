import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const fixture = (name) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const upload = (name, data) => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(data)),
});
const followerInput = (page) => page.getByLabel("Import followers JSON files");
const followingInput = (page) => page.getByLabel("Import following JSON file");
const compareButton = (page) =>
  page.getByRole("button", { name: "Compare accounts", exact: true });
const resultRows = (page) => page.locator("tbody tr");

test("split imports, acceptance results, search, sorting, CSV, clearing, and privacy", async ({
  page,
}) => {
  const externalRequests = [];
  const errors = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4173/"))
      externalRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(compareButton(page)).toBeDisabled();
  await followerInput(page).setInputFiles([
    fixture("followers_1.json"),
    fixture("followers_2.json"),
  ]);
  await followingInput(page).setInputFiles(fixture("following.json"));
  await expect(
    page.getByText("3 unique followers", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 duplicate username removed.")).toBeVisible();
  await compareButton(page).click();
  await expect(resultRows(page)).toHaveCount(1);
  await expect(resultRows(page).first()).toContainText("@bob");
  await expect(
    page.getByRole("link", { name: "Open @bob on Instagram (new tab)" }),
  ).toHaveAttribute("href", "https://www.instagram.com/bob/");
  await expect(
    page.getByRole("link", { name: "Open @bob on Instagram (new tab)" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: /I do not follow back/ }).click();
  await expect(resultRows(page).first()).toContainText("@david");
  await page.getByRole("button", { name: /Mutual follows/ }).click();
  await expect(resultRows(page)).toHaveCount(2);
  await expect(resultRows(page).first()).toContainText("@alice");
  await page.getByLabel("Sort usernames").selectOption("desc");
  await expect(resultRows(page).first()).toContainText("@charlie");
  await page.getByRole("searchbox", { name: "Search usernames" }).fill("@AL");
  await expect(resultRows(page)).toHaveCount(1);
  await expect(resultRows(page).first()).toContainText("@alice");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain('"alice","https://www.instagram.com/alice/"');
  expect(csv).not.toContain("charlie");
  await page.getByRole("searchbox").fill("no_match_here");
  await expect(page.getByText("No matching usernames")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  await page.getByRole("button", { name: "Clear all data" }).click();
  await expect(
    page.getByRole("heading", { name: "Your connection report" }),
  ).toHaveCount(0);
  await expect(compareButton(page)).toBeDisabled();
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
    })),
  ).toEqual({ local: 0, session: 0, cookies: "" });
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("demo data is replaced by personal imports, invalid batches block results, reload clears data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page.getByText("Fictional demo", { exact: true })).toBeVisible();
  await followerInput(page).setInputFiles(fixture("followers_1.json"));
  await expect(
    page.getByRole("heading", { name: "Your connection report" }),
  ).toHaveCount(0);
  await expect(compareButton(page)).toBeDisabled();
  await followingInput(page).setInputFiles(fixture("following.json"));
  await expect(compareButton(page)).toBeEnabled();
  await compareButton(page).click();
  await expect(
    page.getByText("Comparison complete", { exact: true }),
  ).toBeVisible();
  await followerInput(page).setInputFiles([
    upload(
      "followers_1.json",
      JSON.parse(await readFile(fixture("followers_1.json"), "utf8")),
    ),
    upload("unrelated.json", { messages: [] }),
  ]);
  await expect(page.getByRole("alert")).toContainText(
    "unrelated.json: Unsupported followers structure",
  );
  await expect(compareButton(page)).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Your connection report" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("3 unique following")).toHaveCount(0);
  await expect(compareButton(page)).toBeDisabled();
});

test("valid empty lists can be compared; malformed JSON gets a helpful error", async ({
  page,
}) => {
  await page.goto("/");
  await followerInput(page).setInputFiles(upload("followers.json", []));
  await followingInput(page).setInputFiles(
    upload("following.json", { relationships_following: [] }),
  );
  await expect(compareButton(page)).toBeEnabled();
  await compareButton(page).click();
  await expect(page.getByText("No accounts in this category")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  await followerInput(page).setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await expect(compareButton(page)).toBeDisabled();
});

test("skipped records are reported; untrusted values and hrefs are never used as links", async ({
  page,
}) => {
  await page.goto("/");
  await followerInput(page).setInputFiles(
    upload("followers.json", [
      {
        string_list_data: [
          { value: "alice", href: "https://evil.example/payload" },
        ],
      },
      { string_list_data: [{ value: "<script>alert(1)</script>" }] },
      { string_map_data: { Username: { value: "invented" } } },
    ]),
  );
  await followingInput(page).setInputFiles(
    upload("following.json", { relationships_following: [] }),
  );
  await expect(
    page.getByText(/2 skipped records · 1 invalid username entries/),
  ).toBeVisible();
  await page.getByText("Review files and skipped records").click();
  await expect(page.getByText(/Record 2: Skipped an invalid/)).toBeVisible();
  await compareButton(page).click();
  await page.getByRole("button", { name: /I do not follow back/ }).click();
  await expect(resultRows(page)).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Open @alice on Instagram (new tab)" }),
  ).toHaveAttribute("href", "https://www.instagram.com/alice/");
});

test("pagination limits rendered rows while CSV contains all filtered results", async ({
  page,
}) => {
  await page.goto("/");
  const records = Array.from({ length: 123 }, (_, index) => ({
    string_list_data: [{ value: `demo_${String(index).padStart(3, "0")}` }],
  }));
  await followerInput(page).setInputFiles(upload("followers.json", []));
  await followingInput(page).setInputFiles(
    upload("following.json", { relationships_following: records }),
  );
  await expect(compareButton(page)).toBeEnabled();
  await compareButton(page).click();
  await expect(resultRows(page)).toHaveCount(50);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(resultRows(page).first()).toContainText("@demo_050");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csv = await readFile(await (await downloadPromise).path(), "utf8");
  expect(csv.trim().split("\r\n")).toHaveLength(124);
  await page.getByRole("searchbox").fill("demo_12");
  await expect(resultRows(page)).toHaveCount(3);
  await expect(resultRows(page).first()).toContainText("@demo_120");
});

test("clear cancels stale import results and small screens do not overflow", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise((resolve) => {
        window.releaseFileRead = resolve;
      });
      return original.call(this);
    };
  });
  await page.goto("/");
  await followerInput(page).setInputFiles(fixture("followers_1.json"));
  await expect(page.getByText("Reading files locally…")).toBeVisible();
  await page.getByRole("button", { name: "Clear all data" }).click();
  await page.evaluate(async () => {
    window.releaseFileRead();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await expect(page.getByText("2 unique followers")).toHaveCount(0);
  await expect(compareButton(page)).toBeDisabled();
  await page.getByRole("button", { name: "Try a demo" }).click();
  const sizes = await page.evaluate(() => ({
    viewport: innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport);
  if (test.info().project.name === "desktop")
    await page.screenshot({
      path: "test-results/dashboard-desktop.png",
      fullPage: true,
    });
  if (test.info().project.name === "mobile")
    await page.screenshot({
      path: "test-results/dashboard-mobile.png",
      fullPage: true,
    });
});

test("loading the demo again resets result filters", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a demo" }).click();
  await page.getByRole("searchbox").fill("no_match");
  await expect(page.getByText("No matching usernames")).toBeVisible();
  await page.getByRole("button", { name: "Try a demo" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(resultRows(page).first()).toContainText("@bob");
});
