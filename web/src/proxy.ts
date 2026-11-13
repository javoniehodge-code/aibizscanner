import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except Next.js build assets and the favicon goes through the login check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
