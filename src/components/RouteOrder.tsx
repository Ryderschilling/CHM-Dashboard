import { moveJob } from "@/actions/jobs";
import { IconChevronUp, IconChevronDown } from "./icons";

/**
 * Move one stop up or down in the day's route.
 *
 * Server actions in plain forms, no client JS: the whole list is a server
 * component and a route reorder is rare enough that a round trip is fine.
 */
export default function RouteOrder({
  jobId,
  first,
  last,
}: {
  jobId: string;
  first: boolean;
  last: boolean;
}) {
  return (
    <div className="flex flex-col -my-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <form action={moveJob}>
        <input type="hidden" name="id" value={jobId} />
        <input type="hidden" name="dir" value="up" />
        <button
          type="submit"
          disabled={first}
          title="Earlier in the route"
          className="block p-0.5 text-[var(--mut)] hover:text-[var(--teal)] disabled:opacity-25 disabled:hover:text-[var(--mut)] transition-colors"
        >
          <IconChevronUp size={13} />
        </button>
      </form>
      <form action={moveJob}>
        <input type="hidden" name="id" value={jobId} />
        <input type="hidden" name="dir" value="down" />
        <button
          type="submit"
          disabled={last}
          title="Later in the route"
          className="block p-0.5 text-[var(--mut)] hover:text-[var(--teal)] disabled:opacity-25 disabled:hover:text-[var(--mut)] transition-colors"
        >
          <IconChevronDown size={13} />
        </button>
      </form>
    </div>
  );
}
