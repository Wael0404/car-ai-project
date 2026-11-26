/**
 * All texts, one file per part of the app. Each file exports `fr` (the
 * reference, `as const`) and `ar` (same keys, checked by TypeScript).
 * Keys are prefixed by their file: "garage.title", "vehicle.tabs.fiche"...
 */
import * as common from "./common";
import * as history from "./history";
import * as parts from "./parts";
import * as screens from "./screens";
import * as ui from "./ui";
import * as vehicle from "./vehicle";

export const FR = { ...common.fr, ...screens.fr, ...vehicle.fr, ...history.fr, ...parts.fr, ...ui.fr };
export const AR: { [K in keyof typeof FR]: string } = {
  ...common.ar,
  ...screens.ar,
  ...vehicle.ar,
  ...history.ar,
  ...parts.ar,
  ...ui.ar,
};

export type TKey = keyof typeof FR;
