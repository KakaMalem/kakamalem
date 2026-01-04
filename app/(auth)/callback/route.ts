import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      // Determine redirect URL based on confirmation type
      let redirectPath = next;
      if (type === "signup" || type === "email") {
        redirectPath = "/confirm?type=email_confirmed";
      } else if (type === "recovery") {
        redirectPath = "/confirm?type=recovery";
      } else if (type === "email_change") {
        redirectPath = "/confirm?type=email_change";
      }

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${redirectPath}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`);
      } else {
        return NextResponse.redirect(`${origin}${redirectPath}`);
      }
    }
  }

  // Redirect to error page on failure
  return NextResponse.redirect(`${origin}/error?error=invalid_request&error_description=Unable to verify your email. Please try again.`);
}
