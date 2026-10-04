import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DownloadEvent = {
  created_at?: string | null;
  source?: string | null;
  visitor_hash?: string | null;
  download_success?: boolean | null;
};

function istDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";

  return `${year}-${month}-${day}`;
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(date);
}

function normalizeSource(value?: string | null) {
  const source = (value || "direct").trim();
  const lower = source.toLowerCase();

  if (
    lower.includes("whatsapp") ||
    lower.includes("wa.me") ||
    lower.includes("api.whatsapp.com")
  ) {
    return "WhatsApp";
  }

  if (
    lower.includes("newcitystyle.store/app") ||
    lower.includes("/app")
  ) {
    return "Website /app";
  }

  if (lower === "direct" || lower.length === 0) {
    return "Direct";
  }

  if (lower.includes("newcitystyle.store")) {
    return "Website";
  }

  return "Other";
}

function parseTotalFromContentRange(value: string | null) {
  if (!value) return 0;

  const match = value.match(/\/(\d+)$/);

  return match ? Number(match[1]) : 0;
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase server environment variables are missing.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };

    const [countResponse, eventsResponse] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/app_download_events?select=id&download_success=eq.true`,
        {
          method: "GET",
          headers: {
            ...headers,
            Prefer: "count=exact",
            Range: "0-0",
          },
          cache: "no-store",
        },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/app_download_events?select=created_at,source,visitor_hash,download_success&download_success=eq.true&order=created_at.desc&limit=5000`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        },
      ),
    ]);

    if (!countResponse.ok) {
      throw new Error(
        `Unable to count app downloads (${countResponse.status}).`,
      );
    }

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();

      throw new Error(
        `Unable to read app downloads (${eventsResponse.status}): ${errorText}`,
      );
    }

    const events = (await eventsResponse.json()) as DownloadEvent[];

    const totalDownloads = parseTotalFromContentRange(
      countResponse.headers.get("content-range"),
    );

    const now = new Date();
    const todayKey = istDateKey(now);

    const daily = Array.from({ length: 7 }, (_, index) => {
      const daysAgo = 6 - index;
      const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      return {
        key: istDateKey(date),
        label: dayLabel(date),
        downloads: 0,
      };
    });

    const dailyMap = new Map(
      daily.map((item) => [item.key, item]),
    );

    const sourceMap = new Map<string, number>();
    const visitorHashes = new Set<string>();

    let todayDownloads = 0;

    for (const event of events) {
      if (!event.created_at) continue;

      const eventDate = new Date(event.created_at);

      if (Number.isNaN(eventDate.getTime())) continue;

      const key = istDateKey(eventDate);

      if (key === todayKey) {
        todayDownloads += 1;
      }

      const dailyItem = dailyMap.get(key);

      if (dailyItem) {
        dailyItem.downloads += 1;
      }

      if (event.visitor_hash) {
        visitorHashes.add(event.visitor_hash);
      }

      const source = normalizeSource(event.source);

      sourceMap.set(
        source,
        (sourceMap.get(source) || 0) + 1,
      );
    }

    const sources = Array.from(sourceMap.entries())
      .map(([source, downloads]) => ({
        source,
        downloads,
      }))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 6);

    const last7DaysDownloads = daily.reduce(
      (sum, item) => sum + item.downloads,
      0,
    );

    return NextResponse.json(
      {
        ok: true,
        totalDownloads,
        todayDownloads,
        uniqueVisitors: visitorHashes.size,
        last7DaysDownloads,
        daily,
        sources,
        sampledEvents: events.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("NCS app download stats failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load app download analytics.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
