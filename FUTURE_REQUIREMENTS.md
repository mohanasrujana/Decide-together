# Future Requirements

## Participant identity and names

1. **Keep authentication identity authoritative**
   - Continue using DeepSpace's authenticated, immutable `userId` to identify participants and own scores, votes, comments, and presence records.
   - Display names and usernames must never be used for authorization, uniqueness of votes, or record ownership.

2. **Make collaborators distinguishable in a room**
   - Display the account name when it is available.
   - Fall back to a room-scoped label such as `Participant 1`, `Participant 2`, and so on.
   - Two accounts with the same displayed name must remain separate participants because their authenticated `userId` values differ.

3. **Support editable display names**
   - Allow a signed-in user to choose an optional display name.
   - Display names do not need to be globally unique.
   - Existing collaboration data must remain attached to the same authenticated `userId` when a display name changes.

4. **Introduce unique usernames only when the product needs them**
   - Add globally unique usernames only alongside public profiles, user search, or `@mentions`.
   - Enforce uniqueness server-side with normalized, case-insensitive values and a race-safe reservation or constraint.
   - Keep the username separate from the immutable authenticated `userId`, and define a safe rename policy before launch.

