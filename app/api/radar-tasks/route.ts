import { NextResponse, type NextRequest } from "next/server";

import { createRadarTask, listRadarTasks } from "@/lib/radar-tasks";

import { handleRadarTaskApiError, readJsonBody } from "./_api";

export async function GET(request: NextRequest) {
  try {
    const query = Object.fromEntries(request.nextUrl.searchParams);
    const result = await listRadarTasks(query);

    return NextResponse.json({ data: result.items });
  } catch (error) {
    return handleRadarTaskApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return body.response;
  }

  try {
    const task = await createRadarTask(body.data);

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    return handleRadarTaskApiError(error);
  }
}
