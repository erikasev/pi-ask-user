# PLAN.md — `ask_user` Pi Extension

## Pi Version & Reference Files
- **Pi version:** `0.87.1`
- **Extension docs:** `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- **UI type declarations:** `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
- **Select-then-input example:** `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/project-trust.ts`
- **Minimal tool example:** `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/hello.ts`

---

## Agreed Interfaces (no Pi imports in `src/ask.ts`)

### `Dialog` (abstracted subset of `ctx.ui` + `ctx.hasUI`)
```typescript
interface Dialog {
  hasUI: boolean;
  select(title: string, options: string[]): Promise<string | undefined>;
  input(title: string, placeholder?: string): Promise<string | undefined>;
}
```

### `AskParams` (validated before reaching `ask()`)
```typescript
interface AskParams {
  question: string;
  reason: string;
  options?: string[];
  recommended?: string;
}
```

### Validation result
```typescript
type ValidationResult =
  | { status: "ok"; params: AskParams }
  | { status: "invalid"; error: string };
```

### `AskResult`
```typescript
type AskStatus =
  | "selected"
  | "custom"
  | "cancelled"
  | "empty"
  | "unavailable"
  | "invalid";

interface AskResult {
  status: AskStatus;
  answer?: string;
  error?: string;   // present when status === "invalid"
}
```

---

## Design Constraints

1. **Pure decision logic** lives in `src/ask.ts`. It receives validated `AskParams` + `Dialog` and returns `AskResult`. No Pi imports.
2. **Validation** also lives in `src/ask.ts` (a pure `validateAskParams` function) so every invalid path can be unit-tested without Pi.
3. **`src/index.ts`** is the only file that imports Pi types. It:
   - imports `Type` from `@earendil-works/pi-ai` (or `typebox`) to build the JSON schema,
   - uses `defineTool` + `pi.registerTool()` to register the tool,
   - adapts `ctx` into the `Dialog` interface,
   - calls `ask()`,
   - formats the model-facing `AgentToolResult` from `AskResult`.
4. **Tests** live in `tests/` and use a **fake `Dialog`** with no Pi dependencies.
5. **No custom terminal UI** — only `ctx.ui.select` and `ctx.ui.input`.

---

## TypeScript Primer (unfamiliar concepts)

> **Generics (`<T>`):** Type placeholders so a function or interface can work with many types while keeping type safety. `Promise<string>` means "a Promise that resolves to a string."
>
> **Type import (`import type`):** Imports only the TypeScript type information, not runtime code. Required when the import path is a type-only export or when `isolatedModules` is enabled.
>
> **Interface vs. Type alias:** `interface` is the preferred way to describe object shapes. `type` can do unions (`"a" | "b"`) which interfaces cannot.
>
> **Optional properties (`?`):** `foo?: string` means the property may be absent or `undefined`.
>
> **Type guards / narrowing:** TypeScript uses control flow (e.g., `if (x === undefined)`) to narrow types inside blocks.
>
> **`defineTool` from Pi:** A helper that preserves parameter types when a tool is stored in a variable or array (generic inference helper).

---

## Stages, Tasks & Evidence

### Stage (a) — Failing tests for validation and every dialog flow

**Setup for A1/A2:** `src/ask.ts` must contain **stub exports** (real function signatures that compile) so tests fail on **assertions**, not on missing imports. Stubs may return obviously wrong sentinel values, e.g. `validateAskParams` always returns `{ status: "ok", params: { question: "", reason: "" } }`, and `ask` always returns `{ status: "cancelled" }` regardless of params or dialog.

#### Task A1 — Validation tests
- **Files touched:** `tests/ask.validation.test.ts`, `src/ask.ts` (stubs only)
- **Description:** Write tests for `validateAskParams` covering every invalid case:
  - empty or whitespace-only `question`
  - empty or whitespace-only `reason`
  - `options` with fewer than 2 items
  - duplicate option labels
  - any option label matching the literal string `"Other (type your own answer)"`
  - `recommended` not in `options`
  - and valid cases for all valid combinations.
- **Assertions:** Each test asserts the exact `status` and `error` string returned; valid cases assert deep equality of the returned `AskParams`.
- **Evidence to produce:**
  - Failing test output (red assertions, not import errors).
  - **Acceptance:** All `ask.validation.test.ts` tests run, compile, and fail on assertion mismatches.

