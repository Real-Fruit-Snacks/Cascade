import { useTranslation } from 'react-i18next';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function QueryOptionsPage({ settings: _settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  void _settings;

  const Kw = ({ children }: { children: React.ReactNode }) => (
    <span className="font-semibold" style={{ color: 'var(--ctp-accent)' }}>{children}</span>
  );
  const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)' }}>{children}</code>
  );
  const ExampleBlock = ({ lines, title }: { lines: string[]; title: string }) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{title}</span>
      <div className="rounded p-3 font-mono text-xs leading-relaxed" style={{ backgroundColor: 'var(--ctp-crust)', color: 'var(--ctp-text)' }}>
        <div style={{ color: 'var(--ctp-overlay0)' }}>{'```query'}</div>
        {lines.map((line, i) => <div key={i}>{line}</div>)}
        <div style={{ color: 'var(--ctp-overlay0)' }}>{'```'}</div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('queryOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('queryOptions.description')}
        </span>
      </div>

      {/* How it works */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('queryOptions.howItWorks.title')}</span>
        <div className="flex flex-col gap-2 text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
          <p>Queries read the <strong>frontmatter properties</strong> (YAML metadata) at the top of your markdown files. For example, a note with:</p>
          <div className="rounded p-2 font-mono" style={{ backgroundColor: 'var(--ctp-crust)', color: 'var(--ctp-text)' }}>
            <div style={{ color: 'var(--ctp-overlay0)' }}>---</div>
            <div>status: active</div>
            <div>priority: 5</div>
            <div>tags: [project, work]</div>
            <div style={{ color: 'var(--ctp-overlay0)' }}>---</div>
          </div>
          <p>...can be found by queries that filter on <Code>status</Code>, <Code>priority</Code>, or <Code>tags</Code>. Queries also detect inline <Code>#tags</Code> in the body of your notes.</p>
        </div>
      </div>

      {/* Syntax Reference */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('queryOptions.syntaxReference.title')}</span>
        <div className="flex flex-col gap-3 text-xs" style={{ color: 'var(--ctp-subtext0)' }}>

          {/* Output type */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.outputType')}</span>
            <div className="flex flex-col gap-1.5 pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>TABLE</Kw> <span>field1, field2, ...</span> — Displays results in a table. Each field becomes a column. A "File" column is always included.</div>
              <div><Kw>LIST</Kw> — Displays results as a bulleted list of clickable file names.</div>
            </div>
          </div>

          {/* Source filter */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.sourceFilter')}</span>
            <div className="flex flex-col gap-1.5 pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>FROM</Kw> <Code>#tag</Code> — Only include notes that have this tag (in frontmatter or inline).</div>
              <div><Kw>FROM</Kw> <Code>"folder/path"</Code> — Only include notes inside this folder (and subfolders).</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.filters')}</span>
            <div className="flex flex-col gap-1.5 pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>WHERE</Kw> field <Code>=</Code> value — Exact match</div>
              <div><Kw>WHERE</Kw> field <Code>!=</Code> value — Not equal</div>
              <div><Kw>WHERE</Kw> field <Code>&gt;</Code> value — Greater than (numeric or alphabetical)</div>
              <div><Kw>WHERE</Kw> field <Code>&lt;</Code> value — Less than</div>
              <div><Kw>WHERE</Kw> field <Code>&gt;=</Code> value — Greater than or equal</div>
              <div><Kw>WHERE</Kw> field <Code>&lt;=</Code> value — Less than or equal</div>
              <div><Kw>WHERE</Kw> field <Code>contains</Code> value — Case-insensitive substring match</div>
              <p className="mt-1">Wrap string values in quotes: <Code>WHERE status = "active"</Code>. Numbers work without quotes: <Code>WHERE priority &gt; 3</Code>. Multiple WHERE lines are combined with AND logic.</p>
            </div>
          </div>

          {/* Sorting */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.sorting')}</span>
            <div className="flex flex-col gap-1.5 pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>SORT</Kw> field <Code>ASC</Code> — Sort ascending (A-Z, 0-9). This is the default.</div>
              <div><Kw>SORT</Kw> field <Code>DESC</Code> — Sort descending (Z-A, 9-0).</div>
              <p className="mt-1">Numeric values are sorted numerically, not alphabetically (so 10 comes after 9, not after 1).</p>
            </div>
          </div>

          {/* Limit */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.limit')}</span>
            <div className="pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>LIMIT</Kw> <Code>n</Code> — Show only the first n results. The total count is still displayed in the footer.</div>
            </div>
          </div>

        </div>
      </div>

      {/* Examples */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('queryOptions.examples.title')}</span>
        <div className="flex flex-col gap-4">
          <ExampleBlock
            title={ts('queryOptions.examples.booksRated')}
            lines={['TABLE author, rating, genre', 'FROM #book', 'WHERE rating >= 4', 'SORT rating DESC']}
          />
          <ExampleBlock
            title={ts('queryOptions.examples.activeProjects')}
            lines={['TABLE status, due-date, priority', 'FROM #project', 'WHERE status = "active"', 'SORT priority DESC']}
          />
          <ExampleBlock
            title={ts('queryOptions.examples.recentMeetings')}
            lines={['LIST', 'FROM "meetings"', 'SORT date DESC', 'LIMIT 10']}
          />
          <ExampleBlock
            title={ts('queryOptions.examples.keywordNotes')}
            lines={['TABLE tags, created', 'WHERE tags contains "research"']}
          />
          <ExampleBlock
            title={ts('queryOptions.examples.allNotes')}
            lines={['TABLE status, category', 'SORT category ASC']}
          />
        </div>
      </div>

      {/* Tips */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('queryOptions.tips.title')}</span>
        <div className="flex flex-col gap-2 text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Click on any file name in the results to open that note.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Click inside the rendered query to reveal and edit the raw query code.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>If <Code>TABLE</Code> is used without field names, all properties from matching notes will be shown.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Property names are case-sensitive. Make sure <Code>WHERE</Code> field names match your frontmatter exactly.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Tags in <Code>FROM #tag</Code> are matched case-insensitively, both in frontmatter <Code>tags:</Code> and inline <Code>#tag</Code> usage.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>List-type properties (like <Code>tags: [a, b]</Code>) are displayed as comma-separated values and can be searched with <Code>contains</Code>.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Queries scan your entire vault (or the filtered subset) each time. For very large vaults, use <Code>FROM</Code> to narrow the scope.</span>
          </div>
        </div>
      </div>
      <FeatureWiki featureId="query-options" />
    </div>
  );
}
