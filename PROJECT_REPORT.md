# Decide Together — Project Report

## Project snapshot

- **Product:** Decide Together
- **Live application:** <https://decide-together.app.space>
- **Repository:** <https://github.com/mohanasrujana/decide-together>
- **DeepSpace app ID:** `app_01M1FM0SHPEGGMB9V0GD34C4BA`
- **Platform:** DeepSpace SDK `0.29.1`, React 19, TypeScript, Cloudflare Workers
- **Source authority:** GitHub (`mohanasrujana/decide-together`)
- **Status:** Deployed; automated suite passing; final production collaboration checks listed below

## What I built

Decide Together is a private, real-time decision room for small groups. A room owner defines a question, adds options and weighted criteria, and invites collaborators with a shareable link. Each participant scores options independently, discusses the decision, and casts one final vote. The application calculates a deterministic weighted ranking and can ask an AI model to explain the result without allowing the model to change it.

The focused goal was to make one important path complete: a person can create and score a decision alone, or two authenticated people can collaborate in the same room without refreshing or overwriting one another.

## Important user flow

1. A visitor signs in with DeepSpace authentication.
2. The user creates a private decision room with a title and question.
3. The room owner adds, edits, or deletes options.
4. The owner adds criteria and adjusts each criterion's weight from 1 to 5.
5. Participants score each option against each criterion from 1 to 5.
6. The ranking updates deterministically as scores arrive.
7. The owner shares an invite-only room URL.
8. A second authenticated account joins the room.
9. Presence, options, scores, comments, rankings, and votes update live without a refresh.
10. Each participant can hold only one final vote, but can change that vote.
11. After scores exist, the user can generate a structured AI explanation of the deterministic result.
12. The owner can complete or delete the decision.

## Features completed

### Decision workflow

- Authenticated room dashboard
- Create-room form
- Private, invite-only room pages
- Add, edit, and delete options
- Add criteria
- Criterion weight controls
- Per-user scoring matrix
- Deterministic weighted ranking
- Completion requirements and decision status
- Room deletion with child-record cleanup
- Empty, loading, success, and error states where appropriate

### Collaboration

- Shareable room invite link with an immutable invite token
- Participant membership stored on the room and related records
- Room-scoped record permissions
- Live presence count
- Real-time option, score, discussion, ranking, and vote updates
- Room discussion using synchronized comment records
- One final vote per authenticated user per room
- Vote changes update the existing vote instead of creating duplicates
- Owner-only edit controls for records that another participant created
- Participant limit of 20 per room

### AI explanation

- Server-side `generateDecisionSummary` action
- Anthropic `anthropic/chat-completion` integration with developer billing
- No provider key or privileged integration call in frontend code
- Structured room context containing options, criteria, deterministic rankings, scores, and vote counts
- Participant IDs replaced with `Participant 1`, `Participant 2`, and similar aliases before model submission
- Structured output validation before returning data to the UI
- Deterministic leading option enforced by the server even after parsing the model response
- Five explanation sections:
  - Leading option
  - Evidence supporting it
  - Major disagreement
  - Missing information
  - Suggested next action
- Loading, empty, error, retry, and success states
- Summary resets when options, criteria, or scores change, preventing stale explanations

## DeepSpace capabilities used

The application uses more than the required three platform capabilities in product-critical flows:

1. **Authentication**
   - Protected routes and actions use verified DeepSpace identity.
   - The authenticated `userId` is the authoritative identity for ownership, scores, comments, and votes.

2. **Synchronized record storage**
   - Rooms, options, criteria, scores, comments, and votes use DeepSpace collections.
   - Record subscriptions drive the live shared UI.

3. **Record permissions and collaboration fields**
   - Collections deny unauthenticated access by default.
   - `participantIds` is the collaboration field used to share room records only with room members.
   - `ownerField` and `userBound` protect per-user records.

4. **Presence**
   - Each room shows how many collaborators are currently online.
   - The two-user test verifies both sessions see `2 online` without refreshing.

5. **Anthropic AI integration**
   - A server action calls `anthropic/chat-completion` using DeepSpace's integration mechanism.
   - The model explains an already-computed result; it is not the ranking engine.

Room discussion is implemented as synchronized `decision-comments` records. This makes messages durable and live, but it should not be misrepresented as use of a separate DeepSpace messaging primitive.

## Data model

### `decision-rooms`

- `title`
- `question`
- `status`: `draft`, `scoring`, `revealed`, or `closed`
- `participantIds`
- Immutable `inviteToken`

