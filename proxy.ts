import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { informationTopics, routing } from "@/lib/i18n/routing";

const localize = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const [, , section, topic] = request.nextUrl.pathname.split("/");
  if (section === "information" && topic && !informationTopics.some((item) => item === topic)) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  if (section === "properties" && topic && !/^DEMO-00[1-6]$/.test(topic)
    && !(process.env.NODE_ENV === "development" && /^[a-f0-9]{8}-[a-f0-9-]{27}$/.test(topic))) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  return localize(request);
}

export const config = {
  matcher: ["/", "/(en|fr|km|zh|ja|de|es)/:path*"],
};
