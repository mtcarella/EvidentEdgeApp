# Project memory

## Product intent & audience

- App includes an **Admin Panel** with a **Users management** screen.
- User management supports three states/actions: **activate**, **deactivate** (lock out), and **permanent delete**.
- Likely an internal/admin tool for managing user access control.

## Brand personality & voice

- Conversational, transparent tone; acknowledges mistakes and corrects prior misinformation directly.

## Visual design & UX direction

- Users list uses **row-based layout**; action controls appear at the far right of each row.
- Action buttons are **labeled, color-coded buttons** rather than ambiguous icons:
  - **Orange** = Deactivate (active users)
  - **Green** = Reactivate (deactivated users)
  - **Red trash can** = Permanent delete
- Prior pattern of using small, similar-looking trash-can icons for different actions was rejected as unclear; prefer explicit labels for destructive or state-changing actions.
- Stack: Vite + React (JSX), Tailwind CSS, Lucide React icons.

## Decisions, constraints & rationale

- Replaced icon-only deactivate/reactivate controls with labeled color buttons because tiny trash-can icons were indistinguishable from the permanent-delete icon.
- Deactivate and reactivate are mutually exclusive per row (one shows depending on user state).
- Assistant cannot visually verify rendered pages; relies on user feedback to confirm UI correctness.

## Open questions & assumptions

- Assumption: user state toggling (deactivate/reactivate) persists via a backend or local store — unconfirmed.
- Unverified whether the labeled buttons render correctly for the user; awaiting confirmation.
- Unclear if there are other admin screens beyond Users.