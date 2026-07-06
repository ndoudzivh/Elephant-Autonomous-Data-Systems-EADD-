'use client';

import { useState } from 'react';
import { Copy, Check, Download, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language: string;
  title?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ code, language, title, showLineNumbers = true }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const languageLabel = getLanguageLabel(language);
  const lines = code.split('\n');

  return (
    <div className="my-3 rounded-lg border border-border overflow-hidden bg-[#0d1117] group">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
            {title || languageLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(language === 'python' || language === 'sql') && (
            <button
              className="p-1 hover:bg-accent/20 rounded text-muted-foreground/60 hover:text-green-400 
                         transition-colors opacity-0 group-hover:opacity-100"
              title="Run in sandbox"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            className="p-1 hover:bg-accent/20 rounded text-muted-foreground/60 hover:text-foreground 
                       transition-colors opacity-0 group-hover:opacity-100"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-accent/20 rounded text-muted-foreground/60 hover:text-foreground transition-colors"
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-[13px] leading-relaxed font-mono">
          <code className={cn('language-' + language)}>
            {showLineNumbers ? (
              <table className="border-collapse w-full">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="pr-4 text-right text-muted-foreground/30 select-none w-8 align-top">
                        {i + 1}
                      </td>
                      <td className="text-[#e6edf3] whitespace-pre">
                        <SyntaxLine line={line} language={language} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="text-[#e6edf3]">{code}</span>
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}

/** Basic syntax highlighting without external dependencies */
function SyntaxLine({ line, language }: { line: string; language: string }) {
  // Simple keyword-based highlighting
  if (language === 'python' || language === 'py') {
    return <PythonHighlight line={line} />;
  }
  if (language === 'sql') {
    return <SQLHighlight line={line} />;
  }
  if (language === 'yaml' || language === 'yml') {
    return <YAMLHighlight line={line} />;
  }
  return <span>{line}</span>;
}

function PythonHighlight({ line }: { line: string }) {
  const keywords = /\b(import|from|def|class|return|if|else|elif|for|while|try|except|with|as|in|not|and|or|True|False|None|self|async|await|raise|yield|lambda)\b/g;
  const strings = /(["'`])((?:\\\1|[\s\S])*?)\1/g;
  const comments = /(#.*$)/g;
  const decorators = /(@\w+)/g;

  let highlighted = line
    .replace(comments, '<span class="text-[#8b949e]">$1</span>')
    .replace(strings, '<span class="text-[#a5d6ff]">$1$2$1</span>')
    .replace(keywords, '<span class="text-[#ff7b72]">$1</span>')
    .replace(decorators, '<span class="text-[#d2a8ff]">$1</span>');

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

function SQLHighlight({ line }: { line: string }) {
  const keywords = /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|DATABASE|IF|NOT|EXISTS|AS|ON|AND|OR|IN|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|BY|ORDER|HAVING|LIMIT|UNION|ALL|CASE|WHEN|THEN|ELSE|END|NULL|IS|BETWEEN|LIKE|INTO|VALUES|SET|EXTERNAL|STORED|LOCATION|PARTITIONED|COMMENT|TBLPROPERTIES)\b/gi;
  const strings = /('(?:[^']|'')*')/g;
  const comments = /(--.*$)/g;

  let highlighted = line
    .replace(comments, '<span class="text-[#8b949e]">$1</span>')
    .replace(strings, '<span class="text-[#a5d6ff]">$1</span>')
    .replace(keywords, '<span class="text-[#ff7b72]">$&</span>');

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

function YAMLHighlight({ line }: { line: string }) {
  const key = /^(\s*)([\w_-]+)(:)/;
  const comments = /(#.*$)/g;
  const strings = /(["'])(.*?)\1/g;
  const booleans = /\b(true|false|null|yes|no)\b/gi;

  let highlighted = line
    .replace(comments, '<span class="text-[#8b949e]">$1</span>')
    .replace(key, '$1<span class="text-[#7ee787]">$2</span><span class="text-[#e6edf3]">$3</span>')
    .replace(strings, '<span class="text-[#a5d6ff]">$1$2$1</span>')
    .replace(booleans, '<span class="text-[#ff7b72]">$1</span>');

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

function getLanguageLabel(lang: string): string {
  const labels: Record<string, string> = {
    python: 'Python',
    py: 'Python',
    sql: 'SQL',
    yaml: 'YAML',
    yml: 'YAML',
    json: 'JSON',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    hcl: 'Terraform (HCL)',
    bash: 'Bash',
    shell: 'Shell',
    text: 'Text',
  };
  return labels[lang] || lang.toUpperCase();
}
