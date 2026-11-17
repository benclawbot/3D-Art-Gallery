import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
export async function GET() { return Response.json({ signedIn: Boolean(await getChatGPTUser()) }, { headers: { "cache-control": "no-store" } }); }
