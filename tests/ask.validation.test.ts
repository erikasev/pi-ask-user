import { describe, expect, it } from "vitest";
import { validateAskParams } from "../src/ask.js";

describe("validateAskParams", () => {
  describe("invalid cases", () => {
    it("returns invalid when question is missing", () => {
      const result = validateAskParams({ reason: "why" });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("question");
      }
    });

    it("returns invalid when question is empty string", () => {
      const result = validateAskParams({ question: "", reason: "why" });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("question");
      }
    });

    it("returns invalid when question is whitespace-only", () => {
      const result = validateAskParams({ question: "   ", reason: "why" });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("question");
      }
    });

    it("returns invalid when reason is missing", () => {
      const result = validateAskParams({ question: "what" });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("reason");
      }
    });

    it("returns invalid when reason is empty string", () => {
      const result = validateAskParams({ question: "what", reason: "" });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("reason");
      }
    });

    it("returns invalid when reason is whitespace-only", () => {
      const result = validateAskParams({ question: "what", reason: "   " });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("reason");
      }
    });

    it("returns invalid when options has fewer than 2 items", () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: ["only-one"],
      });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("options");
      }
    });

    it("returns invalid when options has duplicate labels", () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: ["A", "B", "A"],
      });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("duplicate");
      }
    });

    it('returns invalid when an option equals "Other (type your own answer)"', () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: ["A", "Other (type your own answer)"],
      });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("Other");
      }
    });

    it("returns invalid when recommended is not in options", () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: ["A", "B"],
        recommended: "C",
      });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("recommended");
      }
    });

    it("returns invalid when recommended is given without options", () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        recommended: "A",
      });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("recommended");
      }
    });

    it('returns invalid when options is a string instead of an array', () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: "not-an-array" as unknown as string[],
      });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toContain("options");
      }
    });

    it("returns invalid when options contains a non-string element", () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: ["A", 123] as unknown as string[],
      });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toBeTruthy();
      }
    });

    it("returns invalid when options contains an empty or whitespace-only label", () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: ["Yes", "   "],
      });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("valid cases", () => {
    it("accepts question and reason only", () => {
      const result = validateAskParams({ question: "what", reason: "why" });
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.params).toEqual({
          question: "what",
          reason: "why",
        });
      }
    });

    it("accepts question, reason, and options", () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: ["A", "B", "C"],
      });
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.params).toEqual({
          question: "what",
          reason: "why",
          options: ["A", "B", "C"],
        });
      }
    });

    it("accepts all valid fields including recommended", () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: ["A", "B", "C"],
        recommended: "B",
      });
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.params).toEqual({
          question: "what",
          reason: "why",
          options: ["A", "B", "C"],
          recommended: "B",
        });
      }
    });

    it('accepts options ["A", "B"] unchanged', () => {
      const result = validateAskParams({
        question: "what",
        reason: "why",
        options: ["A", "B"],
      });
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.params.options).toEqual(["A", "B"]);
      }
    });
  });
});
