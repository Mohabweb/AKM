import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Keeps the admin session cookie fresh and bounces anonymous visitors away from /admin. Real authorization is
 *  re-checked in every page and server action (lib/auth.ts) and again by RLS in the database. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  if (!data.user && pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
