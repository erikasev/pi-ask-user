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

describe("reviewer proposed edge cases", () => {
  it("no options + empty question, hasUI true → invalid, input never called", async () => {
    let called = false;
    const dialog = makeDialog({
      input: async () => {
        called = true;
        return undefined;
      },
    });
    const result = await ask(
      { question: "", reason: "why" },
      dialog
    );
    expect(result.status).toBe("invalid");
    expect(called).toBe(false);
  });

  it("empty question + hasUI false, select/input throw → invalid, not unavailable", async () => {
    const dialog = makeDialog({
      hasUI: false,
      select: async () => {
        throw new Error("select should not be called");
      },
      input: async () => {
        throw new Error("input should not be called");
      },
    });
    const result = await ask(
      { question: "", reason: "why" },
      dialog
    );
    expect(result.status).toBe("invalid");
    expect(result.error).toBeTruthy();
  });

  it('no-options input title is exactly "Q\\n\\nR"', async () => {
    let capturedTitle = "";
    const dialog = makeDialog({
      input: async (title) => {
        capturedTitle = title;
        return "answer";
      },
    });
    await ask({ question: "Q", reason: "R" }, dialog);
    expect(capturedTitle).toBe("Q\n\nR");
  });

  it('options + recommended "Blue": select title is exactly the expected multiline string', async () => {
    let capturedTitle = "";
    const dialog = makeDialog({
      select: async (title) => {
        capturedTitle = title;
        return "Red";
      },
    });
    await ask(
      {
        question: "Which color?",
        reason: "Cannot decide without you.",
        options: ["Red", "Green", "Blue"],
        recommended: "Blue",
      },
      dialog
    );
    expect(capturedTitle).toBe(
      "Which color?\n\nCannot decide without you.\n\nRecommended: Blue"
    );
  });

  it("after choosing Other, the title passed to input equals the select title", async () => {
    let selectTitle = "";
    let inputTitle = "";
    const dialog = makeDialog({
      select: async (title) => {
        selectTitle = title;
        return "Other (type your own answer)";
      },
      input: async (title) => {
        inputTitle = title;
        return "custom";
      },
    });
    await ask(
      {
        question: "Q",
        reason: "R",
        options: ["A", "B"],
      },
      dialog
    );
    expect(inputTitle).toBe(selectTitle);
  });

  it('no options, input returns "" → empty', async () => {
    const dialog = makeDialog({
      input: async () => "",
    });
    const result = await ask(
      { question: "Q", reason: "R" },
      dialog
    );
    expect(result.status).toBe("empty");
  });

  it('options, Other, input returns "" → empty', async () => {
    const dialog = makeDialog({
      select: async () => "Other (type your own answer)",
      input: async () => "",
    });
    const result = await ask(
      { question: "Q", reason: "R", options: ["A", "B"] },
      dialog
    );
    expect(result.status).toBe("empty");
  });

  it('options [Red, Green, Blue], recommended Blue, Other, input "Blue" → custom with answer "Blue"', async () => {
    const dialog = makeDialog({
      select: async () => "Other (type your own answer)",
      input: async () => "Blue",
    });
    const result = await ask(
      {
        question: "Which color?",
        reason: "Cannot decide without you.",
        options: ["Red", "Green", "Blue"],
        recommended: "Blue",
      },
      dialog
    );
    expect(result.status).toBe("custom");
    expect(result.answer).toBe("Blue");
  });

  it("shape invariants: selected/custom have answer and no error", async () => {
    const selectedResult = await ask(
      { question: "Q", reason: "R", options: ["A", "B"] },
      makeDialog({ select: async () => "A" })
    );
    expect(selectedResult.status).toBe("selected");
    expect(selectedResult.answer).toBeDefined();
    expect(selectedResult.error).toBeUndefined();

    const customResult = await ask(
      { question: "Q", reason: "R" },
      makeDialog({ input: async () => "hello" })
    );
    expect(customResult.status).toBe("custom");
    expect(customResult.answer).toBeDefined();
    expect(customResult.error).toBeUndefined();
  });

  it("shape invariants: cancelled/empty/unavailable have neither answer nor error", async () => {
    const cancelled = await ask(
      { question: "Q", reason: "R" },
      makeDialog({ input: async () => undefined })
    );
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.answer).toBeUndefined();
    expect(cancelled.error).toBeUndefined();

    const empty = await ask(
      { question: "Q", reason: "R" },
      makeDialog({ input: async () => "   " })
    );
    expect(empty.status).toBe("empty");
    expect(empty.answer).toBeUndefined();
    expect(empty.error).toBeUndefined();

    const unavailable = await ask(
      { question: "Q", reason: "R" },
      makeDialog({ hasUI: false })
    );
    expect(unavailable.status).toBe("unavailable");
    expect(unavailable.answer).toBeUndefined();
    expect(unavailable.error).toBeUndefined();
  });

  it("shape invariants: invalid has error and no answer", async () => {
    const result = await ask(
      { question: "", reason: "" },
      makeDialog()
    );
    expect(result.status).toBe("invalid");
    expect(result.error).toBeTruthy();
    expect(result.answer).toBeUndefined();
  });
});
