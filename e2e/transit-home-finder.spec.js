import { expect, test } from "@playwright/test";

test("renders the desktop map workspace and address search", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await expect(page).toHaveTitle(/Transit Home Finder/);
  await expect(page.getByRole("heading", { name: "Find an address" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search an address" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();

  const sidebarBox = await page.locator("main > aside").boundingBox();
  const mapBox = await page.getByLabel("Transit map").boundingBox();

  expect(sidebarBox?.width).toBe(400);
  expect(mapBox?.x).toBe(400);
  expect(mapBox?.width).toBe(880);
});

test("rejects invalid nearby-stop coordinates", async ({ request }) => {
  const response = await request.get("/api/transit/stops/nearby?lat=not-a-number&lng=-96.8");

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: "Valid lat and lng are required" });
});

test("serves nearby stops from the deterministic JSON data source", async ({ request }) => {
  const response = await request.get(
    "/api/transit/stops/nearby?lat=32.7767&lng=-96.7970&radiusMiles=1",
  );
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.dataSource).toBe("local-json");
  expect(Array.isArray(body.stops)).toBe(true);
});
