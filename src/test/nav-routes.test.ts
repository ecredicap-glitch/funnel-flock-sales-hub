import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { NAV_ITEMS } from "@/lib/nav";

describe("Navigation", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it.each(NAV_ITEMS.map((i) => i.to))("%s resolves to a real page", (path) => {
    const leaf = router.matchRoutes(path).at(-1);
    expect(leaf?.routeId).not.toBe(rootRouteId);
    expect(leaf?.routeId).toContain("/_authenticated/_app");
  });

  it("keeps the mobile bottom bar at 4 items plus 'Mais'", () => {
    expect(NAV_ITEMS.filter((i) => i.mobile)).toHaveLength(4);
  });
});
