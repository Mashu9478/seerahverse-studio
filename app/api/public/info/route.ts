import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { publicInfo } from "@/lib/public";

export const dynamic = "force-dynamic";

export const GET = handle(async () => NextResponse.json(await publicInfo()));
