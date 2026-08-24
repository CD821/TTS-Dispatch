import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { BreakdownItem, DailyItem, JobAnalytics, RangeMetrics } from "./job-types";

type ReportFilters = {
  work: string | null;
  scope: string | null;
  installer: string | null;
};

type InsightsPdfInput = {
  metrics: RangeMetrics;
  analytics: JobAnalytics;
  from: string | null;
  to: string | null;
  filters: ReportFilters;
  generatedAt?: Date;
};

type Fonts = { regular: PDFFont; bold: PDFFont };
type MixItem = { label: string; count: number; color: RGB };

const PAGE_SIZE: [number, number] = [792, 612];
const INK = rgb(0.09, 0.095, 0.086);
const MUTED = rgb(0.45, 0.47, 0.43);
const LINE = rgb(0.9, 0.91, 0.88);
const PANEL = rgb(0.975, 0.98, 0.965);
const WHITE = rgb(1, 1, 1);
const APPLE = rgb(0.72, 0.875, 0.2);
const APPLE_DARK = rgb(0.38, 0.49, 0.04);
const LATE = rgb(0.9, 0.4, 0.31);
const PENDING = rgb(0.79, 0.8, 0.77);
const BLUE = rgb(0.29, 0.48, 0.72);
const CHARCOAL = rgb(0.31, 0.33, 0.29);

const normalizeText = (value: unknown) => String(value ?? "")
  .replace(/[^\x20-\x7E]/g, "-")
  .replace(/\s+/g, " ")
  .trim();

const percent = (value: number | null) => value == null ? "-" : `${Math.round(value * 100)}%`;

const parseDate = (value: string) => new Date(`${value}T12:00:00`);

