import { BusinessForm } from "../business-form";
import { EMPTY_BUSINESS } from "../defaults";

export const metadata = { title: "Add business — AIBizScanner internal" };

export default function NewBusinessPage() {
  return (
    <main>
      <h1>Add business</h1>
      <p className="muted">After saving, open the business to find and confirm its Google listing.</p>
      <BusinessForm defaults={EMPTY_BUSINESS} />
    </main>
  );
}
