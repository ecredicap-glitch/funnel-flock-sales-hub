<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (ZapPilot)

- Multi-tenancy: every app table carries `workspace_id` and RLS uses `public.is_workspace_member()` / `public.has_workspace_role()` (security definer) — avoids recursive policies.
- Workspace roles live only in `public.members.role` (enum `member_role`), never on profiles — prevents privilege escalation.
- A signup trigger (`handle_new_user`) creates the profile, a first workspace and an admin membership; extra workspaces go through the `create_workspace` RPC — workspaces have no direct INSERT policy.
- Signed-in pages live under `src/routes/_authenticated/_app/` (gate in `_authenticated/route.tsx`, `ssr: false`; shell + workspace context in `_app.tsx`) — the session is in browser storage.
- Navigation entries are defined once in `src/lib/nav.ts` and feed the rail, bottom bar and command palette — keeps the three in sync.
- WhatsApp access goes through a `WhatsAppProvider` interface with swappable adapters; gateway credentials are server-only — the provider may change later.
