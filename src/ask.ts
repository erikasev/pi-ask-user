const OTHER_OPTION = "Other (type your own answer)";

export interface Dialog {
  hasUI: boolean;
  select(title: string, options: string[]): Promise<string | undefined>;
  input(title: string, placeholder?: string): Promise<string | undefined>;
}

export interface AskParams {
  question: string;
  reason: string;
  options?: string[];
  recommended?: string;
}

export type ValidationResult =
  | { status: "ok"; params: AskParams }
  | { status: "invalid"; error: string };

export type AskStatus =
  | "selected"
  | "custom"
  | "cancelled"
  | "empty"
  | "unavailable"
  | "invalid";

export interface AskResult {
  status: AskStatus;
  answer?: string;
  error?: string;
}

export function validateAskParams(params: unknown): ValidationResult {
  if (typeof params !== "object" || params === null) {
    return { status: "invalid", error: "params must be an object" };
  }

  const p = params as Record<string, unknown>;

  const rawQuestion = typeof p.question === "string" ? p.question : "";
  const question = rawQuestion.trim();
  if (!question) {
    return { status: "invalid", error: "question is required and must be non-empty" };
  }

  const rawReason = typeof p.reason === "string" ? p.reason : "";
  const reason = rawReason.trim();
  if (!reason) {
    return { status: "invalid", error: "reason is required and must be non-empty" };
  }

  const result: AskParams = { question, reason };

  if ("options" in p && p.options !== undefined) {
    if (!Array.isArray(p.options) || p.options.length < 2) {
      return { status: "invalid", error: "options must have at least 2 items" };
    }
    for (let i = 0; i < p.options.length; i++) {
      if (typeof p.options[i] !== "string") {
        return { status: "invalid", error: `options[${i}] is not a string` };
      }
    }
    const labels = p.options as string[];
    for (let i = 0; i < labels.length; i++) {
      if (labels[i].trim() === "") {
        return { status: "invalid", error: `options[${i}] is empty or whitespace-only` };
      }
    }
    if (new Set(labels).size !== labels.length) {
      return { status: "invalid", error: "options contains duplicate labels" };
    }
    if (labels.includes(OTHER_OPTION)) {
      return { status: "invalid", error: `options must not include "${OTHER_OPTION}"` };
    }
    result.options = labels;
  }

  if ("recommended" in p && p.recommended !== undefined) {
    const recommended = String(p.recommended);
    if (!result.options || !result.options.includes(recommended)) {
      return { status: "invalid", error: "recommended must be one of the options" };
    }
    result.recommended = recommended;
  }

  return { status: "ok", params: result };
}

export async function ask(params: unknown, dialog: Dialog): Promise<AskResult> {
  const validation = validateAskParams(params);
  if (validation.status === "invalid") {
    return { status: "invalid", error: validation.error };
  }

  const { question, reason, options, recommended } = validation.params;

  if (!dialog.hasUI) {
    return { status: "unavailable" };
  }

  const baseTitle = `${question}\n\n${reason}`;
  const title = recommended ? `${baseTitle}\n\nRecommended: ${recommended}` : baseTitle;

  if (options && options.length > 0) {
    const choice = await dialog.select(title, [...options, OTHER_OPTION]);

    if (choice === undefined) {
      return { status: "cancelled" };
    }

    if (choice === OTHER_OPTION) {
      const text = await dialog.input(title);
      if (text === undefined) {
        return { status: "cancelled" };
      }
      const trimmed = text.trim();
      if (trimmed === "") {
        return { status: "empty" };
      }
      return { status: "custom", answer: trimmed };
    }

    return { status: "selected", answer: choice };
  }

  const text = await dialog.input(title);
  if (text === undefined) {
    return { status: "cancelled" };
  }
  const trimmed = text.trim();
  if (trimmed === "") {
    return { status: "empty" };
  }
  return { status: "custom", answer: trimmed };
}
