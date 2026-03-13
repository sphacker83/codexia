import { getSignalOverview, resolveSignalStyle } from "@/src/application/signals/signal-service";
import { isSignalDataUnavailableError } from "@/src/core/signals/errors";
import { SignalOverviewPage } from "@/src/presentation/web/signals/signal-overview-page";
import { SignalUnavailableState } from "@/src/presentation/web/signals/signal-unavailable-state";

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const params = await searchParams;
  let payload;

  try {
    payload = await getSignalOverview(resolveSignalStyle(params.style));
  } catch (error) {
    if (isSignalDataUnavailableError(error)) {
      return <SignalUnavailableState title="Signals live snapshot 없음" message={error.message} />;
    }
    throw error;
  }

  return <SignalOverviewPage payload={payload} />;
}
