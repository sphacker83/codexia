import { getSignalOverview, resolveSignalStyle } from "@/src/application/signals/signal-service";
import { SignalOverviewPage } from "@/src/presentation/web/signals/signal-overview-page";

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const params = await searchParams;
  const payload = await getSignalOverview(resolveSignalStyle(params.style));

  return <SignalOverviewPage payload={payload} />;
}
