import seedJobs from "../../data/jobs.json";
import { auth } from "@clerk/nextjs/server";
import { listStoredJobs, saveStoredJob, type StoredJobRow } from "../../../db/jobs-store";
import { summarizeJobs } from "../../lib/job-analytics";
import type { JobDirectories, JobRecord } from "../../lib/job-types";

export type { JobRecord } from "../../lib/job-types";

const sourceJobs = seedJobs as JobRecord[];

const cleanText = (value: unknown) => {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result || null;
};

export function normalizeJob(payload: Record<string, unknown>, fallbackId?: number): JobRecord {
  const dispatchDate = cleanText(payload.dispatchDate);
  const address = cleanText(payload.address);
  if (!dispatchDate || !/^\d{4}-\d{2}-\d{2}$/.test(dispatchDate)) {
    throw new Error("A valid dispatch date is required.");
  }
  if (!address) throw new Error("The job address is required.");

  return {
    id: fallbackId ?? Date.now(),
    division: cleanText(payload.division) ?? "TTS",
    dispatchDate,
    address,
    workOrder: cleanText(payload.workOrder),
    installer: cleanText(payload.installer),
    projectManager: cleanText(payload.projectManager),
    subdivision: cleanText(payload.subdivision),
    installScope: cleanText(payload.installScope),
    service: payload.service === true,
    builder: cleanText(payload.builder),
    templateDate: cleanText(payload.templateDate),
    dueDate: cleanText(payload.dueDate),
    onTime: payload.onTime === true ? true : payload.onTime === false ? false : null,
  };
}

export function fromDb(row: StoredJobRow): JobRecord {
  return {
    id: Number(row.id),
    division: row.division,
    dispatchDate: row.dispatch_date,
    address: row.address,
    workOrder: row.work_order,
    installer: row.installer,
    projectManager: row.project_manager,
    subdivision: row.subdivision,
    installScope: row.install_scope,
    service: row.service,
    builder: row.builder,
    templateDate: row.template_date,
    dueDate: row.due_date,
    onTime: row.on_time,
  };
}

export async function upsertJob(job: JobRecord, userId: string) {
  await saveStoredJob(job, userId);
  return job;
}

function matches(job: JobRecord, params: URLSearchParams) {
  const date = params.get("date");
  const from = params.get("from");
  const to = params.get("to");
  const query = params.get("q")?.trim().toLowerCase();
  const installer = params.get("installer");
  const type = params.get("type");
  const scope = params.get("scope");
  if (date && job.dispatchDate !== date) return false;
  if (from && (!job.dispatchDate || job.dispatchDate < from)) return false;
  if (to && (!job.dispatchDate || job.dispatchDate > to)) return false;
  if (installer && installer !== "all" && job.installer !== installer) return false;
  if (type === "service" && !job.service) return false;
  if (type === "install" && job.service) return false;
  const isFullHouse = (job.installScope ?? "").toUpperCase().includes("FULL HOUSE");
  if (scope === "full-house" && !isFullHouse) return false;
  if (scope === "partial" && isFullHouse) return false;
  if (query) {
    const haystack = [job.address, job.workOrder, job.installer, job.builder, job.subdivision, job.installScope]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

const distinct = (values: Array<string | null>) => [
  ...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
].sort((first, second) => first.localeCompare(second, "en-US", { sensitivity: "base" }));

function createDirectories(jobs: JobRecord[]): JobDirectories {
  return {
    installers: distinct(jobs.map((job) => job.installer)),
    projectManagers: distinct(jobs.map((job) => job.projectManager)),
    builders: distinct(jobs.map((job) => job.builder)),
    subdivisions: distinct(jobs.map((job) => job.subdivision)),
  };
}

const xmlEscape = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const excelTextCell = (value: unknown, style = "") =>
  `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;

const excelNumberCell = (value: number) =>
  `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;

const excelDateCell = (value: string | null) => value
  ? `<Cell ss:StyleID="Date"><Data ss:Type="DateTime">${value}T00:00:00.000</Data></Cell>`
  : excelTextCell("");

function createExcelExport(jobs: JobRecord[]) {
  const headers = [
    "Record ID", "Division", "Dispatch Date", "Address", "Work Order", "Installer",
    "Project Manager", "Subdivision", "Install Scope", "Work Type", "Builder",
    "Template Date", "Due Date", "OT Status",
  ];
  const rows = jobs.map((job) => `<Row>
    ${excelNumberCell(job.id)}
    ${excelTextCell(job.division)}
    ${excelDateCell(job.dispatchDate)}
    ${excelTextCell(job.address)}
    ${excelTextCell(job.workOrder)}
    ${excelTextCell(job.installer)}
    ${excelTextCell(job.projectManager)}
    ${excelTextCell(job.subdivision)}
    ${excelTextCell(job.installScope)}
    ${excelTextCell(job.service ? "Service" : "Install")}
    ${excelTextCell(job.builder)}
    ${excelDateCell(job.templateDate)}
    ${excelDateCell(job.dueDate)}
    ${excelTextCell(job.onTime == null ? "Pending" : job.onTime ? "On time" : "Late")}
  </Row>`).join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
  <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#171816" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="Date"><NumberFormat ss:Format="mmm d, yyyy"/></Style>
 </Styles>
 <Worksheet ss:Name="Dispatch">
  <Table>
   <Column ss:Width="62"/><Column ss:Width="74"/><Column ss:Width="94"/><Column ss:Width="180"/><Column ss:Width="86"/><Column ss:Width="94"/><Column ss:Width="110"/><Column ss:Width="120"/><Column ss:Width="140"/><Column ss:Width="78"/><Column ss:Width="110"/><Column ss:Width="94"/><Column ss:Width="94"/><Column ss:Width="74"/>
   <Row ss:Height="24">${headers.map((header) => excelTextCell(header, "Header")).join("")}</Row>
   ${rows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>
  <AutoFilter x:Range="R1C1:R${jobs.length + 1}C14" xmlns="urn:schemas-microsoft-com:office:excel"/>
 </Worksheet>
</Workbook>`;
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const overrides = await listStoredJobs();
    const combined = new Map<number, JobRecord>(sourceJobs.map((job) => [job.id, job]));
    for (const row of overrides) combined.set(Number(row.id), fromDb(row));

    const params = new URL(request.url).searchParams;
    const allJobs = [...combined.values()];
    const directories = createDirectories(allJobs);
    const filtered = allJobs.filter((job) => matches(job, params));
    filtered.sort((a, b) =>
      (a.dispatchDate ?? "").localeCompare(b.dispatchDate ?? "") ||
      (a.address ?? "").localeCompare(b.address ?? ""),
    );
    const from = params.get("from");
    const to = params.get("to");
    if (params.get("format") === "xls") {
      const filename = `tts-dispatch-${from ?? "all"}-to-${to ?? "all"}.xls`;
      return new Response(`\uFEFF${createExcelExport(filtered)}`, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const { metrics, analytics } = summarizeJobs(filtered, from, to);

    return Response.json({
      jobs: filtered.slice(0, 250),
      total: filtered.length,
      metrics,
      analytics,
      directories,
      dateRange: { from, to },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load jobs." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const payload = (await request.json()) as Record<string, unknown>;
    const job = normalizeJob(payload);
    await upsertJob(job, userId);
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to add the job." },
      { status: 400 },
    );
  }
}
