import { NextResponse, type NextRequest } from "next/server";

import {
  deleteRadarTask,
  getRadarTask,
  updateRadarTask,
} from "@/lib/radar-tasks";

import { handleRadarTaskApiError, readJsonBody } from "../_api";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const task = await getRadarTask(id);

    return NextResponse.json({ data: task });
  } catch (error) {
    return handleRadarTaskApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return body.response;
  }

  try {
    const { id } = await context.params;
    const task = await updateRadarTask(id, body.data);

    return NextResponse.json({ data: task });
  } catch (error) {
    return handleRadarTaskApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await deleteRadarTask(id);

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleRadarTaskApiError(error);
  }
}
