import { normalizeJob, upsertJob } from "../route";
import { auth } from "@clerk/nextjs/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId)) {
      return Response.json({ error: "Invalid job id." }, { status: 400 });
    }
    const payload = (await request.json()) as Record<string, unknown>;
    const job = normalizeJob(payload, numericId);
    await upsertJob(job, userId);
    return Response.json({ job });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update the job." },
      { status: 400 },
    );
  }
}
