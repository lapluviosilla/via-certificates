import CertificateApp from "@/components/CertificateApp";
import { TEAMS, getTeam } from "@/lib/teams";

// Pre-render one static page per team slug; unknown slugs 404 (light control).
export function generateStaticParams() {
  return Object.keys(TEAMS).map((team) => ({ team }));
}
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  return <CertificateApp team={getTeam(team)} />;
}
