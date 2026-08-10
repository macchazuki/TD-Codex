# Engineering Standards

You are building production software. These are requirements, not suggestions. Violating them creates tech debt that compounds with every file you touch.

## 1. Workflow

- `git init` before writing code. Create `.gitignore` covering build artifacts, language-specific caches, dependency directories, `.env`, IDE configs, etc.
- Scaffold project structure with empty files/stubs before implementing anything. Plan the file layout first.
- Build one feature at a time. Test it. Commit it. Then start the next feature.
- After every change: lint, test, fix failures, commit. Do not stack features on untested code.
- Never go more than 30 minutes without a commit. Never have more than 3 files with uncommitted changes at once.
- If the spec doesn't cover something, leave a `TODO:` comment and move on. Do not invent features.
- Commit messages use conventional prefixes: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Work on a feature branch (`feat/short-description`, `fix/short-description`), not `main`, unless told otherwise.
- Merge PRs with regular merge commits, not squash. If the repo provides a gated merge command (e.g. `make merge pr=N`), it is the only merge path — never a bare `gh pr merge`.
- Always use worktrees for feature branches: `git worktree add ../feat/name -b feat/name`. If the repo provides a worktree bootstrap (e.g. `make worktree b=feat/name` — check the Makefile / project CLAUDE.md first), use THAT instead of bare `git worktree add`: it seeds dependencies (node_modules, build artifacts) so the new tree works immediately — never symlink dependency dirs between worktrees. Commit/push from the worktree, not the primary working tree. After the PR is merged, clean up: `git worktree remove ../feat/name && git branch -d feat/name`.
- Do not build ahead. Each unit of work should produce exactly what was requested. If something would be useful but wasn't asked for, leave a `TODO:` comment and move on.

### Before Modifying Code

- Read first, write second. Read the relevant files, check env vars, and understand existing state before changing anything. Do not assume — verify.
- After context compaction: Run `git branch` and `git status` before doing anything else. Branch switches can happen between sessions and silently remove uncommitted work.

### Bug Fix Workflow

1. Write a test that reproduces the bug — it MUST fail before the fix
2. Run the test — confirm it fails
3. Write the fix
4. Run the test — confirm it passes
5. Run full relevant test suite
6. Commit test + fix together

### What Never Gets Committed

Secrets, API keys, tokens, `.env` files, build artifacts, compiled output, dependency directories (e.g. `node_modules/`, `vendor/`, `target/`), IDE/editor configs.

## 2. Project Structure

Never put all code in a single flat directory. Organize by responsibility — the specifics depend on the system type:

- **Request-driven backends** (REST APIs, web servers): handler/controller layer → service/domain layer → data-access layer. Keep HTTP concerns, business logic, and storage separate.
- **Event-driven / message-based systems**: organize around event handlers, domain logic, and infrastructure adapters. Ports-and-adapters or hexagonal patterns fit naturally.
- **Data pipelines**: organize by pipeline stage — ingestion, transformation, validation, output — with shared utilities.
- **CLI tools / batch processors**: separate command parsing, core logic, and I/O.
- **Libraries / SDKs**: organize by public API surface, internal implementation, and shared types.

The universal principle: **separate what changes for different reasons**. I/O, business rules, and external integrations should not live in the same unit.

General rules:
- 3+ files serving the same purpose → directory. Don't create a directory for a single file.
- Don't nest more than 3 levels deep without good reason.
- Tests live in a parallel structure or adjacent to source, consistent with language conventions.

## 3. File & Function Limits

| Metric | Target | Hard Limit | Action When Exceeded |
|---|---|---|---|
| Lines per file | 300 | 400 | Plan split at 300; must split at 400 |
| Lines per function/method | 50 | | Extract sub-steps into helpers |
| Lines per handler (HTTP, event, CLI) | 20 | | Delegate to domain/service layer |
| Functions/methods per file | 15 | | Split into a new module |
| Parameters per function | 5 | | Use a config/options object or struct |
| Nesting depth | 4 levels | | Use early returns, extract helpers |

