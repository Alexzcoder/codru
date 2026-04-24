export type CalendarItem = {
  id: string;
  kind: "JOB" | "EVENT";
  title: string;
  subtitle: string | null;
  start: Date;
  end: Date | null;
  allDay: boolean;
  color: string;
  href: string;
  completedAt: Date | null;
  assigneeIds: string[];
  type: "MEETING" | "SITE_VISIT" | "REMINDER" | "OTHER" | "JOB";
};
