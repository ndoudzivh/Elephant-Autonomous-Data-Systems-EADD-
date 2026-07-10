'use client';

import { useState } from 'react';
import { ChatArea } from '@/components/chat/chat-area';

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [artifactOpen, setArtifactOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col min-w-0">
        <ChatArea
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenArtifact={() => setArtifactOpen(true)}
        />
      </div>
    </div>
  );
}
