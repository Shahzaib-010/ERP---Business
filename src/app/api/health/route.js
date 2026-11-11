import { connection } from "next/server";
import { connectDB } from "@/server/db/mongoose";

export async function GET() {
  await connection(); // always run at request time; never prerender

  try {
    const conn = await connectDB();
    await conn.connection.db.admin().ping();
    return Response.json({ status: "ok", database: "ok" });
  } catch (err) {
    console.error("[health] database check failed:", err.message);
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
