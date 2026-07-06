'use client';

import { Database, GitBranch, Shield, Zap, ArrowRight } from 'lucide-react';
import { useConversationStore } from '@/store/conversation';

const suggestions = [
  {
    icon: Database,
    title: 'Build a pipeline',
    description: 'From PostgreSQL to S3 data lake with quality checks',
    prompt: 'Build me a data pipeline that ingests from PostgreSQL, transforms through bronze/silver/gold layers, and loads into an S3 data lake with Delta format',
  },
  {
    icon: GitBranch,
    title: 'Source-to-target mapping',
    description: 'Map columns between source and star schema',
    prompt: 'Help me create a source-to-target mapping from a Salesforce accounts table to a star schema dimensional model',
  },
  {
    icon: Shield,
    title: 'Data quality rules',
    description: 'Generate validation checks for my pipeline',
    prompt: 'Generate comprehensive data quality checks for a financial transactions pipeline including null checks, referential integrity, and anomaly detection',
  },
  {
    icon: Zap,
    title: 'Optimize an existing pipeline',
    description: 'Improve performance and reduce costs',
    prompt: 'Help me optimize a Glue ETL job that processes 500M rows daily - it currently takes 3 hours and costs $45 per run',
  },
];

export function WelcomeScreen() {
  const { activeConversationId, createConversation, setActiveConversation, addMessage } = useConversationStore();

  const handleSuggestionClick = (prompt: string) => {
    let convId = activeConversationId;
    if (!convId) {
      convId = createConversation();
    }

    addMessage(convId, {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      status: 'complete',
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12">
      {/* Logo & Title */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Database className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">
          What pipeline can I build for you?
        </h1>
        <p className="text-muted-foreground text-sm max-w-md">
          I'm your AI data engineering copilot. Describe what you need and I'll generate 
          production-ready pipeline code, complete with quality checks and orchestration.
        </p>
      </div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleSuggestionClick(suggestion.prompt)}
            className="group text-left p-4 rounded-xl border border-border hover:border-primary/50 
                       hover:bg-accent/50 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <suggestion.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm mb-0.5">{suggestion.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {suggestion.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 
                                     transition-opacity shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>

      {/* Capabilities Footer */}
      <div className="mt-10 text-center text-xs text-muted-foreground/60 max-w-md">
        <p>
          Supports AWS (Glue/S3/Athena), Azure (ADF/Synapse), Snowflake, dbt, and Databricks.
          Generates production code with CI/CD, quality checks, and orchestration.
        </p>
      </div>
    </div>
  );
}
