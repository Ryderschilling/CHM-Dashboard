/** Small shared presentational pieces (server-safe). */

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

export function SectionHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="display font-semibold text-[17px] tracking-tight" style={{ fontStretch: "112%" }}>
          {title}
        </h2>
        {sub && <p className="text-[12.5px] text-[var(--mut)] mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-[13px] text-[var(--mut)]">{text}</div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ACTIVE: { cls: "badge-good", label: "Active" },
    LEAD: { cls: "badge-teal", label: "Lead" },
    ONE_TIME: { cls: "badge-violet", label: "One time" },
    PAUSED: { cls: "badge-warn", label: "Paused" },
    FORMER: { cls: "badge-mut", label: "Former" },
    PAID: { cls: "badge-good", label: "Paid" },
    DUE: { cls: "badge-warn", label: "Due" },
    UPCOMING: { cls: "badge-teal", label: "Upcoming" },
    OVERDUE: { cls: "badge-bad", label: "Overdue" },
    SCHEDULED: { cls: "badge-teal", label: "Scheduled" },
    DONE: { cls: "badge-good", label: "Done" },
    CANCELED: { cls: "badge-mut", label: "Canceled" },
    HIGH: { cls: "badge-bad", label: "High" },
    NORMAL: { cls: "badge-mut", label: "Normal" },
    LOW: { cls: "badge-mut", label: "Low" },
    // Water shutoff devices
    QUOTED: { cls: "badge-mut", label: "Quoted" },
    INSTALLED: { cls: "badge-good", label: "Installed" },
    REMOVED: { cls: "badge-mut", label: "Removed" },
    // Alert severity
    INFO: { cls: "badge-mut", label: "Info" },
    WARNING: { cls: "badge-warn", label: "Warning" },
    CRITICAL: { cls: "badge-bad", label: "Critical" },
    // Coverage records
    ENROLLED: { cls: "badge-teal", label: "Enrolled" },
    DRAFTED: { cls: "badge-warn", label: "Drafted" },
    SENT: { cls: "badge-good", label: "Sent" },
  };
  const m = map[status] ?? { cls: "badge-mut", label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

export const CATEGORY_LABEL: Record<string, string> = {
  RETAINER: "Retainer",
  A_LA_CARTE: "A la carte",
  PROJECT: "Project",
  ADD_ON: "Add-on",
  OTHER: "Other",
};

export const EXPENSE_LABEL: Record<string, string> = {
  LABOR: "Labor",
  SUPPLIES: "Supplies",
  GAS: "Gas",
  SOFTWARE: "Software",
  INSURANCE: "Insurance",
  MARKETING: "Marketing",
  OTHER: "Other",
};

export const CADENCE_LABEL: Record<string, string> = {
  MONTHLY: "Monthly",
  PER_VISIT: "Per visit",
  AD_HOC: "Ad hoc",
};

export const JOB_TYPES = [
  "Walkthrough",
  "Home watch visit",
  "Mail and packages",
  "Trash service",
  "Arrival prep",
  "Departure check",
  "On-call task",
  "Contractor meetup",
  "Storm prep",
  "Plant watering",
  "Rock install",
  "Other",
];

export const ALERT_KIND_LABEL: Record<string, string> = {
  LEAK: "Leak detected",
  HIGH_FLOW: "High flow",
  SHUTOFF_TRIGGERED: "Valve closed itself",
  LOW_TEMP: "Low temperature",
  FREEZE_RISK: "Freeze risk",
  OFFLINE: "Device offline",
  BATTERY: "Battery",
  TEST: "Test",
  OTHER: "Other",
};
