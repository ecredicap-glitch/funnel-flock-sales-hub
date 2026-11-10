import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { membershipsQuery, profileQuery, WorkspaceProvider } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/_app")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(membershipsQuery(context.user.id)),
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
    ]);
  },
  pendingComponent: ShellLoading,
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return (
    <WorkspaceProvider userId={user.id}>
      <AppShell>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}

function ShellLoading() {
  return (
    <div className="bg-cockpit grid min-h-screen place-items-center">
      <span className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
