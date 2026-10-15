import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ask } from "./ask.js";

function formatText(status: string, answer?: string, error?: string): string {
  switch (status) {
    case "selected":
      return `The user selected: "${answer}"`;
    case "custom":
      return `The user answered: "${answer}"`;
    case "cancelled":
      return "The user cancelled the dialog. Do not invent an answer. Tell the user which decision is still open.";
    case "empty":
      return "The user submitted a blank answer. Do not invent an answer. Tell the user which decision is still open.";
    case "unavailable":
      return "No UI is available to ask the user. Do not invent an answer. Tell the user which decision is still open.";
    case "invalid":
      return `Invalid ask_user call: ${error}. Fix the parameters and call ask_user again.`;
    default:
      return "Unknown status.";
  }
}

const askUserTool = defineTool({
  name: "ask_user",
  label: "Ask User",
  description:
    "Ask the user a question when an important product or behavior choice is unresolved.",
  promptSnippet: "ask_user — pause and ask the user an unresolved question",
  promptGuidelines: [
    "Ask with ask_user only when an important product or behavior choice is unresolved and the user has not decided or delegated it.",
    "If the user specified the behavior, proceed without asking.",
    'If the user explicitly delegates ("as you think best"), choose, proceed, and state your choice.',
    "Never ask about routine details like naming or formatting.",
    "Ask one question at a time.",
    "If the result has no answer, do not invent one; tell the user which decision is still open.",
  ],
  parameters: Type.Object({
    question: Type.String({ description: "What to ask the user" }),
    reason: Type.String({ description: "Why the agent cannot decide by itself" }),
    options: Type.Optional(
      Type.Array(Type.String({ description: "Suggested answer option" }), {
        description: "Suggested answer options (at least 2)",
      })
    ),
    recommended: Type.Optional(
      Type.String({ description: "Must be one of the provided options" })
    ),
  }),

  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const dialog = {
      hasUI: ctx.hasUI,
      select: (title: string, options: string[]) => ctx.ui.select(title, options),
      input: (title: string) => ctx.ui.input(title),
    };

    const result = await ask(params, dialog);
    const text = formatText(result.status, result.answer, result.error);

    return {
      content: [{ type: "text", text }],
      details: {
        status: result.status,
        answer: result.answer,
        error: result.error,
      },
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(askUserTool);
}
