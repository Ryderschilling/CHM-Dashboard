"use client";

import { useState } from "react";
import { deleteVisitPhoto, updatePhotoCaption } from "@/actions/visits";
import { useFire, useSubmit } from "./forms/useSubmit";
import { SectionHeader, Empty } from "./ui";
import { fmtBytes } from "@/lib/photo";

export default function PhotoManager({
  photos,
}: {
  photos: { id: string; caption: string | null; bytes: number }[];
}) {
  return (
    <div className="card p-5">
      <SectionHeader title="Photos" sub="Captions print under each image on the record" />
      {photos.length === 0 ? (
        <Empty text="No photos on this visit. Add them by editing the report." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <Shot key={p.id} photo={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function Shot({ photo }: { photo: { id: string; caption: string | null; bytes: number } }) {
  const [editing, setEditing] = useState(false);
  const del = useFire(deleteVisitPhoto);
  const { pending, onSubmit } = useSubmit(updatePhotoCaption, () => setEditing(false));
  const [armed, setArmed] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden bg-[var(--surface-2)]">
      <a href={`/api/photo/${photo.id}`} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/photo/${photo.id}`} alt={photo.caption ?? ""} className="h-32 w-full object-cover" />
      </a>
      <div className="p-2.5">
        {editing ? (
          <form onSubmit={onSubmit} className="space-y-1.5">
            <input type="hidden" name="id" value={photo.id} />
            <input name="caption" defaultValue={photo.caption ?? ""} autoFocus className="input !py-1 !text-[12px]" placeholder="Caption" />
            <div className="flex gap-1.5">
              <button className="btn btn-sm" disabled={pending}>{pending ? "..." : "Save"}</button>
              <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-[12px] text-[var(--sec)] min-h-[16px]">
              {photo.caption ?? <span className="text-[var(--mut)]">No caption</span>}
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <button className="text-[11.5px] text-[var(--mut)] hover:text-[var(--teal)]" onClick={() => setEditing(true)}>
                Caption
              </button>
              <span className="text-[11px] text-[var(--mut)]">{fmtBytes(photo.bytes)}</span>
              <button
                className="text-[11.5px] text-[var(--mut)] hover:text-[var(--bad)]"
                disabled={del.pending}
                onClick={() => {
                  if (!armed) {
                    setArmed(true);
                    setTimeout(() => setArmed(false), 3000);
                    return;
                  }
                  del.fire({ id: photo.id });
                }}
              >
                {del.pending ? "..." : armed ? "Sure?" : "Delete"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
