import { expect, test } from "@playwright/test";

test("renders the address-search experience", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Transit Home Finder/);
  await expect(page.getByRole("heading", { name: "Find an apartment or address" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search an address" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
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