#### Task A2 — Dialog flow tests for every status
- **Files touched:** `tests/ask.flow.test.ts`, `src/ask.ts` (stubs only)
- **Description:** Write tests for `ask(params: unknown, dialog: Dialog)` using a fake `Dialog` that exercises **both the options path and the no-options path**. `ask()` validates internally, so tests should include the `invalid` path (bad params with a fake Dialog) to confirm no dialog opens:

  **With options:**
  - `selected` — user picks a provided option from `select()`
  - `custom` — user picks `"Other (type your own answer)"` then types text in `input()`
  - `cancelled` — user dismisses `select()` (`undefined`)
  - `cancelled` — user picks `"Other"` then dismisses `input()` (`undefined`)
  - `empty` — user picks `"Other"` then submits blank/whitespace-only text
  - `unavailable` — `hasUI` is `false`, neither `select` nor `input` is called
  - `invalid` — received as pre-validated; neither `select` nor `input` is called

  **Without options:**
  - `custom` — user types text in `input()`; returned answer is trimmed
  - `empty` — user submits blank/whitespace-only text in `input()`
  - `cancelled` — user dismisses `input()` (`undefined`)

  **Recommended handling:**
  - When `recommended` is provided, the title passed to `select` contains a line `"Recommended: <label>"`.
  - The option labels themselves are never altered; the `"Recommended"` line is part of the title only.
  - Add a test where the user picks a **non-recommended** option and gets that exact label back (untrimmed).

- **Assertions across all tests:**
  1. The `title` passed to `select` or `input` contains both `question` and `reason`.
  2. `select` receives exactly `[...options, "Other (type your own answer)"]`.
  3. `unavailable` and `invalid` call **neither** `select` nor `input`.
  4. `selected` returns the exact option label as received, **untrimmed**.
  5. `custom` answer is trimmed.
- **Evidence to produce:**
  - Failing test output (red assertions, not import errors).
  - **Acceptance:** Every status path has a failing test case.

---

### Stage (b) — Implement pure logic

#### Task B1 — Implement `src/ask.ts`
- **Files touched:** `src/ask.ts` (replaces stubs with real logic)
- **Description:** Export `validateAskParams(params: unknown): ValidationResult` and `ask(params: unknown, dialog: Dialog): Promise<AskResult>`. `ask()` is the single entry point: it calls `validateAskParams` internally first. Implement the decision tree exactly per the spec:
  1. Call `validateAskParams`. If invalid, return `{ status: "invalid", error }`.
  2. If `!dialog.hasUI`, return `{ status: "unavailable" }`.
  3. If `options` are provided:
     - Build title: `"${question}\n\n${reason}"` + `"\n\nRecommended: ${recommended}"` if recommended is present.
     - Call `dialog.select(title, [...options, "Other (type your own answer)"])`.
     - If `undefined`, return `{ status: "cancelled" }`.
     - If choice equals `"Other (type your own answer)"`, call `dialog.input(title)`.
       - If `undefined`, return `{ status: "cancelled" }`.
       - If trimmed is empty, return `{ status: "empty" }`.
       - Otherwise return `{ status: "custom", answer: trimmed }`.
     - Otherwise return `{ status: "selected", answer: choice }`.
  4. If no options:
     - Call `dialog.input("${question}\n\n${reason}")`.
     - If `undefined`, return `{ status: "cancelled" }`.
     - If trimmed is empty, return `{ status: "empty" }`.
     - Otherwise return `{ status: "custom", answer: trimmed }`.
- **Evidence to produce:**
  - Passing test output (green) from `npm test` for both `ask.validation.test.ts` and `ask.flow.test.ts`.
  - **Acceptance:** All Stage (a) tests pass; diff of `src/ask.ts` is the only runtime change.

---

### Stage (r) — Independent review of tests (parallel with B1)

#### Task R1 — Propose extra test cases without editing files
- **Files touched:** none (read-only review of tests/ and README.md / GitHub issue)
- **Description:** An independent reviewer reads the spec, the acceptance criteria, and tests written in A1/A2, then writes a list of proposed extra test cases or edge-case assertions **without modifying any source or test files**. Examples: boundary whitespace in option labels, very long question strings, concurrent-dialog behavior, AbortSignal interaction, etc.
- **Evidence to produce:**
  - A numbered list of proposals with rationale.
  - **Acceptance:** The list exists and is readable.

---

