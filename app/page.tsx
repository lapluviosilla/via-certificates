import CertificateApp from "@/components/CertificateApp";
import { CUSTOM_TEAM } from "@/lib/teams";

// Root URL = free-form one-off mode: the signer name, role and signature are
// filled in by the user (secure this URL at the hosting layer).
export default function Page() {
  return <CertificateApp team={CUSTOM_TEAM} />;
}
