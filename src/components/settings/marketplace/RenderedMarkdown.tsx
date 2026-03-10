import { useEffect, useState } from 'react';

export function RenderedMarkdown({ content }: { content: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { unified } = await import('unified');
        const remarkParse = (await import('remark-parse')).default;
        const remarkRehype = (await import('remark-rehype')).default;
        const rehypeSanitize = (await import('rehype-sanitize')).default;
        const rehypeStringify = (await import('rehype-stringify')).default;
        const result = await unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify).process(content);
        if (!cancelled) setHtml(String(result));
      } catch {
        if (!cancelled) setHtml(null);
      }
    })();
    return () => { cancelled = true; };
  }, [content]);

  if (html === null) {
    return (
      <pre className="text-xs whitespace-pre-wrap overflow-auto" style={{ color: 'var(--ctp-text)', maxHeight: 300, lineHeight: 1.6 }}>
        {content}
      </pre>
    );
  }

  return (
    <div
      className="plugin-readme text-sm"
      style={{ color: 'var(--ctp-text)', lineHeight: 1.6 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
