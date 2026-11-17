// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
  it("hides the password until asked, then shows it", () => {
    render(<PasswordInput aria-label="Password" defaultValue="hunter22" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveProperty("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveProperty("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveProperty("type", "password");
  });
});
