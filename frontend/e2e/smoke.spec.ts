import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const expectNoAxeViolations = async (page: Page, context: string) => {
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () => {
    const axe = (window as unknown as {
      axe: {
        run: (
          root: Document,
          options: unknown,
        ) => Promise<{
          violations: { id: string; impact: string | null; help: string; nodes: { target: string[] }[] }[];
        }>;
      };
    }).axe;
    return axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
  });
  expect(
    result.violations,
    `${context} accessibility violations: ${JSON.stringify(result.violations, null, 2)}`,
  ).toEqual([]);
};

test("home page loads and is accessible on a small screen", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Know what to plant next" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Get my plan" }).first()).toBeVisible();
  await expectNoAxeViolations(page, "home");
});

test("a farmer can start the plan journey", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Get my plan" }).first().click();
  await expect(page).toHaveURL(/\/location$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page, "location");
});

test("demo admin can sign in and open the dashboard", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("I agree").check();
  await page.getByRole("button", { name: "Continue as demo admin" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Administration dashboard",
  );
  await expectNoAxeViolations(page, "admin dashboard");
});

test("USSD simulator renders a callback response", async ({ page }) => {
  await page.goto("/ussd");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Dial *384*2026#" }).click();
  await expect(page.locator(".phoneScreen")).toContainText("Get crop advice");
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".phoneScreen")).toContainText("Enter last crop");
  await expectNoAxeViolations(page, "ussd");
});

test("a farmer can complete the wizard and read a plan", async ({ page }) => {
  await page.goto("/location");
  await page.locator("#district").selectOption({ index: 1 });
  await page.locator("#subcounty").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Use this location" }).click();
  await expect(page).toHaveURL(/\/climate$/);
  await page.getByRole("button", { name: "Continue to the questions" }).click();
  await expect(page).toHaveURL(/\/wizard$/);

  await page.getByRole("radio", { name: /Maize/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: /Loam/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: /More money/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Check your answers" })).toBeVisible();
  await page.getByRole("button", { name: "Get my plan" }).first().click();

  await expect(page).toHaveURL(/\/plan\?id=/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Your rotation plan" }),
  ).toBeVisible();
  await expect(page.getByText(/Season A/).first()).toBeVisible();
  await expectNoAxeViolations(page, "plan");
});

test("an admin can open a rule pack in the YAML editor", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("I agree").check();
  await page.getByRole("button", { name: "Continue as demo admin" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByRole("button", { name: "Manage rule packs" }).click();
  await expect(page).toHaveURL(/\/admin\/rulepacks$/);
  await page.getByRole("link", { name: /Edit|Actions/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/rulepacks\/.+/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pack editor" }),
  ).toBeVisible();
  await expect(page.getByLabel("Rule pack YAML")).toBeVisible();
  await expectNoAxeViolations(page, "admin editor");
});

test("a demo officer can open the reports dashboard", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("I agree").check();
  await page.getByRole("button", { name: "Continue as demo officer" }).click();
  await expect(page).toHaveURL(/\/extension$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page, "officer");

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expectNoAxeViolations(page, "settings");

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Reports" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Anonymised reports" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Usage by channel" })).toBeVisible();
  await expectNoAxeViolations(page, "reports");
});

test("admin audit table is accessible", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("I agree").check();
  await page.getByRole("button", { name: "Continue as demo admin" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByRole("button", { name: "Menu" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Audit log" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Audit log" }),
  ).toBeVisible();
  await expectNoAxeViolations(page, "admin audit");
});

test("an extension officer can register and sees the pending approval message", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Choose your role").selectOption("extension_officer");
  await page.getByLabel("Your name").fill("Aciro Grace");
  await page.getByLabel("District").selectOption("lira");
  await page.getByLabel("Constituency").selectOption("lira.erute-north");
  await page.getByLabel("Sub-county").selectOption("lira.agweng");
  await page.getByLabel("Phone number").fill("0772000222");
  await page.getByLabel("I agree").check();
  await page.getByRole("button", { name: "Create account and send code" }).click();
  await page.getByLabel("Six-digit code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Registration received", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/administrator must approve your account/i),
  ).toBeVisible();
  await expectNoAxeViolations(page, "pending officer registration");
});

test("an admin can approve an extension officer registration", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("I agree").check();
  await page.getByRole("button", { name: "Continue as demo admin" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  await page.getByRole("button", { name: "Menu" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Officer approvals" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Extension officer approvals" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Aciro Grace" })).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(
    page.getByText("No registrations match this filter."),
  ).toBeVisible();
  await expectNoAxeViolations(page, "officer approvals");
});
