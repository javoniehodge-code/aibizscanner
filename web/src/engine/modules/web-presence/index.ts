import type { EngineModule } from "../types";
import { WEB_PRESENCE_STAGES } from "./stages";

/**
 * Web presence (Milestone 4, stage 8): the outside pages AI cited, checked with our own fetcher and browser, and which
 * businesses each names. Feeds Citation coverage now; Credible & corroborated and the web presence map next.
 */
export const webPresenceModule: EngineModule = {
  id: "web-presence",
  label: "Web presence",
  stages: WEB_PRESENCE_STAGES,
};
