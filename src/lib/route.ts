/**
 * The order you actually drive the day in.
 *
 * Google Calendar has no idea what order a route runs in, and almost every CHM
 * job is an all-day event, so time-of-day sorts everything into a meaningless
 * tie. `Job.routeOrder` is the tiebreak Ryder sets by hand with the arrows on
 * /jobs. Null means unordered, which sinks to the bottom.
 *
 * One comparator, used by both the page and the reorder action, so the arrows
 * always move a row to where the eye says it should land.
 */
export type RouteSortable = {
  id: string;
  title: string;
  date: Date;
  allDay: boolean;
  routeOrder: number | null;
};

export function routeSort(a: RouteSortable, b: RouteSortable): number {
  const ao = a.routeOrder ?? 9_999;
  const bo = b.routeOrder ?? 9_999;
  if (ao !== bo) return ao - bo;
  // A job with a clock time comes before the all-day pile.
  if (a.allDay !== b.allDay) return a.allDay ? 1 : -1;
  if (!a.allDay && !b.allDay) {
    const t = a.date.getTime() - b.date.getTime();
    if (t !== 0) return t;
  }
  return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}