const formatRange = (from: string | null, to: string | null) => {
  if (!from && !to) return "All dispatch dates";
  if (from && to) {
    const start = parseDate(from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const end = parseDate(to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${start} - ${end}`;
  }
  return from ? `From ${from}` : `Through ${to}`;
};

const fitText = (value: string, font: PDFFont, size: number, maxWidth: number) => {
  const text = normalizeText(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
};

const drawCard = (page: PDFPage, x: number, y: number, width: number, height: number) => {
  page.drawRectangle({ x, y, width, height, color: WHITE, borderColor: LINE, borderWidth: 0.7 });
};

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  rangeLabel: string,
  filterLabel: string,
) {
  page.drawRectangle({ x: 36, y: 537, width: 38, height: 38, color: INK });
  page.drawText("T", { x: 48.5, y: 547.5, size: 18, font: fonts.bold, color: APPLE });
  page.drawText("TTS DISPATCH", { x: 88, y: 563, size: 8, font: fonts.bold, color: APPLE_DARK });
  page.drawText("Management Insights", { x: 88, y: 541, size: 22, font: fonts.bold, color: INK });
  page.drawText(rangeLabel, { x: 510, y: 559, size: 9, font: fonts.bold, color: INK });
  page.drawText(fitText(filterLabel, fonts.regular, 7.5, 246), {
    x: 510,
    y: 543,
    size: 7.5,
    font: fonts.regular,
    color: MUTED,
  });
  page.drawLine({ start: { x: 36, y: 523 }, end: { x: 756, y: 523 }, thickness: 0.8, color: LINE });
}

function drawKpi(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  detail: string,
) {
  drawCard(page, x, y, width, 76);
  page.drawText(normalizeText(label).toUpperCase(), { x: x + 14, y: y + 55, size: 7, font: fonts.bold, color: MUTED });
  page.drawText(normalizeText(value), { x: x + 14, y: y + 27, size: 23, font: fonts.bold, color: INK });
  page.drawText(fitText(detail, fonts.regular, 7.5, width - 28), { x: x + 14, y: y + 12, size: 7.5, font: fonts.regular, color: MUTED });
}

function drawMix(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  y: number,
  width: number,
  title: string,
  items: MixItem[],
) {
  const height = 104;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  drawCard(page, x, y, width, height);
  page.drawText(title, { x: x + 14, y: y + 82, size: 10, font: fonts.bold, color: INK });
  page.drawText(String(total), { x: x + width - 34, y: y + 81, size: 12, font: fonts.bold, color: INK });

  const barX = x + 14;
  const barY = y + 55;
  const barWidth = width - 28;
  page.drawRectangle({ x: barX, y: barY, width: barWidth, height: 10, color: PANEL });
  let cursor = barX;
  for (const item of items) {
    const segment = total ? barWidth * (item.count / total) : 0;
    if (segment > 0) page.drawRectangle({ x: cursor, y: barY, width: segment, height: 10, color: item.color });
    cursor += segment;
  }

  const columnWidth = barWidth / Math.max(1, items.length);
  items.forEach((item, index) => {
    const itemX = barX + index * columnWidth;
    page.drawRectangle({ x: itemX, y: y + 25, width: 6, height: 6, color: item.color });
    page.drawText(fitText(item.label, fonts.regular, 6.8, columnWidth - 13), {
      x: itemX + 10,
      y: y + 25,
      size: 6.8,
      font: fonts.regular,
      color: MUTED,
    });
    const share = total ? Math.round((item.count / total) * 100) : 0;
    page.drawText(`${item.count} / ${share}%`, { x: itemX, y: y + 11, size: 7.4, font: fonts.bold, color: INK });
  });
}

type DailyBucket = Pick<DailyItem, "total" | "onTime" | "late" | "pending"> & { label: string };

function bucketDaily(items: DailyItem[]): DailyBucket[] {
  if (items.length <= 14) {
    return items.map((item) => ({
      label: parseDate(item.date).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      total: item.total,
      onTime: item.onTime,
      late: item.late,
      pending: item.pending,
    }));
  }
  const bucketSize = Math.ceil(items.length / 14);
  const buckets: DailyBucket[] = [];
  for (let index = 0; index < items.length; index += bucketSize) {
    const group = items.slice(index, index + bucketSize);
    const start = parseDate(group[0].date).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
    const end = parseDate(group[group.length - 1].date).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
    buckets.push({
      label: start === end ? start : `${start}-${end}`,
      total: group.reduce((sum, item) => sum + item.total, 0),
      onTime: group.reduce((sum, item) => sum + item.onTime, 0),
      late: group.reduce((sum, item) => sum + item.late, 0),
      pending: group.reduce((sum, item) => sum + item.pending, 0),
    });
  }
  return buckets;
}

function drawDailyChart(page: PDFPage, fonts: Fonts, analytics: JobAnalytics) {
  const x = 36;
  const y = 52;
  const width = 720;
  const height = 226;
  drawCard(page, x, y, width, height);
  page.drawText("On-time delivery by dispatch day", { x: x + 16, y: y + height - 23, size: 11, font: fonts.bold, color: INK });

  const legend = [
    { label: "On time", color: APPLE },
    { label: "Late", color: LATE },
    { label: "Pending", color: PENDING },
  ];
  legend.forEach((item, index) => {
    const itemX = x + width - 188 + index * 62;
    page.drawRectangle({ x: itemX, y: y + height - 23, width: 6, height: 6, color: item.color });
    page.drawText(item.label, { x: itemX + 9, y: y + height - 24, size: 6.6, font: fonts.regular, color: MUTED });
  });

  const buckets = bucketDaily(analytics.daily);
  const maximum = Math.max(1, ...buckets.map((item) => item.total));
  const chartX = x + 25;
  const chartY = y + 34;
  const chartWidth = width - 50;
  const chartHeight = height - 72;
  page.drawLine({ start: { x: chartX, y: chartY }, end: { x: chartX + chartWidth, y: chartY }, thickness: 0.7, color: LINE });

  if (!buckets.length) {
    page.drawText("No jobs in this date range.", { x: x + 16, y: y + 96, size: 9, font: fonts.regular, color: MUTED });
    return;
  }

  const step = chartWidth / buckets.length;
  const barWidth = Math.min(24, step * 0.55);
  buckets.forEach((item, index) => {
    const barX = chartX + index * step + (step - barWidth) / 2;
    const totalHeight = item.total ? Math.max(3, chartHeight * (item.total / maximum)) : 0;
    let stackY = chartY;
    const segments = [
      { count: item.onTime, color: APPLE },
      { count: item.late, color: LATE },
      { count: item.pending, color: PENDING },
    ];
    for (const segment of segments) {
      const segmentHeight = item.total ? totalHeight * (segment.count / item.total) : 0;
      if (segmentHeight > 0) page.drawRectangle({ x: barX, y: stackY, width: barWidth, height: segmentHeight, color: segment.color });
      stackY += segmentHeight;
    }
    if (item.total) {
      const countText = String(item.total);
      page.drawText(countText, {
        x: barX + (barWidth - fonts.bold.widthOfTextAtSize(countText, 6.5)) / 2,
        y: chartY + totalHeight + 4,
        size: 6.5,
        font: fonts.bold,
        color: MUTED,
      });
    }
    const label = fitText(item.label, fonts.regular, 6.2, step - 2);
    page.drawText(label, {
      x: chartX + index * step + (step - fonts.regular.widthOfTextAtSize(label, 6.2)) / 2,
      y: chartY - 14,
      size: 6.2,
      font: fonts.regular,
      color: MUTED,
    });
  });
}

function drawRankedCard(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  items: BreakdownItem[],
) {
  drawCard(page, x, y, width, height);
  page.drawText(title, { x: x + 14, y: y + height - 23, size: 10.5, font: fonts.bold, color: INK });
  page.drawText(`Top ${Math.min(8, items.length)}`, { x: x + width - 44, y: y + height - 22, size: 7, font: fonts.regular, color: MUTED });
  const visible = items.slice(0, 8);
  const maximum = Math.max(1, ...visible.map((item) => item.count));
  if (!visible.length) {
    page.drawText("No jobs in this date range.", { x: x + 14, y: y + height / 2, size: 8, font: fonts.regular, color: MUTED });
    return;
  }

  visible.forEach((item, index) => {
    const rowY = y + height - 48 - index * 22;
    page.drawText(fitText(item.label, fonts.bold, 7.2, 116), { x: x + 14, y: rowY, size: 7.2, font: fonts.bold, color: CHARCOAL });
    const trackX = x + 135;
    const countText = String(item.count);
    const countX = x + width - 16 - fonts.bold.widthOfTextAtSize(countText, 7.2);
    const otLabel = item.ratedCount ? `${percent(item.onTimeRate)} OT` : "No OT";
    const otX = countX - 10 - fonts.regular.widthOfTextAtSize(otLabel, 6.3);
    const trackWidth = Math.max(20, otX - trackX - 8);
    page.drawRectangle({ x: trackX, y: rowY + 1, width: trackWidth, height: 6, color: PANEL });
    page.drawRectangle({ x: trackX, y: rowY + 1, width: Math.max(2, trackWidth * (item.count / maximum)), height: 6, color: APPLE });
    page.drawText(otLabel, { x: otX, y: rowY, size: 6.3, font: fonts.regular, color: MUTED });
    page.drawText(countText, { x: countX, y: rowY, size: 7.2, font: fonts.bold, color: INK });
  });
}

function drawPageTwoHeader(page: PDFPage, fonts: Fonts, rangeLabel: string) {
  page.drawText("Operational breakdowns", { x: 36, y: 558, size: 19, font: fonts.bold, color: INK });
  page.drawText(rangeLabel, { x: 36, y: 541, size: 8, font: fonts.regular, color: MUTED });
  page.drawLine({ start: { x: 36, y: 525 }, end: { x: 756, y: 525 }, thickness: 0.8, color: LINE });
}

function filterLabel(filters: ReportFilters) {
  const work = filters.work === "install" ? "Installs" : filters.work === "service" ? "Services" : "All work";
  const scope = filters.scope === "full-house" ? "Full house" : filters.scope === "partial" ? "Partial" : "All scopes";
  const installer = filters.installer && filters.installer !== "all" ? filters.installer : "All installers";
  return `Filters: ${work} | ${scope} | ${installer}`;
}

function drawFooter(page: PDFPage, fonts: Fonts, pageNumber: number, generatedAt: Date) {
  const generated = generatedAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  page.drawText(`Generated from TTS Dispatch - ${generated}`, { x: 36, y: 22, size: 6.5, font: fonts.regular, color: MUTED });
  page.drawText(`Page ${pageNumber} of 2`, { x: 708, y: 22, size: 6.5, font: fonts.regular, color: MUTED });
}

export async function createInsightsPdf({
  metrics,
  analytics,
  from,
  to,
  filters,
  generatedAt = new Date(),
}: InsightsPdfInput) {
  const document = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const rangeLabel = formatRange(from, to);
  document.setTitle(`TTS Dispatch Management Insights - ${rangeLabel}`);
  document.setAuthor("TTS Dispatch");
  document.setSubject("Dispatch performance and operational breakdowns");
  document.setCreator("TTS Dispatch");
  document.setCreationDate(generatedAt);

  const firstPage = document.addPage(PAGE_SIZE);
  drawHeader(firstPage, fonts, rangeLabel, filterLabel(filters));
  const kpiWidth = 172.5;
  drawKpi(firstPage, fonts, 36, 432, kpiWidth, "Jobs", String(metrics.total), `${metrics.installCount} installs / ${metrics.serviceCount} services`);
  drawKpi(firstPage, fonts, 218.5, 432, kpiWidth, "On time", percent(metrics.onTimeRate), `${metrics.onTimeCount} of ${metrics.ratedCount} rated jobs`);
  drawKpi(firstPage, fonts, 401, 432, kpiWidth, "Late", String(metrics.lateCount), "Explicitly marked late");
  drawKpi(firstPage, fonts, 583.5, 432, kpiWidth, "Awaiting OT", String(metrics.pendingCount), "No OT status entered");

  drawMix(firstPage, fonts, 36, 306, 233, "Work mix", [
    { label: "Installs", count: metrics.installCount, color: APPLE },
    { label: "Services", count: metrics.serviceCount, color: BLUE },
  ]);
  drawMix(firstPage, fonts, 279.5, 306, 233, "OT status mix", [
    { label: "On time", count: metrics.onTimeCount, color: APPLE },
    { label: "Late", count: metrics.lateCount, color: LATE },
    { label: "Pending", count: metrics.pendingCount, color: PENDING },
  ]);
  drawMix(firstPage, fonts, 523, 306, 233, "Full house vs partial", [
    { label: analytics.scopeMix[0]?.label ?? "Full house", count: analytics.scopeMix[0]?.count ?? 0, color: APPLE },
    { label: analytics.scopeMix[1]?.label ?? "Partial", count: analytics.scopeMix[1]?.count ?? 0, color: CHARCOAL },
  ]);
  drawDailyChart(firstPage, fonts, analytics);

  const secondPage = document.addPage(PAGE_SIZE);
  drawPageTwoHeader(secondPage, fonts, rangeLabel);
  drawRankedCard(secondPage, fonts, 36, 294, 350, 214, "Jobs by installer", analytics.byInstaller);
  drawRankedCard(secondPage, fonts, 406, 294, 350, 214, "Jobs by subdivision", analytics.bySubdivision);
  drawRankedCard(secondPage, fonts, 36, 58, 350, 214, "Jobs by builder", analytics.byBuilder);
  drawRankedCard(secondPage, fonts, 406, 58, 350, 214, "Jobs by project manager", analytics.byProjectManager);

  drawFooter(firstPage, fonts, 1, generatedAt);
  drawFooter(secondPage, fonts, 2, generatedAt);
  return document.save();
}
