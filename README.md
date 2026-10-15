# pi-ask-user
A Pi coding agent extension that lets the agent pause and ask the user when an important choice is unresolved, instead of guessing.

## Running

```bash
npm install
npm test              # unit and integration tests
npm run typecheck     # TypeScript check
pi --extension ./src/index.ts
```

Try a prompt with an unresolved choice, e.g.:
"Create a small Python script reminders.py that lets me add and list reminders. I haven't decided whether reminders should persist between runs or only last for the current run."

## Files
- `src/ask.ts`: validation and dialog flow (no Pi imports)
- `src/index.ts`: registers `ask_user`, adapts Pi's dialogs, formats the result, model guidance
- `tests/`: validation, dialog flow, and tool tests with a fake dialog
- `PLAN.md`: task and dependency plan
- `REVIEW-R1.md`, `REVIEW-E1.md`: independent reviews

## Specification: `ask_user` tool

### Inputs
- `question` (required, non-empty): what to ask.
- `reason` (required, non-empty): why the agent cannot decide by itself; shown to the user.
- `options` (optional): suggested answers. If given: at least 2 strings, none blank, no duplicates, none matching the "Other" entry.
- `recommended` (optional): must exactly match one of `options`.

### Presentation
- With options: `ctx.ui.select` with the question, reason, and any "Recommended:" line in the title, the options unchanged, plus "Other (type your own answer)". Choosing Other opens `ctx.ui.input`.
- Without options: `ctx.ui.input` with the question and reason in the title.

### Result statuses
| Status | When | Answer |
|---|---|---|
| `selected` | user picked a provided option | the exact option label |
| `custom` | user typed their own answer | the trimmed text |
| `cancelled` | user dismissed a dialog (`undefined`) | none |
| `empty` | user submitted a blank answer | none |
| `unavailable` | `ctx.hasUI` is false; no dialog opened | none |
| `invalid` | input fails validation; no dialog opened | none (an `error` names the problem) |

The status and answer (or error) are included in the model-facing tool result.
- For `cancelled`, `empty`, and `unavailable`, the result tells the model not to invent an answer and to tell the user which decision is still open.
- For `invalid`, the result shows the error (e.g. the mismatched value and the valid options) and tells the model to fix its parameters and call again.



### Asking policy (model-facing instructions)
- Ask when an important product or behavior choice is unresolved and the user has not decided or delegated it.
- Proceed when the user has already specified the behavior.
- Proceed and state the choice made when the user explicitly delegates it ("as you think best").
- Never ask about routine details such as variable names or formatting.

### Acceptance criteria
- Selecting a provided option returns `selected` with that exact label.
- Choosing Other and typing an answer returns `custom` with the trimmed text.
- Dismissing either dialog returns `cancelled`.
- Submitting a blank answer returns `empty`.
- With no UI, returns `unavailable` without opening any dialog.
- Invalid input returns `invalid` without opening any dialog.
- No custom terminal UI; uses Pi's built-in select and input dialogs.
- An invalid call returns an error that names the problem, so the model can correct it.


## Files
- `src/ask.ts`: validation and dialog flow (no Pi imports)
- `src/index.ts`: registers `ask_user`, adapts Pi's dialogs, formats the result, model guidance
- `tests/`: validation, dialog flow, and tool tests with a fake dialog
- `PLAN.md`: task and dependency plan
- `REVIEW-R1.md`, `REVIEW-E1.md`: independent reviews