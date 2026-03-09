import { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { featureWikiContent, type FeatureWikiEntry } from '../data/feature-wiki-content';

interface FeatureWikiProps {
  featureId: string;
}

export function FeatureWiki({ featureId }: FeatureWikiProps) {
  const [expanded, setExpanded] = useState(false);

  const entry: FeatureWikiEntry | undefined = featureWikiContent[featureId];
  if (!entry) return null;

  return (
    <div className="flex flex-col rounded-lg overflow-hidden" style={{ border: '1px solid var(--ctp-surface0)' }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 px-3 py-2.5 text-left w-full transition-colors"
        style={{
          backgroundColor: expanded ? 'var(--ctp-surface1)' : 'var(--ctp-surface0)',
          color: 'var(--ctp-subtext1)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--ctp-surface1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = expanded ? 'var(--ctp-surface1)' : 'var(--ctp-surface0)';
        }}
      >
        <BookOpen size={14} style={{ color: 'var(--ctp-accent)', flexShrink: 0 }} />
        <span className="text-xs font-medium flex-1">About this feature</span>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
        />
      </button>

      {/* Collapsible body */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 250ms ease',
          backgroundColor: 'var(--ctp-mantle)',
        }}
      >
        <div className="overflow-hidden">
        <div className="flex flex-col gap-4 p-4">
          {/* Overview */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>Overview</span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ctp-subtext0)' }}>{entry.overview}</p>
          </div>

          {/* How to Use */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>How to Use</span>
            <ol className="flex flex-col gap-1 pl-4 text-xs leading-relaxed" style={{ color: 'var(--ctp-subtext0)', listStyleType: 'decimal' }}>
              {entry.usage.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          {entry.tips && entry.tips.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>Tips</span>
              <ul className="flex flex-col gap-1 pl-4 text-xs leading-relaxed" style={{ color: 'var(--ctp-subtext0)', listStyleType: 'disc' }}>
                {entry.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Keyboard Shortcuts */}
          {entry.shortcuts && entry.shortcuts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>Keyboard Shortcuts</span>
              <div className="flex flex-col gap-1">
                {entry.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <kbd
                      className="px-1.5 py-0.5 rounded text-xs font-mono"
                      style={{
                        backgroundColor: 'var(--ctp-crust)',
                        color: 'var(--ctp-accent)',
                        border: '1px solid var(--ctp-surface1)',
                        flexShrink: 0,
                      }}
                    >
                      {s.key}
                    </kbd>
                    <span style={{ color: 'var(--ctp-subtext0)' }}>{s.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Syntax Examples */}
          {entry.syntaxExamples && entry.syntaxExamples.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>Syntax</span>
              <div className="flex flex-col gap-2">
                {entry.syntaxExamples.map((ex, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <pre
                      className="px-2 py-1.5 rounded text-xs font-mono whitespace-pre-wrap m-0"
                      style={{ backgroundColor: 'var(--ctp-crust)', color: 'var(--ctp-text)' }}
                    >
                      {ex.syntax}
                    </pre>
                    <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{ex.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
