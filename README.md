# pi-ask-user
A Pi coding agent extension that lets the agent pause and ask the user when an important choice is unresolved, instead of guessing.

## Specification: `ask_user` tool

### Inputs
- `question` (required, non-empty): what to ask.
- `reason` (required, non-empty): why the agent cannot decide by itself; shown to the user.
- `options` (optional): suggested answers. If given: at least 2, no duplicate labels, none matching the "Other" entry.
- `recommended` (optional): must be one of `options`.

### Presentation
- With options: `ctx.ui.select` with the question and reason in the title, the options, plus "Other (type your own answer)". Choosing Other opens `ctx.ui.input`.
- Without options: `ctx.ui.input` with the question and reason in the title.


### Result statuses

{status, when, answer}
'selected' : user picked a provided option | the option label
'custom' : user typed their own answer | the trimmed text
'cancelled' : user dismissed a dialing ('undefined') | none 
'empty' : user submitted a blank answer | none 
'unavailable' : 'ctx.hasUI' is false; no dialog opened | none 
'invalid' : input fails validations | none


The status and answer are included in the model-facing tool result. For every status without an answer, the result tells the model not to invent one and to tell the user which decision is still open.


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