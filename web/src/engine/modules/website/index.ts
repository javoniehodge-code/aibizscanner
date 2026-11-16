import type { EngineModule } from "../types";
import { WEBSITE_STAGES } from "./stages";

/**
 * Website (Milestone 3): find the business's pages, freeze the admin-approved list, and take our own raw snapshot of
 * each page with the published AI crawler rules. The AI search and reading tests (stage 6) build on these.
 */
export const websiteModule: EngineModule = {
  id: "website",
  label: "Website",
  stages: WEBSITE_STAGES,
};