When approaching 300 lines, plan the split. Files between 300–400 lines are acceptable if a split would be awkward. Over 400 lines must be split immediately. Do not write a 600-line file and "refactor later."

## 4. Architecture Principles

### Dependency Direction

Dependencies point inward: infrastructure → application → domain. Never the reverse.

- **Handlers / Controllers / Entry points**: parse input, delegate to domain/service layer, format output. No business logic. No direct data-access calls.
- **Domain / Service layer**: rules, validation, transformations. No framework imports. No direct I/O.
- **Data access / Infrastructure**: storage, external APIs, messaging. Expose typed interfaces, not raw connections.

### Boundaries

- Every module/package has a clear public API. Internal symbols are unexported or prefixed with `_` per language convention.
- Config is loaded once at startup into a typed object/struct. No reading env vars deep in business logic.
- Cross-layer communication uses typed data structures, not raw maps/dicts/untyped JSON.

### When This Doesn't Fit

Not every system is a CRUD backend. If the handler → service → data-access layering creates friction (event-driven systems, pipelines, stateful simulations, analytics code), use the architecture that fits — but preserve the core invariant: **separate I/O from logic, and keep dependency direction consistent**.

## 5. Code Style

### Types and Structure

- Type annotations / signatures on all public functions including return types. Use the language's type system fully.
- One-line doc comments on every public function/method. Module/package-level doc comments on every module.
- Use the right abstraction for the job: functions, classes, structs, interfaces, traits, enums — whatever the language offers. Prefer the simplest construct that models the problem correctly. A class with methods is fine when it models state + behavior; a standalone function is fine when it doesn't.
- Use typed data structures (structs, records, dataclasses, case classes) for structured data. Not untyped maps/dicts.

### Naming

- Constants: `UPPER_SNAKE_CASE`.
- Functions/methods: `verb_noun` or language-idiomatic equivalent (e.g. `camelCase` in JS/TS/Java/Go).
- Booleans: `is_`, `has_`, `should_` prefix (or language-idiomatic equivalent: `isReady`, `hasAccess`).
- Variables: descriptive. `agentCount` not `n`. `tokenExpiry` not `te`.

### Hygiene

- No global mutable state. No commented-out code. No dead code — remove unused imports, functions, variables.
- DRY: Same logic 3+ times → extract into a helper or constant.

### Performance

- Write performant code from the start: the right data structure for the access pattern, no accidental O(n²), no N+1 queries, no polling where an event exists, stream unbounded data instead of buffering it. Avoiding known-slow code is not premature optimization.
- Optimization beyond that still requires profiling data. Measure before and after; keep the readable version when the gain is negligible.

### Error Handling

- Catch/handle specific errors. Never swallow all errors silently (`catch {}`, bare `except:`, `catch (Exception e)` with no action).
- Log errors with context: include the operation, relevant IDs, and the error itself.
- API endpoints return appropriate status codes (400, 404, 409, 500). Never 200 for everything.
- In languages with error-return patterns (Go, Rust): check every error. Do not discard.

### Input Validation

- Validate all external input at system boundaries. Reject invalid input early with clear error messages.

### Logging

- Use structured logging, not print/println/console.log for production code. One logger per module where the language supports it.
- Levels: DEBUG dev detail, INFO normal ops, WARNING recoverable, ERROR failures.
- Never log secrets, tokens, passwords, or PII.

## 6. Database

- Parameterized queries only. Zero string interpolation in SQL.
- Numbered migrations: `001_initial.sql`, `002_add_auth.sql`. Every migration idempotent with rollback section.
- Never modify a committed migration. Create a new one.
- Wrap multi-statement writes in explicit transactions. All timestamps ISO 8601 UTC.
- Database access goes through a dedicated data-access layer exclusively.

## 7. HTTP Discipline

- All URLs constructed from config at runtime. Never hardcode host, port, or path.
- Explicit timeout on every outgoing HTTP call. Log URL + method + status on cross-service calls.

## 8. Testing

Test alongside implementation, not after. Every module gets a test file before the feature is considered started.

