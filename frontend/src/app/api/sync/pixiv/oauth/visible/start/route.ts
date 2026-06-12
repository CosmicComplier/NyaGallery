import { NextRequest } from "next/server";

const backend = process.env.NYA_API_BACKEND || "http://127.0.0.1:8001";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(`${backend}/api/sync/pixiv/oauth/visible/start`, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") || "application/json",
        "authorization": request.headers.get("authorization") || "",
        "cookie": request.headers.get("cookie") || "",
        "x-csrf-token": request.headers.get("x-csrf-token") || "",
      },
      body: await request.text(),
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ detail: message }, { status: 502 });
  }
}
