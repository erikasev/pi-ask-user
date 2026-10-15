# Lab Notes: ask_user Pi Extension

## Setup
- Repo created with gh (Node .gitignore template), skeleton set up by agent.
- Agent left out a type-check: vitest doesn't check types, so added "typecheck": "tsc --noEmit".
- Agent set "test": "vitest" (watch mode); changed to "vitest run" so tests exit with pass/fail.
- Pi version: 0.87.1
- Extension docs: /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md
- UI types: /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts

## Spec decisions
- select/input both return Promise<string | undefined> (types.d.ts lines 71, 75). undefined = cancelled; blank string from input = empty. Kept as separate statuses.

- select has no description field, so question + reason are combined into the title.

- select returns the chosen label, so duplicate labels or a label matching the "Other" entry make the answer ambiguous → rejected as invalid.

- Pi example permission-gate.ts treats `choice !== "Yes"` as refusal, lumping cancel (undefined) with "No". The docs don't define undefined explicitly; treating undefined as cancelled is an inference from the types and this example. ask_user separates cancelled from an actual answer so the model knows the user didn't respond.

- select titles can contain \n (permission-gate.ts line 25), so question and reason go on separate lines of the title.


## Plan corrections
- Plan expected import errors as test failures; required stubs so failures show missing behavior.
- invalid had no error detail; added an error message so the model can fix its call.
- No-options input path was untested; added custom/empty/cancelled cases for it.
- recommended was accepted but never shown; decided to show it in the title without changing labels, plus a test for picking a non-recommended option.
- Added checks that unavailable/invalid open no dialogs, and defined the exact tool result format.
- Review was only at the end; added a parallel reviewer task (R1) per W2-3.

- Plan v2: invalid was handled in both ask() and index.ts; made ask() the single entry point that validates raw params.
- invalid message told the model to ask the user, but invalid is the model's own error; changed it to "fix the parameters and call again."
- Deliberately left empty/whitespace option labels out of the plan to see whether the independent reviewer catches it.

- Stage (b): verified with `git diff --stat tests/` (empty) that the implementer didn't modify any tests to make them pass.

- Stage (c): the invalid test checked the result text but not that no dialog opened. Added a flag-based no-dialog check (same pattern as the hasUI false test) with hasUI true, so it can only pass if validation stops before any dialog.
- Dependency: moved @earendil-works/pi-ai to peerDependencies with "*", per packages.md: "Declare imported Pi packages in peerDependencies with a "*" range and do not bundle them." (Initially added as a devDependency by the agent.)

## Review findings
- Reviewer (R1) proposed 12 cases; I accepted all and added one it missed (blank option labels).
- 2 of 13 new tests failed, exposing real defects:
  1. (Reviewer) validateAskParams coerced options with String(), so ["A", 123] silently became ["A", "123"] and passed. The tool was altering model input instead of rejecting it.
  2. (Me) ["Yes", "   "] passed validation; the user would see a blank selectable option. The reviewer did not catch this.
- The other 11 passed immediately and remain as regression guards (e.g. recommended without options was already rejected).
- Fixes assigned to the implementer; tests unchanged; all passing after the fix.


## Live tests
1. Unresolved persistence prompt → agent called ask_user. Its reasoning quoted the guideline about unresolved product choices. Dialog showed question, reason, 2 options + Other. No recommended option was given.
1. (cont.) Picked "Persist to a file" → agent wrote reminders.py storing reminders in reminders.json, matching my answer. Added an unrequested "clear" command.
- Demo side note: agent-generated reminders.py used `list[dict] | None` (Python 3.10+ syntax); my python3 is 3.9.6, so it crashed. Unrelated to the extension.
3. (retry) Agent called ask_user; I pressed Escape → result "The user cancelled the dialog..." → agent did not create the file and restated the open persistence decision.
   - Tool use was inconsistent: 1 of 2 runs asked via the tool, the other in plain chat.
4. Fully specified (in memory) → no ask_user call; built in-memory storage as specified.
5. Delegated ("as you think best") → no ask_user call; chose persistence and stated it under "Key choices made". Did not explain why. Added many unrequested features and wrote to ~/.reminders.json outside the project folder.


## Final review (E1)
- Reviewer found no defects: verified the ask.ts/index.ts separation, a test for every status, guidance matching the README policy, and all R1 proposals implemented.
- Limitation: static review can't observe model behavior. Live testing showed the model sometimes asked in plain chat; the guidance said when to ask but not to ask only via the tool. Added "call the ask_user tool; do not ask clarifying questions in plain chat text."

## Live finding: invalid-retry loop
- Live demo: model passed a recommended value that didn't exactly match an option. Validation correctly returned invalid with "fix the parameters and call again", so the model retried repeatedly and Pi appeared stuck on "working".
- Root cause: the error didn't name the bad value or list the valid options, so the model couldn't see its mistake.
- Fix: error now shows the value and the allowed options; added a guideline to copy option labels exactly.
- Lesson: tests proved validation rejects bad input, but only a live run showed that the rejection message must be actionable for the model.

- Confirmed live after the fix: model sent recommended with extra quote characters (""Persist to a file (survives restarts)""). The new error displayed the doubled quotes next to the valid options; the model identified the quotes as the problem and corrected the call on the first retry. Root cause of the earlier loop confirmed.
- Kept validation strict rather than silently stripping quotes: the tool reports the mismatch instead of guessing what the model meant.