### `decision-options`

- Immutable `roomId`
- `title`
- Optional `description`
- `participantIds`

### `decision-criteria`

- Immutable `roomId`
- `name`
- Numeric `weight`
- `participantIds`

### `decision-scores`

- Immutable `roomId`, `optionId`, `criterionId`, and `userId`
- Numeric score `value`
- `participantIds`
- Unique constraint on `(roomId, optionId, criterionId, userId)`

### `decision-comments`

- Immutable `roomId` and `userId`
- Comment `content`
- `participantIds`

### `decision-votes`

- Immutable `roomId` and `userId`
- Selected `optionId`
- `participantIds`
- Unique constraint on `(roomId, userId)`

The unique score and vote constraints are important concurrency protections. User-facing names are not used as identities; two accounts remain distinct even if their displayed names match.

## Ranking behavior

For each option, the application uses:

```text
option score = sum(user score × criterion weight) / sum(criterion weights)
```

For multiple contributors, the denominator is the total criterion weight multiplied by the contributor count. This is equivalent to averaging each contributor's weighted option score. Rankings are sorted by descending score, with option title as a stable tie-breaker.

The calculation lives in application code and is covered by unit tests. AI receives this ranking as authoritative input and cannot reorder or replace it.

## Permission and integrity decisions

- All decision collections deny access to the unauthenticated wildcard role.
- Members can read records shared through `participantIds`.
- Per-user score, comment, and vote rows are bound to authenticated identity.
- A participant cannot read a room merely by knowing its record ID.
- The join action requires both the room ID and matching invite token.
- The join action updates existing child records with the new participant list before exposing the room.
- Closed rooms reject new joins.
- Only the room creator or app owner can delete a room.
- Room deletion removes child options, criteria, scores, comments, and votes before removing the room.
- The AI action performs an explicit room-access check before querying or sending room data.
- Invite tokens, provider credentials, and raw participant IDs are not included in the AI payload.

## AI architecture and guardrails

The frontend requests an explanation from a protected server action. The action loads the room and related records, verifies membership, computes the deterministic ranking, pseudonymizes participants, and sends structured data to Anthropic.

The model is instructed to return one JSON object with exactly the required fields. The server parses and validates every field and rejects missing or malformed output. It then replaces the returned `leadingOption` with the deterministic winner before sending the response to the client.

This design makes the AI a communication layer rather than a decision authority. If the integration fails, the numerical result remains available and unchanged.

## Loading, empty, and error behavior

- The AI panel shows an explicit empty state when no scores exist.
- The generate button is unavailable until a meaningful explanation can be requested.
- A loading state is visible while generation is in progress.
- Invalid or failed model output produces an error state with a local retry button.
- The API status page preserves its last successful catalog while displaying a refresh error.
- A first-load API failure shows an error and supports retry without navigating away.
- Incomplete rooms explain what must be added before completion.

## Testing and verification

### Unit tests

`src/lib/ranking.test.ts` contains three passing tests:

1. Ranks options using score multiplied by criterion weight over total weight.
2. Reports incomplete scoring without silently changing the denominator.
3. Averages independent user scores without one user overwriting another.

Latest validation result:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

`npm run validate` also completed TypeScript checking successfully.

### End-to-end and API tests

The complete DeepSpace test suite passed:

```text
13 passed (16.6s)
```

The suite covers:

- Static landing page loads without JavaScript errors.
- Static landing does not make an authentication request or open a WebSocket.
- Dynamic `/home` application boundary mounts.
- Logged-out users see the sign-in interface.
- Unknown routes show a 404.
- Authenticated user completes a weighted decision.
- Options can be added, edited, and deleted.
- Criteria weights affect the expected deterministic scores.
- A no-score room shows the AI empty state.
- Protected actions reject unauthenticated calls.
- Auth proxy responds.
- Real-time WebSocket endpoint connects.
- Two independent browser contexts render their own authenticated accounts.
- A non-member receives an unauthorized AI-action response before joining.
- Two users join, add options, score, discuss, and vote without refreshing.
- Live presence reaches two users.
- Scores remain independent and rankings include both contributors.
- Changing a vote does not increase the total vote count.
- API loading, success, stale-data error, and retry states work.

### Manual verification performed

