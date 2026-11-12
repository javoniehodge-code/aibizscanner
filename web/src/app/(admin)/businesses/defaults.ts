import type { Tables } from "@/lib/database.types";
import type { BusinessFormDefaults } from "./business-form";

export const EMPTY_BUSINESS: BusinessFormDefaults = {
  name: "",
  website: "",
  category: "",
  location: "",
  service_area: "",
  services: "",
  aliases: "",
  domains: "",
  customer_types: "",
};

export function toFormDefaults(b: Tables<"business">): BusinessFormDefaults {
  return {
    id: b.id,
    name: b.name,
    website: b.website ?? "",
    category: b.category,
    location: b.location,
    service_area: b.service_area ?? "",
    services: b.services.join("\n"),
    aliases: b.aliases.join("\n"),
    domains: b.domains.join("\n"),
    customer_types: b.customer_types.join("\n"),
  };
}
