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

// STUB: always returns ok with dummy params
export function validateAskParams(_params: unknown): ValidationResult {
  return { status: "ok", params: { question: "stub", reason: "stub" } };
}

// STUB: always returns cancelled
export async function ask(_params: unknown, _dialog: Dialog): Promise<AskResult> {
  return { status: "cancelled" };
}
