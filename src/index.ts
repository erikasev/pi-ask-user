import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const askUserTool = defineTool({
  name: "ask_user",
  label: "Ask User",
  description: "Ask the user a question when an important choice is unresolved.",
  parameters: Type.Object({
    question: Type.String({ description: "What to ask the user" }),
    reason: Type.String({ description: "Why the agent cannot decide" }),
    options: Type.Optional(Type.Array(Type.String(), { description: "Suggested answers" })),
    recommended: Type.Optional(Type.String({ description: "Recommended option" })),
  }),

  async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
    return {
      content: [{ type: "text", text: "stub" }],
      details: { status: "cancelled" },
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(askUserTool);
}