### Stage (c) — Failing tests for tool registration and result formatting

#### Task C1 — Tool registration & formatting tests
- **Files touched:** `tests/index.test.ts`
- **Description:** Write a test that imports `src/index.ts` (the default factory function). Mock a minimal `ExtensionAPI` (with a spyable `registerTool`) and `ExtensionContext` (with a fake `Dialog`), call the factory, and assert:
  - `registerTool` was called with a tool whose `name` is `"ask_user"`.
  - Invoking the tool's `execute` function returns an `AgentToolResult` whose shape matches:
    ```typescript
    {
      content: [{ type: "text", text: <string> }],
      details: { status: AskStatus, answer?: string, error?: string }
    }
    ```
  - For **each status**, assert the exact model-facing `text`:

    | Status | `text` |
    |---|---|
    | `selected` | `The user selected: "<answer>"` |
    | `custom` | `The user answered: "<answer>"` |
    | `cancelled` | `The user cancelled the dialog. Do not invent an answer. Tell the user which decision is still open.` |
    | `empty` | `The user submitted a blank answer. Do not invent an answer. Tell the user which decision is still open.` |
    | `unavailable` | `No UI is available to ask the user. Do not invent an answer. Tell the user which decision is still open.` |
    | `invalid` | `Invalid ask_user call: <error>. Fix the parameters and call ask_user again.` |

- **Evidence to produce:**
  - Failing test output (red) because `src/index.ts` does not yet implement the tool registration or result formatting.
  - **Acceptance:** Tests compile but fail on assertion mismatches.

---

### Stage (d) — Implement `src/index.ts`

#### Task D1 — Wire tool registration, adapter, and formatter
- **Files touched:** `src/index.ts`, `package.json` (schema dependency)
- **Description:**
  1. Add the TypeBox schema package (`@earendil-works/pi-ai` or `typebox`) to `dependencies` or `devDependencies` in `package.json`.
  2. Build the TypeBox schema for parameters (`question`, `reason`, `options`, `recommended`) with Pi's `Type` builder.
  3. Define the tool with `defineTool` and `execute` that:
     - passes raw params to `ask()` (which validates internally),
     - if invalid, returns `AgentToolResult` with the `invalid` text and `details: { status: "invalid", error }`,
     - adapts `ctx` to `Dialog`,
     - formats the model-facing `text` using the exact strings in the C1 table,
     - returns `{ content: [{ type: "text", text }], details: { status, answer, error } }`.
  4. Call `pi.registerTool(tool)` in the default export.
  5. Add model-facing `description`, `promptSnippet`, and `promptGuidelines` per spec.
- **Evidence to produce:**
  - Passing test output (green) from `npm test` for `index.test.ts`.
  - `npm run typecheck` clean.
  - **Acceptance:** All Stage (c) tests pass.

---

### Stage (e) — Independent review

#### Task E1 — Review final diff and defects
- **Files touched:** none (read-only review)
- **Description:** An independent reviewer examines the diff of `src/ask.ts`, `src/index.ts`, `tests/`, and `package.json`. For every defect or missed test case found, the reviewer must provide:
  1. A description of the defect.
  2. A **reproduction** (a specific test input or sequence of fake-Dialog calls that demonstrates the defect).
  3. The expected vs. actual behavior.
  Also verify:
  - No Pi imports in `src/ask.ts`.
  - `src/index.ts` contains only Pi wiring and formatting, no decision logic.
  - Every spec status from the acceptance criteria has at least one test.
  - `npm test` and `npm run typecheck` both pass.
  - Tests do not depend on the real Pi runtime or real UI.
  - The `R1` proposed test cases were considered.
- **Evidence to produce:**
  - A checklist with a reproduction for each defect, or an approval note if none found.
  - **Acceptance:** All verifications pass; any defects filed with reproductions.

---

## Dependency Graph

```
        ┌──→ B1 ───┬──→ C1 ─→ D1 ─┐
        │          │              │
A1 ─┬───┘          │              ├──→ E1
    │              │              │
A2 ─┴──→ R1 ──────┘──────────────┘
```

- A1 and A2 are independent.
- B1 depends on A1 + A2.
- R1 branches from A1 + A2, parallel to B1 (reads tests, writes proposals only).
- C1 depends on B1 (needs `ask.ts` types; may mock the module).
- D1 depends on C1.
- E1 depends on B1 + D1 + R1.
