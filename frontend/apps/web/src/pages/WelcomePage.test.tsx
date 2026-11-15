import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@nextcrop/i18n";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { WelcomePage } from "./WelcomePage";

const renderWelcome = () =>
  render(
    <I18nProvider markFallback={false}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/location" element={<p>{"Location step"}</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );

describe("WelcomePage", () => {
  it("shows the value proposition and starts the farmer flow", async () => {
    renderWelcome();
    expect(
      screen.getByRole("heading", { level: 1, name: "Know what to plant next" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Get my plan" }),
    );
    expect(screen.getByText("Location step")).toBeInTheDocument();
  });
});
