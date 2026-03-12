"use client";

import { AgentComposer } from "./agent-composer";
import { AgentMessageList } from "./agent-message-list";
import { AgentSidebar } from "./agent-sidebar";
import { INPUT_PANEL_WIDTH_CLASS } from "./agent-chat.types";
import { useAgentChatViewModel } from "./use-agent-chat-view-model";

export function AgentChatPage() {
  const viewModel = useAgentChatViewModel();

  return (
    <main className="h-screen w-full px-4 py-4 sm:px-6">
      <div className="grid h-full min-h-0 w-full gap-4 md:grid-cols-[16rem_1fr]">
        <AgentSidebar hasValidSessionId={viewModel.hasValidSessionId} sessionId={viewModel.sessionId} />

        <div className="min-h-0 w-full">
          <div className="h-full min-h-0 w-full overflow-visible rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
            <section
              className={`mx-auto flex h-full min-h-0 w-full flex-col overflow-visible bg-transparent ${INPUT_PANEL_WIDTH_CLASS}`}
              aria-busy={viewModel.isLoading}
            >
              <AgentMessageList
                isLoadingSession={viewModel.isLoadingSession}
                messages={viewModel.messages}
                messagesContainerRef={viewModel.messagesContainerRef}
                traceMode={viewModel.traceMode}
                waitingSeconds={viewModel.waitingSeconds}
              />
              <AgentComposer viewModel={viewModel} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
