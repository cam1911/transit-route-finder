import { expect, test } from "@playwright/test";

test("renders the desktop map workspace and address search", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await expect(page).toHaveTitle(/Dallas Transit Nearby/);
  await expect(page.getByRole("heading", { name: "Find transit near a Dallas address" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search a Dallas address" })).toBeVisible();
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

test("preserves the legacy nearby-route coordinate error", async ({ request }) => {
  const response = await request.get("/api/transit/nearby?lat=not-a-number&lng=-96.8");

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: "lat and lng are required" });
});

for (const endpoint of ["/api/transit/stops/nearby", "/api/transit/nearby"]) {
  test(`rejects an invalid radius at ${endpoint}`, async ({ request }) => {
    const response = await request.get(`${endpoint}?lat=32.7767&lng=-96.7970&radiusMiles=26`);

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "radiusMiles must be between 0 and 25" });
  });
}

test("serves nearby stops from the deterministic JSON data source", async ({ request }) => {
  const response = await request.get("/api/transit/stops/nearby?lat=32.7767&lng=-96.7970&radiusMiles=1");
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.dataSource).toBe("local-json");
  expect(Array.isArray(body.stops)).toBe(true);
  const routeTypes = body.stops.flatMap((stop) => stop.routes.map((route) => route.type));
  expect(routeTypes).toContain("BUS");
  expect(
    routeTypes.every((type) =>
      ["STREETCAR", "BUS", "FERRY", "CABLE", "TROLLEYBUS", "AIR", "MONORAIL", "RAIL", "OTHER"].includes(type),
    ),
  ).toBe(true);
});

test("serves normalized route directions for a nearby stop", async ({ request }) => {
  const nearbyResponse = await request.get("/api/transit/stops/nearby?lat=32.7767&lng=-96.7970&radiusMiles=1");
  const nearbyBody = await nearbyResponse.json();
  const stop = nearbyBody.stops[0];
  const response = await request.get(`/api/transit/stops/${encodeURIComponent(stop.id)}`);
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.id).toBe(stop.id);
  expect(body.routes.length).toBeGreaterThan(0);
  expect(body.routes.every((route) => Array.isArray(route.directions))).toBe(true);
});
