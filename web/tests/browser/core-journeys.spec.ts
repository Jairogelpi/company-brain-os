import { expect, test } from "@playwright/test";

const password = process.env.E2E_PASSWORD ?? process.env.SEED_PASSWORD ?? "ci-test-password";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@companybrain.os");
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Company Brain" })).toBeVisible();
}

test("protected routes redirect anonymous users to login", async ({ page }) => {
  await page.goto("/people");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("seeded owner can sign in and reach the dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Company Brain" })).toBeVisible();
});

test("seeded owner can navigate across protected product areas", async ({ page }) => {
  await login(page);

  for (const route of ["/missions", "/settings", "/people"]) {
    const response = await page.goto(route);
    expect(response?.ok(), `${route} should return a successful response`).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}$`));
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  }
});
