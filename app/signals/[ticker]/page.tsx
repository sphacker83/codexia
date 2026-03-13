import { notFound } from "next/navigation";

import { getSignalAssetDetail, resolveSignalStyle } from "@/src/application/signals/signal-service";
import { SignalAssetPage } from "@/src/presentation/web/signals/signal-asset-page";

export default async function SignalAssetRoute({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ style?: string }>;
}) {
  const [{ ticker }, query] = await Promise.all([params, searchParams]);
  const payload = await getSignalAssetDetail(resolveSignalStyle(query.style), ticker);

  if (!payload) {
    notFound();
  }

  return <SignalAssetPage ticker={ticker} payload={payload} />;
}
