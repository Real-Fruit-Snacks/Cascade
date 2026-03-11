import type { EditorView } from '@codemirror/view';

export interface SlashCommandItem {
  id: string;
  labelKey: string;
  icon: string;
  group: 'textAndHeadings' | 'codeAndMedia' | 'structured' | 'embeds';
  keywords: string[];
  action: (view: EditorView, from: number, to: number) => void;
}

function insertMarkdown(text: string, cursorOffset?: number) {
  return (view: EditorView, from: number, to: number) => {
    const offset = cursorOffset ?? text.length;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + offset },
    });
    view.focus();
  };
}

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  // Text & Headings
  { id: 'heading1', labelKey: 'slashCommands.items.heading1', icon: 'Heading1', group: 'textAndHeadings', keywords: ['h1', 'heading', 'title'], action: insertMarkdown('# ') },
  { id: 'heading2', labelKey: 'slashCommands.items.heading2', icon: 'Heading2', group: 'textAndHeadings', keywords: ['h2', 'heading', 'subtitle'], action: insertMarkdown('## ') },
  { id: 'heading3', labelKey: 'slashCommands.items.heading3', icon: 'Heading3', group: 'textAndHeadings', keywords: ['h3', 'heading'], action: insertMarkdown('### ') },
  { id: 'bulletList', labelKey: 'slashCommands.items.bulletList', icon: 'List', group: 'textAndHeadings', keywords: ['bullet', 'unordered', 'list', 'ul'], action: insertMarkdown('- ') },
  { id: 'numberedList', labelKey: 'slashCommands.items.numberedList', icon: 'ListOrdered', group: 'textAndHeadings', keywords: ['numbered', 'ordered', 'list', 'ol'], action: insertMarkdown('1. ') },
  { id: 'taskList', labelKey: 'slashCommands.items.taskList', icon: 'ListChecks', group: 'textAndHeadings', keywords: ['task', 'todo', 'checkbox', 'check'], action: insertMarkdown('- [ ] ') },
  { id: 'blockquote', labelKey: 'slashCommands.items.blockquote', icon: 'Quote', group: 'textAndHeadings', keywords: ['quote', 'blockquote', 'cite'], action: insertMarkdown('> ') },
  { id: 'callout', labelKey: 'slashCommands.items.callout', icon: 'MessageSquare', group: 'textAndHeadings', keywords: ['callout', 'admonition', 'note', 'warning', 'tip', 'info'], action: insertMarkdown('> [!NOTE]\n> ', '> [!NOTE]\n> '.length) },

  // Code & Media
  { id: 'codeBlock', labelKey: 'slashCommands.items.codeBlock', icon: 'Code', group: 'codeAndMedia', keywords: ['code', 'block', 'snippet', 'pre'], action: insertMarkdown('```\n\n```', 4) },
  { id: 'mathBlock', labelKey: 'slashCommands.items.mathBlock', icon: 'Sigma', group: 'codeAndMedia', keywords: ['math', 'latex', 'equation', 'formula'], action: insertMarkdown('$$\n\n$$', 3) },
  { id: 'divider', labelKey: 'slashCommands.items.divider', icon: 'Minus', group: 'codeAndMedia', keywords: ['divider', 'horizontal', 'rule', 'line', 'hr', 'separator'], action: insertMarkdown('---\n') },

  // Structured
  { id: 'table', labelKey: 'slashCommands.items.table', icon: 'Table', group: 'structured', keywords: ['table', 'grid', 'rows', 'columns'], action: insertMarkdown('| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n', '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| '.length) },
  { id: 'template', labelKey: 'slashCommands.items.template', icon: 'FileStack', group: 'structured', keywords: ['template', 'snippet', 'boilerplate'], action: () => {} },

  // Embeds
  { id: 'image', labelKey: 'slashCommands.items.image', icon: 'Image', group: 'embeds', keywords: ['image', 'picture', 'photo', 'img'], action: insertMarkdown('![]()', 4) },
  { id: 'embedNote', labelKey: 'slashCommands.items.embedNote', icon: 'FileInput', group: 'embeds', keywords: ['embed', 'note', 'transclusion', 'include'], action: () => {} },
];

export const SLASH_COMMAND_GROUPS = ['textAndHeadings', 'codeAndMedia', 'structured', 'embeds'] as const;
