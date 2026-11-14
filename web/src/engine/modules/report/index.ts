import type { EngineModule } from "../types";
import { REPORT_STAGES } from "./stages";

/** Report assembly (pipeline stage 12): the report document the design template renders. */
export const reportModule: EngineModule = {
  id: "report",
  label: "Report",
  stages: REPORT_STAGES,
};
