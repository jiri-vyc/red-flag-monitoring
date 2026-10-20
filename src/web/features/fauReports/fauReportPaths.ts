/** Web route of a FAÚ report (OPO) detail. Not an API path; not in the sidebar menu. */
export function fauReportPath(reportId: string): string {
  return `/fau-reports/${encodeURIComponent(reportId)}`;
}
