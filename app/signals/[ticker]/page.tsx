import { notFound } from "next/navigation";

import { getSignalAssetDetail, resolveSignalStyle } from "@/src/application/signals/signal-service";
import { isSignalDataUnavailableError } from "@/src/core/signals/errors";
import { SignalAssetPage } from "@/src/presentation/web/signals/signal-asset-page";
import { SignalUnavailableState } from "@/src/presentation/web/signals/signal-unavailable-state";

export default async function SignalAssetRoute({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ style?: string }>;
}) {
  const [{ ticker }, query] = await Promise.all([params, searchParams]);
  let payload;

  try {
    payload = await getSignalAssetDetail(resolveSignalStyle(query.style), ticker);
  } catch (error) {
    if (isSignalDataUnavailableError(error)) {
      return <SignalUnavailableState title={`${ticker.toUpperCase()} live snapshot 없음`} message={error.message} />;
    }
    throw error;
  }

  if (!payload) {
    notFound();
  }

  return <SignalAssetPage ticker={ticker} payload={payload} />;
}