- Confirmed the decision dashboard and room UI visually.
- Created options and criteria and used weight controls.
- Scored a two-option, two-criterion example.
- Verified `Gradual rollout` ranked first at `4.14` and `Full launch` ranked second at `3.29` for weights Risk `4` and Speed `3`.
- Exercised the AI invalid-output error state and retry button locally.
- Verified the corrected AI response contained all five requested sections and preserved `Gradual rollout` as the deterministic leader.
- Ran `npm run validate` successfully.
- Ran `npm run lint` successfully.
- Ran the full 13-test DeepSpace suite successfully.
- Deployed from a clean GitHub working tree.
- DeepSpace reported the edge deployment as confirmed.
- Opened the production application and confirmed the authenticated settings page loads.
- Created and scored the production verification decision and confirmed its weighted ranking.

### Production verification still to complete

These checks should be completed before portal submission and then marked as done:

- Generate the AI explanation in production and confirm all five sections appear.
- Open the production invite link using a genuinely separate account/browser profile.
- Confirm both production sessions show live presence and receive edits without refresh.
- Confirm production discussion and vote changes synchronize.
- Inspect runtime logs after the production path.
- Inspect DeepSpace activity, releases, and integration usage.

## Blockers encountered and how they were solved

### 1. Unsupported Node.js version

**Problem:** The machine was running Node `25.8.2`. DeepSpace requires supported lines such as Node 22.15+, 24, or 26, and both scaffolding and the development server refused to run.

**Resolution:** Switched to a supported Node 24 installation before continuing. This was an environment compatibility issue, not an application defect.

### 2. `nvm` was unavailable

**Problem:** The initial attempt used `nvm install 24`, but `nvm` was not installed in the shell.

**Resolution:** Used a supported Node installation method available on the Mac rather than relying on an absent version manager, then verified the active Node version.

### 3. Collaboration test requested the auth token incorrectly

**Problem:** The two-user test called `/api/auth/token` with `GET`, which returned `404`.

**Investigation:** The installed DeepSpace client implementation showed that `getAuthToken()` sends a credentialed `POST` request with a JSON content type.

**Resolution:** Updated the browser-side test request to use `POST`, `credentials: "include"`, and the expected header. The targeted collaboration test then passed.

### 4. Loading-state test was timing-dependent

**Problem:** The API-status test expected to observe `Loading integration catalog...`, but the mocked response sometimes completed before Playwright asserted the transient state.

**Resolution:** Replaced the timing assumption with a controlled promise gate. The route waits until the test observes the loading state, then the test releases the mocked response. This made the test deterministic instead of adding an arbitrary delay.

### 5. Missing `requestCount` variable in the repaired test

**Problem:** During the loading-test repair, the route handler incremented `requestCount` before the variable had been declared, causing a `ReferenceError`.

**Resolution:** Restored `let requestCount = 0` in the test scope. The full suite then passed.

### 6. Anthropic returned an explanation that failed validation

**Problem:** The first real AI request reached the integration but the model response was not accepted by the strict JSON parser. The UI correctly displayed `Explanation unavailable` and allowed retry.

**Resolution:** Tightened the server prompt, set temperature to `0`, required one directly parseable JSON object, supplied the exact JSON shape, and fixed the deterministic leading option in the prompt. The next real request passed validation and rendered the five sections.

### 7. `rg` was unavailable in the user's shell

**Problem:** A requested test search failed because Ripgrep was not installed.

**Resolution:** Used standard `grep` as the available read-only fallback. No product code change was required.

### 8. Source authority needed to remain unambiguous

**Problem:** DeepSpace applications can use different source-authority models, and mixing DeepSpace source commands with a GitHub-centric repository would create ambiguity.

**Resolution:** Kept GitHub as the sole source authority, used ordinary Git commits and pushes, and deployed with `npx deepspace deploy`. No `deepspace push` command was used. The first deployment permanently claimed the GitHub source for this app.

## Main tradeoff

The main tradeoff was choosing a focused, understandable decision workflow instead of adding more decision methods, public discovery, complex roles, or profile customization.

I prioritized correctness at collaboration boundaries: authenticated identity, private membership, per-user scores, one vote per user, deterministic rankings, explicit AI authorization, and a real two-browser test. This produced a smaller product with a working core rather than a broader product with fragile or unverified edges.

The AI feature follows the same tradeoff. It generates a concise explanation only after application code computes the result. I intentionally did not let the model perform the numerical ranking because deterministic code is easier to test, explain, and trust.

## What the coding agent did

I used a coding agent as a guided implementation and debugging partner. I directed it toward a deliberately small scope and asked it to:

