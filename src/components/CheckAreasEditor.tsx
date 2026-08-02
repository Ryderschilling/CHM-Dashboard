"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useFire, useSubmit } from "./forms/useSubmit";
import {
  seedCheckAreas,
  createCheckArea,
  toggleCheckArea,
  deleteCheckArea,
} from "@/actions/visits";
import { CHECK_CATEGORIES, categoryRank } from "@/lib/checkAreas";
import { IconPlus, IconTrash } from "./icons";

export type Area = {
  id: string;
  label: string;
  category: string;
  active: boolean;
  sortOrder: number;
};

/**
 * Per-property walkthrough checklist. This is what the visit form loads and
 * what ends up, line by line, in the annual record. Trim it to the house:
 * no pool line on a house with no pool.
 */
export default function CheckAreasEditor({
  propertyId,
  address,
  areas,
}: {
  propertyId: string;
  address: string;
  areas: Area[];
}) {
  const [open, setOpen] = useState(false);
  const seed = useFire(seedCheckAreas);
  const toggle = useFire(toggleCheckArea);
  const [adding, setAdding] = useState(false);
  const { pending, onSubmit } = useSubmit(createCheckArea, () => setAdding(false));

  const active = areas.filter((a) => a.active).length;

  const grouped = [...new Set(areas.map((a) => a.category))]
    .sort((a, b) => categoryRank(a) - categoryRank(b))
    .map((c) => [c, areas.filter((a) => a.category === c).sort((x, y) => x.sortOrder - y.sortOrder)] as const);

  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        Checklist ({active})
      </button>

      <Modal title="Walkthrough checklist" open={open} onClose={() => setOpen(false)} wide>
        <p className="text-[12.5px] text-[var(--mut)] mb-4">
          {address}. These are the lines that show up on every visit report for this house,
          and line by line in the annual record. Every one starts at dry and good.
        </p>

        {areas.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[13px] text-[var(--mut)] mb-4">
              No checklist on this property yet.
            </p>
            <button
              className="btn btn-primary"
              disabled={seed.pending}
              onClick={() => seed.fire({ propertyId })}
            >
              {seed.pending ? "Adding..." : "Add the standard areas"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
            {grouped.map(([category, list]) => (
              <div key={category}>
                <p className="eyebrow mb-2">{category}</p>
                <div className="space-y-1">
                  {list.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 ${a.active ? "" : "opacity-45"}`}
                    >
                      <span className="text-[13px]">{a.label}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={toggle.pending}
                          onClick={() => toggle.fire({ id: a.id })}
                        >
                          {a.active ? "Turn off" : "Turn on"}
                        </button>
                        <DeleteArea id={a.id} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          {adding ? (
            <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="propertyId" value={propertyId} />
              <div className="flex-1 min-w-[200px]">
                <label className="label">New line</label>
                <input name="label" required autoFocus className="input" placeholder="Outdoor shower valve" />
              </div>
              <div>
                <label className="label">Group</label>
                <select name="category" className="input">
                  {CHECK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" disabled={pending}>
                {pending ? "Adding..." : "Add"}
              </button>
              <button type="button" className="btn" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => setAdding(true)}>
                <IconPlus size={14} /> Add a line
              </button>
              {areas.length > 0 && (
                <button
                  className="btn"
                  disabled={seed.pending}
                  onClick={() => seed.fire({ propertyId })}
                  title="Adds any standard areas this property is missing. Never duplicates."
                >
                  {seed.pending ? "Adding..." : "Top up from the standard list"}
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

function DeleteArea({ id }: { id: string }) {
  const [armed, setArmed] = useState(false);
  const { pending, fire } = useFire(deleteCheckArea);
  return (
    <button
      type="button"
      className="btn btn-sm btn-danger"
      disabled={pending}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          setTimeout(() => setArmed(false), 3000);
          return;
        }
        fire({ id });
      }}
    >
      {pending ? "..." : armed ? "Sure?" : <IconTrash size={13} />}
    </button>
  );
}
