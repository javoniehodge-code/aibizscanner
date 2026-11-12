import { BusinessForm } from "../business-form";
import { EMPTY_BUSINESS } from "../defaults";
import { IdentityCheckPlaceholder } from "../identity-check-placeholder";

export const metadata = { title: "Add business — AIBizScanner internal" };

export default function NewBusinessPage() {
  return (
    <main>
      <h1>Add business</h1>
      <IdentityCheckPlaceholder placeId={null} />
      <BusinessForm defaults={EMPTY_BUSINESS} />
    </main>
  );
}
