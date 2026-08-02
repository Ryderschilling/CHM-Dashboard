/**
 * The default home watch check list.
 *
 * This is a STARTING TEMPLATE only. Every property gets its own editable copy
 * in PropertyCheckArea, because a house with no pool must not have a pool line
 * in its record. Trim it per house on the property card.
 *
 * Why the list looks like this: the value of a visit record in a coverage
 * dispute comes from affirmatively documenting the areas that were DRY, not
 * just the ones that were wet. So the list leans heavily on water entry points
 * (supply lines, pans, condensate, ceilings) because water is what kills a
 * claim on an empty coastal house. See [[chm-claim-protection]].
 */

export const CHECK_CATEGORIES = ["Interior", "Systems", "Exterior", "Security"] as const;
export type CheckCategory = (typeof CHECK_CATEGORIES)[number];

export const DEFAULT_CHECK_AREAS: { label: string; category: CheckCategory }[] = [
  // Interior, water first
  { label: "Kitchen, under sink and dishwasher line", category: "Interior" },
  { label: "Refrigerator water line", category: "Interior" },
  { label: "Primary bath, under sink and toilet base", category: "Interior" },
  { label: "Primary bath ceiling and walls", category: "Interior" },
  { label: "Guest baths, under sink and toilet base", category: "Interior" },
  { label: "Laundry, washer hoses and pan", category: "Interior" },
  { label: "Ceilings and walls, staining or bubbling", category: "Interior" },
  { label: "Flooring, cupping or soft spots", category: "Interior" },
  { label: "Windows and doors, seals and tracks", category: "Interior" },
  { label: "Odor, mustiness or standing humidity", category: "Interior" },

  // Systems
  { label: "Water heater and drain pan", category: "Systems" },
  { label: "HVAC running, air temperature at vent", category: "Systems" },
  { label: "HVAC condensate line and drain pan", category: "Systems" },
  { label: "Thermostat setting and humidity reading", category: "Systems" },
  { label: "Main water shutoff and pressure", category: "Systems" },
  { label: "Electrical panel, no tripped breakers", category: "Systems" },
  { label: "Irrigation timer and heads", category: "Systems" },

  // Exterior
  { label: "Roof line from the ground, visible damage", category: "Exterior" },
  { label: "Gutters and drainage away from foundation", category: "Exterior" },
  { label: "Exterior doors, locks and weather seals", category: "Exterior" },
  { label: "Screens, lanai and outdoor furniture", category: "Exterior" },
  { label: "Landscaping and yard condition", category: "Exterior" },
  { label: "Pool or spa water level and clarity", category: "Exterior" },

  // Security
  { label: "Alarm armed and panel status", category: "Security" },
  { label: "No signs of entry or tampering", category: "Security" },
  { label: "No pest or rodent activity", category: "Security" },
  { label: "Mail and packages collected", category: "Security" },
  { label: "Trash bins in correct position", category: "Security" },
];

/** Sort key so categories always render in a stable, sensible order. */
export function categoryRank(category: string): number {
  const i = (CHECK_CATEGORIES as readonly string[]).indexOf(category);
  return i === -1 ? 99 : i;
}

export const STATE_LABEL: Record<string, string> = {
  OK: "Dry / good",
  ISSUE: "Needs attention",
  NA: "Not applicable",
};