- Each test tests ONE thing. Name it descriptively: `test_expired_token_returns_401` / `shouldReturn401ForExpiredToken`.
- Use fixtures/factories. Tests are deterministic. Use in-memory DBs, mock external HTTP.
- While iterating, run the smallest relevant test command. In a repo with a merge gate, the full suite runs there once, on the preview merge — do not run it manually first; a manual full run doubles the cost and contends with live gates. Without a gate, run the full suite before calling the feature complete.
- If a test fails, fix it before continuing. Do not comment out or skip.
- Use the standard test framework for the language (`pytest`, `jest`/`vitest`, `go test`, `JUnit`, `cargo test`, etc.).
- Tests are fast. Never a real sleep or wall-clock wait when a fake clock, injected timer, or stub covers it — a test that sleeps 4s where a stub runs in 0.1s is a defect. Await the condition; do not sleep a fixed duration.
- Test real logic, stub slow edges: time, network, external services, and subprocess spawns are stubbed; the logic under test never is.
- Suites run in parallel. Isolate per-test state (ports, temp dirs, globals) so they can; fix the test that demands serialization instead of serializing the suite.
- Give the suite per-test and wall-time budgets enforced in the gate, so a slow test fails loudly when it lands instead of accreting.
- Test retries default to 0; a retry budget must be earned with evidence, because retries launder reproducible failures into green runs. Keep every failing attempt's logs and artifacts even when a retry passes — a healed retry is otherwise invisible.
- Never ship a speculative flake fix. Capture a failure, reproduce it deterministically (inject a delay at the stubbed async boundary; add CPU load), fix the whole class, and prove the fix with N-of-N clean repeats with retries off.

## 9. Configuration

Precedence: CLI flag > env var > config file > built-in default.

- Every config value has a built-in default. Project works with zero configuration.
- Load once at startup into a typed config object/struct. Validate on load, fail fast.
- Log effective config with sources at startup (e.g., `port=9000 [default]`, `db_path=~/data [env]`).

## 10. Dependencies

- Do not reinvent the wheel. If a well-regarded library or tool already solves the problem, use it.
- Pin versions explicitly. Keep dependencies minimal. Standard library first.
- Document why each non-obvious dependency exists.
- Pin the **toolchain/tools** to exact versions too (not `latest`/`stable`) so local == CI, and build/lint through the project's task runner — never a bare `cargo`/`clippy`/`tsc` you PATH-fixed.
- A new pin takes the current stable release. Updating a pin is its own reviewed change: bump the pin and lockfile on a branch, run the gate, merge, then align the machine. Never upgrade the machine first and chase the breakage after. Batch routine updates into a scheduled chore, not mid-feature.
- On a machine shared by several agents, the repo's pins are the contract between them: doctor flags drift, install converges the machine to the pins. Never upgrade, downgrade, or shim a global tool to fix one repo's build — that silently changes every other agent's environment mid-task. If the pin is wrong, change the pin by PR.
- When a gate fails on files you never touched, suspect a tool-version or flag mismatch (e.g. Homebrew vs rustup, `--all-targets` vs not, local vs CI) before debugging the code — and never weaken the gate to route around it.

## 11. Do Not Build

Unless the spec explicitly requires it, do not build: auth systems, websockets, task queues, caching layers, ORMs, GraphQL, gRPC, Docker configs, CI/CD pipelines (repo automation has its own trigger — §13), API doc generators, monitoring/admin panels beyond spec, performance optimizations without profiling data.

## 12. README Minimum Content

Every project README must include: What it does (one paragraph), How to install, How to run, How to test.

## 13. Repo Automation

Apply these once a repo has a merge gate, git hooks, or more than one agent working in it. Do not scaffold them on day one.

### Make-first commands

- The Makefile (or equivalent task runner) owns every project command: build, test, lint, dev servers, deploy, maintenance. An operation run twice by hand becomes a target.
- `make help` lists targets by parsing the `## ` comment on each rule, so the list cannot drift from the targets.
- Each target's help comment states its role: blocking gate, advisory, iteration-only, or the sanctioned path for an operation.
- Tool version pins are variables at the top of the Makefile — one place, passed to every consumer. A new pin must never need adding to a second recipe.

### Doctor and install

