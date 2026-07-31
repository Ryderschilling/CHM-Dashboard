import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate, toInputDate, isOverdue } from "@/lib/format";
import { AddTaskButton, EditTaskButton } from "@/components/launchers";
import { TaskToggle, TaskDelete } from "@/components/TaskBits";
import { StatusBadge, Empty } from "@/components/ui";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;

  const [openTasks, doneTasks, clients] = await Promise.all([
    prisma.task.findMany({
      where: { done: false },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { createdAt: "desc" }],
    }),
    prisma.task.findMany({
      where: { done: true },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const overdueTasks = openTasks.filter((t) => t.dueDate && isOverdue(t.dueDate));

  const row = (t: (typeof openTasks)[number]) => (
    <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0 group">
      <TaskToggle id={t.id} done={t.done} />
      <div className="flex-1 min-w-0">
        <p className={`text-[14px] ${t.done ? "line-through text-[var(--mut)]" : "font-medium"}`}>{t.title}</p>
        <p className="text-[12px] text-[var(--mut)]">
          {t.client && (
            <Link href={`/clients/${t.client.id}`} className="hover:text-[var(--teal)] transition-colors">
              {t.client.name}
            </Link>
          )}
          {t.client && t.notes ? " · " : ""}
          {t.notes}
        </p>
      </div>
      {!t.done && t.priority === "HIGH" && <StatusBadge status="HIGH" />}
      {t.dueDate && !t.done && (
        <span className={`text-[12px] shrink-0 ${isOverdue(t.dueDate) ? "text-[var(--bad)] font-semibold" : "text-[var(--mut)]"}`}>
          {isOverdue(t.dueDate) ? "Overdue · " : ""}{fmtDate(t.dueDate)}
        </span>
      )}
      <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
        <EditTaskButton
          clients={clients}
          task={{
            id: t.id,
            title: t.title,
            dueDate: toInputDate(t.dueDate),
            priority: t.priority,
            clientId: t.clientId,
            notes: t.notes,
          }}
        />
        <TaskDelete id={t.id} />
      </span>
    </div>
  );

  return (
    <Reveal className="in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1.5">
            {openTasks.length} open{overdueTasks.length ? ` · ${overdueTasks.length} overdue` : ""}
          </p>
          <h1 className="display font-semibold text-[28px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
            Tasks
          </h1>
        </div>
        <AddTaskButton clients={clients} autoOpen={sp.new === "1"} />
      </div>

      <div className="card px-5 py-2 mb-4">
        {openTasks.length === 0 ? (
          <Empty text="Task list is clear. Go sell something." />
        ) : (
          openTasks.map(row)
        )}
      </div>

      {doneTasks.length > 0 && (
        <details className="card px-5 py-3">
          <summary className="eyebrow cursor-pointer select-none py-1">
            Recently done ({doneTasks.length})
          </summary>
          <div className="pt-1">{doneTasks.map(row)}</div>
        </details>
      )}
    </Reveal>
  );
}
