'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ChatArea } from '@/components/chat/chat-area';
import { ArtifactPanel } from '@/components/artifacts/artifact-panel';
import { useConversationStore } from '@/store/conversation';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const { activeArtifact } = useConversationStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Conversation History */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <ChatArea 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenArtifact={() => setArtifactPanelOpen(true)}
        />
      </main>

      {/* Artifact/Preview Panel */}
      {(artifactPanelOpen || activeArtifact) && (
        <ArtifactPanel
          onClose={() => {
            setArtifactPanelOpen(false);
            useConversationStore.getState().setActiveArtifact(null);
          }}
        />
      )}
    </div>
  );
}