- Break the work into sequential, verifiable steps.
- Review the DeepSpace authentication, records, permissions, presence, integration, testing, and deployment patterns.
- Help design the room, option, criterion, score, comment, and vote schemas.
- Help implement the dashboard, forms, editors, scoring matrix, ranking display, collaboration panel, and AI summary panel.
- Help design protected server actions for joining, deleting, and generating an explanation.
- Suggest focused unit, API, smoke, and two-user tests.
- Diagnose concrete failures from terminal output rather than guessing.
- Keep secrets and provider calls out of frontend code.

The agent was not permitted to commit without my approval. I ran commands, supplied test output, exercised the UI, evaluated the generated AI result, approved commits, pushed to GitHub, and performed the production deployment.

## What I verified or changed myself

- Confirmed the installed SDK's token request uses `POST` after the test received a `404`.
- Applied and reran the authentication-request fix.
- Reproduced and fixed the nondeterministic loading-state test.
- Restored the missing `requestCount` state after reading the failure.
- Ran TypeScript validation, unit tests, lint, targeted collaboration tests, and the full suite.
- Created a real decision manually and checked the weighted arithmetic shown in the UI.
- Triggered the real Anthropic integration and observed both its failure state and corrected success state.
- Reviewed the AI explanation to ensure it described, rather than replaced, the deterministic ranking.
- Reviewed staged changes before committing.
- Kept the Git working tree clean before deployment.
- Pushed the commits to the GitHub source repository.
- Ran the production deployment and opened the live application.

## Security and privacy notes

- No model key is present in frontend code.
- The deployment reported that no user-provided app secrets were shipped.
- DeepSpace authenticated `userId` values, not display names, enforce identity.
- Invite tokens are immutable and checked server-side.
- AI access is checked before room data is loaded for generation.
- Raw participant IDs are replaced with room-scoped aliases in the model payload.
- Collections default to denying unauthenticated access.
- The repository's source authority is GitHub, and the deployed working tree was clean.

## Known limitations

- Only room owners can edit the options and criteria they created; the app does not yet have explicit facilitator/editor roles.
- Participant display labels are basic, and editable display names are not implemented.
- Globally unique usernames are intentionally absent because there are no public profiles, user search, or `@mentions`.
- Discussion is a simple durable room thread without reactions, editing, threading, or moderation.
- The AI explanation is generated on demand and is not persisted or versioned.
- The join action updates existing child records sequentially and caps a room at 20 participants; this is appropriate for the exercise scope but not designed for large rooms.
- There is no notification system for offline participants.
- Production two-account collaboration still needs the final manual verification listed above.

## Future requirements

Participant identity and naming requirements are documented separately in [`FUTURE_REQUIREMENTS.md`](./FUTURE_REQUIREMENTS.md). The planned direction is:

1. Keep authenticated `userId` as the authoritative identity.
2. Display an account name or a room-scoped participant label.
3. Later support editable, non-unique display names without changing record ownership.
4. Add globally unique usernames only if public profiles, user search, or `@mentions` are introduced.

Other sensible follow-up work:

- Persist AI explanations with input/version metadata and allow room members to see the same explanation.
- Add facilitator and editor roles.
- Add accessible participant identity labels near scores, comments, and presence.
- Add integration-action unit tests with mocked valid, invalid, and failed model responses.
- Add production monitoring and a small retention policy for old rooms.
- Improve mobile layout and complete a dedicated accessibility pass.

## Deployment record

The application was deployed with:

```bash
npx deepspace deploy
```

Deployment result:

- Build completed successfully.
- 16 assets were collected and uploaded.
- Six Durable Object bindings were included in the manifest.
- The platform commit completed.
- Edge serving was confirmed.
- Live URL: <https://decide-together.app.space>

Because this app is GitHub-authoritative, future changes should use ordinary Git workflows followed by `npx deepspace deploy`. DeepSpace source verbs such as `push`, `pull`, `clone`, and `workspace` should not be used for this application.

## Submission note

I built Decide Together, a private real-time decision room where authenticated participants compare options using weighted criteria, score independently, discuss the choice, and cast one final vote. I used DeepSpace authentication, synchronized record storage with room-scoped permissions, presence/live updates, and the Anthropic integration through a protected server action. The application calculates rankings deterministically; AI only explains the result. My main tradeoff was prioritizing a reliable two-user workflow and clear authorization boundaries over public profiles and additional decision methods. I used a coding agent to help plan, implement, review, and debug focused pieces, while I ran the commands, reviewed changes, reproduced failures, verified the ranking and AI behavior manually, approved the commits, and deployed the app. Automated validation, lint, three ranking tests, and all 13 DeepSpace tests pass.