- `make doctor`: a preflight of a few seconds, no build — check tool versions against the pins, required tools, and generated-artifact freshness. Run it before a long gate, and first when a gate fails for no visible reason.
- `make install`: one-time idempotent machine setup that installs everything doctor checks, then runs doctor as the verdict. Doctor and install read the same pin list.
- Order checks cheap-first so drift fails in seconds, not minutes into a gate. When a formatter can fix the failure, apply it, then fail — the fix is a re-stage, not a rewrite.
- A version string is not an environment identity: the same version from two installers is two different tools, so check provenance. A pin is honored only when the pinned runtime actually runs — warn-and-continue silently produces wrong results.
- Preflight probes are side-effect-free: a probe must never trigger the install it guards. Scripts are cwd-proof: they derive paths from their own location and fail loudly — a wrong-directory no-op with exit 0 is worse than a crash.

### Read-only local main

- Local `main` is a read-only mirror of `origin/main`. Enforce it with hooks, not convention: pre-commit and pre-merge-commit refuse commits on main, pre-push refuses pushes to `refs/heads/main`, and a reference-transaction hook refuses moving main to a commit origin/main does not contain.
- `make sync` fetches and fast-forwards the current worktree's branch, and refuses loudly when local main holds commits origin/main does not.
- `make merge pr=N` is the only merge path: it runs the gate on the preview merge and merges only while both parents are unchanged. Never `gh pr merge` directly, never a merge chained after a manual gate run.
- Branch gating never tests `main` itself: two PRs can each gate green and merge into a red `main` with no textual conflict. Re-run the full gate on each new `origin/main` commit — a report-only watcher that notifies on red and on recovery — and treat a red `main` as an incident to fix immediately.

### Hooks

- A fix a tool can compute is applied, never warned about. Hooks auto-format staged files and regenerate stale artifacts, staging the fix only when the file has no unrelated unstaged edits; gates apply the fix, then fail fast so the re-run is clean. Only defects a tool cannot fix reach review.
- Every check is explicitly blocking or advisory, with the reason recorded next to it. Advisory checks never block; slow advisory checks run in the background at push time.
- Hooks self-guard: a step skips silently when its tooling is absent in that worktree, so an old branch is never blocked by newer hooks. The merge gate remains the backstop.

### Concurrent agents

- Heavy gate targets take a machine-wide lock; concurrent worktrees queue instead of contending, and a queued gate is normal.
- Dev servers and test harnesses derive their ports from the worktree, so concurrent agents never bind the same port or test another worktree's build.
- A file or literal that every PR of a common class must hand-edit is a merge-race generator. Derive such lists and counts from the filesystem or a registry, shard tool state along the axis agents work on concurrently, and guard a shared counter with an explicit next-free-number check.
- Clean up merged branches and stale worktrees with a scheduled report-only triage: classify each as merged, superseded, open-PR, or checked-out, and delete only the provably safe classes on explicit request.

### Gates guard themselves

- A fact derived from the code — a count, a table, an index, a generated file — is never maintained by hand. Give it one generator command and a drift lock in the gate: regeneration must be a no-op. Hand-editing generated output is always wrong; markers let the generator rewrite facts that live inside prose.
- A meta-check asserts every check script is reachable from the merge gate, so a new check cannot sit unwired.
- Gate selection follows the PR diff (a docs-only PR skips the build chain); detection errs toward running the gate.
- Repo tooling gets unit tests like product code, run in the gate against throwaway fixtures.
- A check's verdict comes from exit codes, never from parsing output — a grep for "FAILED" reads a compile error as green. Print one line per passing stage; on failure, the last lines plus the full-log path.
- Prove a new check fires: inject the defect it exists to catch, watch it fail by name, revert. A check over a discovered corpus asserts a named minimum set it must reach, so a broken glob cannot pass on emptiness; allowlist entries assert they still match, so a stale exemption fails instead of outliving its purpose.
- Every guard states its failure direction — fail open or fail closed — and why. Advisory instrumentation passes through the wrapped command's real exit code. A monitor that fails every run reports nothing: fix it or delete it.
- After an incident, add a permanent check that would have caught it. Do not rely on remembering.
