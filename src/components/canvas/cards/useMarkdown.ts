import { useMemo } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

/** Convert markdown text to sanitized HTML. Returns empty string for falsy input. */
export function useMarkdown(text: string | undefined): string {
  return useMemo(() => {
    if (!text) return '';
    try {
      return String(processor.processSync(text));
    } catch {
      return text;
    }
  }, [text]);
}
