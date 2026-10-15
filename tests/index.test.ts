import { describe, expect, it } from "vitest";
import factory from "../src/index.js";

describe("ask_user tool registration", () => {
  it("registers exactly one tool named ask_user with a non-empty description", () => {
    const registered: unknown[] = [];
    const fakeAPI = {
      registerTool: (tool: unknown) => registered.push(tool),
    };
    factory(fakeAPI as any);
    expect(registered).toHaveLength(1);
    const tool = registered[0] as any;
    expect(tool.name).toBe("ask_user");
    expect(tool.label).toBeTruthy();
    expect(tool.description).toBeTruthy();
    expect(tool.description.length).toBeGreaterThan(0);
  });
});

describe("ask_user tool execute result text", () => {
  function getTool() {
    const registered: unknown[] = [];
    const fakeAPI = {
      registerTool: (tool: unknown) => registered.push(tool),
    };
    factory(fakeAPI as any);
    return registered[0] as any;
  }

  function makeCtx(overrides?: {
    hasUI?: boolean;
    select?: () => Promise<string | undefined>;
    input?: () => Promise<string | undefined>;
  }) {
    return {
      hasUI: true,
      ui: {
        select: overrides?.select ?? (async () => undefined),
        input: overrides?.input ?? (async () => undefined),
        notify: () => {},
      },
      ...overrides,
    };
  }

  it("selected → exact text with answer, details has status and answer, no error", async () => {
    const tool = getTool();
    const ctx = makeCtx({
      hasUI: true,
      select: async () => "Red",
    });
    const result = await tool.execute("id-1", {
      question: "Which color?",
      reason: "Cannot decide.",
      options: ["Red", "Green"],
    }, undefined, undefined, ctx);
    expect(result.content).toEqual([{ type: "text", text: 'The user selected: "Red"' }]);
    expect(result.details).toEqual({ status: "selected", answer: "Red" });
    expect(result.details.error).toBeUndefined();
  });

  it("custom → exact text with answer, details has status and answer, no error", async () => {
    const tool = getTool();
    const ctx = makeCtx({
      hasUI: true,
      select: async () => "Other (type your own answer)",
      input: async () => "my answer",
    });
    const result = await tool.execute("id-2", {
      question: "Which color?",
      reason: "Cannot decide.",
      options: ["Red", "Green"],
    }, undefined, undefined, ctx);
    expect(result.content).toEqual([{ type: "text", text: 'The user answered: "my answer"' }]);
    expect(result.details).toEqual({ status: "custom", answer: "my answer" });
    expect(result.details.error).toBeUndefined();
  });

  it("cancelled → exact text, details has status only, no answer, no error", async () => {
    const tool = getTool();
    const ctx = makeCtx({
      hasUI: true,
      select: async () => undefined,
    });
    const result = await tool.execute("id-3", {
      question: "Which color?",
      reason: "Cannot decide.",
      options: ["Red", "Green"],
    }, undefined, undefined, ctx);
    expect(result.content).toEqual([{
      type: "text",
      text: "The user cancelled the dialog. Do not invent an answer. Tell the user which decision is still open.",
    }]);
    expect(result.details).toEqual({ status: "cancelled" });
    expect(result.details.answer).toBeUndefined();
    expect(result.details.error).toBeUndefined();
  });

  it("empty → exact text, details has status only, no answer, no error", async () => {
    const tool = getTool();
    const ctx = makeCtx({
      hasUI: true,
      input: async () => "   ",
    });
    const result = await tool.execute("id-4", {
      question: "Name?",
      reason: "Cannot decide.",
    }, undefined, undefined, ctx);
    expect(result.content).toEqual([{
      type: "text",
      text: "The user submitted a blank answer. Do not invent an answer. Tell the user which decision is still open.",
    }]);
    expect(result.details).toEqual({ status: "empty" });
    expect(result.details.answer).toBeUndefined();
    expect(result.details.error).toBeUndefined();
  });

  it("unavailable → exact text, details has status only, no answer, no error", async () => {
    const tool = getTool();
    const ctx = makeCtx({ hasUI: false });
    const result = await tool.execute("id-5", {
      question: "Name?",
      reason: "Cannot decide.",
    }, undefined, undefined, ctx);
    expect(result.content).toEqual([{
      type: "text",
      text: "No UI is available to ask the user. Do not invent an answer. Tell the user which decision is still open.",
    }]);
    expect(result.details).toEqual({ status: "unavailable" });
    expect(result.details.answer).toBeUndefined();
    expect(result.details.error).toBeUndefined();
  });

  it("invalid → exact text with error, details has status and error, no answer, no dialog", async () => {
    const tool = getTool();
    let selectCalled = false;
    let inputCalled = false;
    const ctx = makeCtx({
      hasUI: true,
      select: async () => { selectCalled = true; return undefined; },
      input: async () => { inputCalled = true; return undefined; },
    });
    const result = await tool.execute("id-6", {
      question: "",
      reason: "",
    }, undefined, undefined, ctx);
    expect(selectCalled).toBe(false);
    expect(inputCalled).toBe(false);
    expect(result.content).toEqual([{
      type: "text",
      text: "Invalid ask_user call: question is required and must be non-empty. Fix the parameters and call ask_user again.",
    }]);
    expect(result.details).toEqual({
      status: "invalid",
      error: "question is required and must be non-empty",
    });
    expect(result.details.answer).toBeUndefined();
  });

  it("with hasUI false, neither select nor input is called", async () => {
    const tool = getTool();
    let selectCalled = false;
    let inputCalled = false;
    const ctx = makeCtx({
      hasUI: false,
      select: async () => { selectCalled = true; return undefined; },
      input: async () => { inputCalled = true; return undefined; },
    });
    await tool.execute("id-7", {
      question: "Q",
      reason: "R",
      options: ["A", "B"],
    }, undefined, undefined, ctx);
    expect(selectCalled).toBe(false);
    expect(inputCalled).toBe(false);
    expect(ctx.hasUI).toBe(false);
  });
});
