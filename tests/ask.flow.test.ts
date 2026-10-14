import { describe, expect, it } from "vitest";
import { ask, type Dialog } from "../src/ask.js";

function makeDialog(overrides?: Partial<Dialog>): Dialog {
  return {
    hasUI: true,
    select: async () => undefined,
    input: async () => undefined,
    ...overrides,
  };
}

describe("ask() with options", () => {
  const params = {
    question: "Which color?",
    reason: "Cannot decide without you.",
    options: ["Red", "Green", "Blue"],
  };

  it("returns selected with the exact untrimmed label", async () => {
    const calls: { type: string; title: string; options?: string[] }[] = [];
    const dialog = makeDialog({
      select: async (title, options) => {
        calls.push({ type: "select", title, options });
        return "  Green  "; // deliberately untrimmed
      },
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("selected");
    expect(result.answer).toBe("  Green  ");
    expect(calls).toHaveLength(1);
    expect(calls[0].title).toContain("Which color?");
    expect(calls[0].title).toContain("Cannot decide without you.");
    expect(calls[0].options).toEqual([
      ...params.options,
      "Other (type your own answer)",
    ]);
  });

  it("returns custom when user picks Other and types text", async () => {
    const calls: { type: string; title: string }[] = [];
    const dialog = makeDialog({
      select: async (title, _opts) => {
        calls.push({ type: "select", title });
        return "Other (type your own answer)";
      },
      input: async (title) => {
        calls.push({ type: "input", title });
        return "  my custom  ";
      },
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("custom");
    expect(result.answer).toBe("my custom"); // trimmed
    expect(calls).toHaveLength(2);
    expect(calls[0].type).toBe("select");
    expect(calls[1].type).toBe("input");
  });

  it("returns cancelled when user dismisses select", async () => {
    const dialog = makeDialog({
      select: async () => undefined,
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("cancelled");
  });

  it("returns cancelled when user picks Other then dismisses input", async () => {
    const dialog = makeDialog({
      select: async () => "Other (type your own answer)",
      input: async () => undefined,
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("cancelled");
  });

  it("returns empty when user picks Other then submits blank", async () => {
    const dialog = makeDialog({
      select: async () => "Other (type your own answer)",
      input: async () => "   ",
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("empty");
  });

  it("returns unavailable when hasUI is false and calls no dialog methods", async () => {
    let called = false;
    const dialog = makeDialog({
      hasUI: false,
      select: async () => {
        called = true;
        return undefined;
      },
      input: async () => {
        called = true;
        return undefined;
      },
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("unavailable");
    expect(called).toBe(false);
  });

  it("returns invalid when params are bad and calls no dialog methods", async () => {
    let called = false;
    const dialog = makeDialog({
      select: async () => {
        called = true;
        return undefined;
      },
      input: async () => {
        called = true;
        return undefined;
      },
    });
    const result = await ask({ question: "", reason: "" }, dialog);
    expect(result.status).toBe("invalid");
    expect(result.error).toBeTruthy();
    expect(called).toBe(false);
  });

  it("shows 'Recommended: <label>' in the select title when recommended is present", async () => {
    const withRecommended = {
      ...params,
      recommended: "Blue",
    };
    let capturedTitle = "";
    const dialog = makeDialog({
      select: async (title) => {
        capturedTitle = title;
        return "Red";
      },
    });
    const result = await ask(withRecommended, dialog);
    expect(result.status).toBe("selected");
    expect(capturedTitle).toContain("Recommended: Blue");
  });

  it("returns the exact non-recommended label when user picks it", async () => {
    const withRecommended = {
      ...params,
      recommended: "Blue",
    };
    const dialog = makeDialog({
      select: async () => "Red",
    });
    const result = await ask(withRecommended, dialog);
    expect(result.status).toBe("selected");
    expect(result.answer).toBe("Red");
  });
});

describe("ask() without options", () => {
  const params = {
    question: "What is your name?",
    reason: "I need to know who I am talking to.",
  };

  it("returns custom when user types text (trimmed)", async () => {
    let capturedTitle = "";
    const dialog = makeDialog({
      input: async (title) => {
        capturedTitle = title;
        return "  Alice  ";
      },
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("custom");
    expect(result.answer).toBe("Alice");
    expect(capturedTitle).toContain("What is your name?");
    expect(capturedTitle).toContain("I need to know who I am talking to.");
  });

  it("returns empty when user submits blank text", async () => {
    const dialog = makeDialog({
      input: async () => "   ",
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("empty");
  });

  it("returns cancelled when user dismisses input", async () => {
    const dialog = makeDialog({
      input: async () => undefined,
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("cancelled");
  });

  it("returns unavailable when hasUI is false and does not call input", async () => {
    let called = false;
    const dialog = makeDialog({
      hasUI: false,
      input: async () => {
        called = true;
        return undefined;
      },
    });
    const result = await ask(params, dialog);
    expect(result.status).toBe("unavailable");
    expect(called).toBe(false);
  });
});
