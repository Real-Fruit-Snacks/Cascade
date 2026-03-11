export interface FeatureWikiEntry {
  overview: string;
  usage: string[];
  tips?: string[];
  shortcuts?: { key: string; action: string }[];
  syntaxExamples?: { syntax: string; description: string }[];
}

export const featureWikiContent: Record<string, FeatureWikiEntry> = {
  "folder-colors": {
    overview:
      "Assign custom colors to folders in the sidebar to visually organize your vault at a glance. Colors can cascade down to subfolders and files for a cohesive look.",
    usage: [
      "Right-click any folder in the file explorer to open the context menu.",
      "Select 'Set Color' and choose from 14 Catppuccin palette colors.",
      "Enable 'Color Subfolders' in settings to automatically tint child folders with the same color.",
      "Enable 'Color Files' to extend the tint to individual files inside the folder.",
      "Use the Opacity slider to control how strong the color effect is.",
      "Switch Color Style to change how the color is applied: icon-only, text, background, accent-bar, full, dot, or custom.",
    ],
    tips: [
      "Use 'accent-bar' style for a subtle left-border indicator that keeps the sidebar clean.",
      "Combine 'Color Background' with a low opacity (20-30%) for a soft tint that doesn't overwhelm dark themes.",
      "Assign the same color family to related project folders — e.g., all research folders in blue, all writing folders in green.",
      "Enable 'Bold' on top-level project folders to make them stand out from subfolders at a glance.",
      "The 'dot' style is great for minimal setups where you want color indicators without changing the text.",
    ],
  },

  "wikilinks-options": {
    overview:
      "Wiki links let you create clickable internal links between notes using double-bracket syntax, forming the backbone of a connected knowledge base.",
    usage: [
      "Type `[[` anywhere in a note to trigger the link autocomplete popup.",
      "Start typing a file name to filter suggestions, then press Enter or click to insert the link.",
      "Use `[[filename|display text]]` to show custom text instead of the file name.",
      "Click a rendered wiki link to navigate to that note.",
      "Enable 'Open in New Tab' in settings to Ctrl+Click links to open them alongside your current note.",
      "Enable 'Create on Follow' to automatically create a new note when you click a link to a file that doesn't exist yet.",
    ],
    tips: [
      "Use `[[filename#Heading]]` to link directly to a specific heading within a note.",
      "Hover over a link to see the full file path when 'Show Full Path on Hover' is enabled — useful in vaults with many similarly named files.",
      "Wiki links work even if you rename the target file — Cascade tracks links by name.",
      "Combine wiki links with the Backlinks panel to build a bidirectional network of related notes.",
    ],
    shortcuts: [
      { key: "[[", action: "Open link autocomplete" },
      { key: "Ctrl+Click", action: "Open link in new tab (when enabled)" },
    ],
    syntaxExamples: [
      { syntax: "[[Note Name]]", description: "Basic link to another note" },
      {
        syntax: "[[Note Name|Display Text]]",
        description: "Link with custom display text",
      },
      {
        syntax: "[[Note Name#Heading]]",
        description: "Link to a specific heading in a note",
      },
    ],
  },

  "livepreview-options": {
    overview:
      "Live Preview renders your markdown formatting inline as you type, giving you a WYSIWYG-like editing experience without switching to a separate preview pane.",
    usage: [
      "Just start typing markdown — formatting renders automatically as you write.",
      "Place your cursor inside formatted text (e.g., inside **bold**) to reveal the raw syntax for editing.",
      "Move your cursor away to see the rendered result again.",
      "Toggle individual element types in settings to control exactly what gets rendered: headings, bold, italic, links, images, and code blocks.",
      "Disable rendering for specific element types if you prefer to see raw syntax for them at all times.",
    ],
    tips: [
      "Disabling heading rendering while writing can make it easier to see your document structure without the visual weight of large heading text.",
      "If you find image rendering distracting while writing, disable it in settings and re-enable it when reviewing.",
      "Live Preview works best with the Catppuccin theme — syntax colors are tuned to complement the rendered output.",
      "Code blocks still show syntax highlighting when rendered, making them easy to read without switching views.",
    ],
  },

  "tags-options": {
    overview:
      "Tags let you categorize and find notes using `#hashtag` syntax, with support for nested hierarchies and autocomplete to keep your tag taxonomy consistent.",
    usage: [
      "Type `#` followed by a tag name anywhere in your note body to add a tag.",
      "Press Space or Enter to confirm the tag; the autocomplete list shows existing tags as you type.",
      "Create nested tags using forward slashes: `#project/work/urgent`.",
      "Open the Tags panel in the sidebar to browse all tags and see which notes use them.",
      "Click a tag in the sidebar to see all notes with that tag.",
      "Enable 'Auto-Complete Tags' in settings to get suggestions from your existing tag library as you type.",
    ],
    tips: [
      "Nested tags are great for status workflows: `#status/inbox`, `#status/active`, `#status/done`.",
      "Tags in the sidebar show parent and child counts separately — clicking a parent tag shows all notes in that branch.",
      "Keep top-level tags broad (e.g., `#project`, `#reference`) and use nesting for specifics to avoid tag sprawl.",
      "Tags in frontmatter YAML (as a list under `tags:`) are also recognized and appear in the Tags panel.",
    ],
    syntaxExamples: [
      { syntax: "#tagname", description: "Basic tag" },
      {
        syntax: "#parent/child",
        description: "Nested tag (child is part of parent)",
      },
      {
        syntax: "#project/work/urgent",
        description: "Deeply nested tag for fine-grained categorization",
      },
    ],
  },

  "graph-options": {
    overview:
      "Graph View displays your entire vault as an interactive network diagram, where each node is a file and each edge is a wiki link — making it easy to spot connections and isolated notes.",
    usage: [
      "Open the Graph View panel from the sidebar.",
      "Each circle (node) represents a file; lines (edges) represent wiki links between files.",
      "Click any node to open that file in the editor.",
      "Scroll to zoom in and out; click and drag the background to pan.",
      "Drag individual nodes to rearrange the layout.",
      "Adjust 'Node Size' in settings to make nodes larger or smaller.",
      "Increase 'Link Distance' to spread the graph out; decrease it to cluster connected notes together.",
      "Enable 'Show Orphan Notes' to include files with no links — useful for finding disconnected notes.",
      "Use 'Max Nodes' to cap the graph size for large vaults where rendering all nodes is slow.",
    ],
    tips: [
      "Zoom in on clusters to discover implicit topic groups you may not have consciously organized.",
      "Orphan nodes (files with no incoming or outgoing links) are candidates for either linking into your knowledge base or deleting.",
      "Reduce Max Nodes to 100-200 when doing exploratory browsing — it keeps the graph readable and fast.",
      "Highly connected nodes (hubs) are often your most important MOC (Map of Content) or index notes.",
    ],
  },

  "backlinks-options": {
    overview:
      "The Backlinks panel shows every note in your vault that links to the note you're currently editing, making it easy to see context and navigate related ideas.",
    usage: [
      "Open the Backlinks panel from the sidebar.",
      "The panel updates automatically as you switch between notes.",
      "Each backlink entry shows the source file name and surrounding context lines.",
      "Click any backlink entry to open the source note.",
      "Adjust 'Context Lines' in settings (0-5) to control how many lines of surrounding text appear with each backlink.",
      "Enable 'Group by Folder' to organize backlinks by their location in the vault.",
    ],
    tips: [
      "Set Context Lines to 2-3 to see enough surrounding text to understand why the link was made without cluttering the panel.",
      "Use backlinks as a discovery tool: when a note has unexpected backlinks, it often reveals conceptual connections you forgot about.",
      "Group by Folder is most useful in large vaults where you have many notes per topic area and want to see which project areas reference the current note.",
      "Backlinks work alongside Graph View — use Graph for a high-level overview and Backlinks for detailed per-note navigation.",
    ],
  },

  "outline-options": {
    overview:
      "The Outline panel shows a live hierarchical table of contents built from your document's headings, letting you jump to any section instantly.",
    usage: [
      "Open the Outline panel from the sidebar.",
      "The outline updates in real time as you add or edit headings.",
      "Click any heading in the outline to scroll the editor to that section.",
      "Use 'Minimum Heading Level' in settings to filter which headings appear — e.g., set to H2 to hide H1 titles from the outline.",
      "Enable 'Auto-Expand' to keep the outline fully expanded when you open a new document.",
      "Click the expand/collapse arrows in the outline to fold sections manually.",
    ],
    tips: [
      "Set Minimum Heading Level to H2 if all your notes start with a single H1 title — it keeps the outline focused on sub-sections.",
      "The Outline panel is the fastest way to navigate long documents like meeting notes, research papers, or lengthy MOCs.",
      "Use the Outline in combination with Code Folding: navigate via Outline, then collapse sections you're not working on.",
      "The active heading (the one your cursor is in) is highlighted in the outline, so you always know where you are in the document.",
    ],
  },

  "variables-options": {
    overview:
      "Variables let you reference frontmatter property values anywhere in your note body using placeholder syntax, so you can write once and reuse values throughout the document.",
    usage: [
      "Add properties to your note's frontmatter YAML block (e.g., `author: Jane Doe`).",
      "Reference the property in the note body using angle-bracket syntax: `<author>`.",
      "The placeholder is replaced with the frontmatter value when rendered.",
      "Use `<varname:default value>` to specify a fallback if the property is missing.",
      "Enable 'Nesting Support' to access nested properties with dot notation: `<server.ip>`.",
      "Enable 'Case Insensitive' so `<Author>` and `<author>` both match the same property.",
      "Configure the 'Missing Value Text' setting to control what appears when a variable has no value and no default.",
      "Use 'Array Join Separator' to control how list properties are joined when referenced as a variable.",
    ],
    tips: [
      "Variables are powerful in templates — define common metadata once in frontmatter and reference it throughout the body.",
      "Use `<date>` combined with a `date` frontmatter property to stamp creation or review dates into the note body.",
      "The 'Preserve on Missing' option is useful during drafting — it keeps the `<variable>` syntax visible so you remember to fill it in.",
      "Customize the open/close delimiters if you use angle brackets for other purposes (e.g., switch to `{varname}`).",
    ],
    syntaxExamples: [
      { syntax: "<propertyName>", description: "Reference a frontmatter property" },
      {
        syntax: "<propertyName:default>",
        description: "Reference with a fallback default value",
      },
      {
        syntax: "<parent.child>",
        description: "Access nested property with dot notation (requires Nesting Support)",
      },
    ],
  },

  "dailynotes-options": {
    overview:
      "Daily Notes (and weekly, monthly, quarterly, yearly variants) automatically create date-stamped notes in a configured folder, optionally populated with a template — perfect for journaling and periodic reviews.",
    usage: [
      "Configure the folder path where daily notes will be stored in settings.",
      "Choose a date format for the filename (e.g., YYYY-MM-DD, MM-DD-YYYY).",
      "Optionally set a template file path — the template's content will be inserted into each new daily note.",
      "Press Alt+D to open or create today's daily note.",
      "Use the Command Palette for weekly, monthly, quarterly, and yearly notes.",
      "Each period type has its own folder, date format, and template settings.",
      "Template variables like `{{title}}` and `{{date}}` are expanded when the note is created.",
    ],
    tips: [
      "Set up a daily note template with sections for tasks, gratitude, and reflections to build a consistent journaling habit.",
      "Use weekly notes as a higher-level review layer that links to the daily notes from that week.",
      "Keep daily notes in a date-organized folder structure (e.g., `Journal/2026/03/`) by including path separators in your folder setting.",
      "Alt+D is the fastest way to start your day — press it each morning and your note is ready to go.",
    ],
    shortcuts: [
      { key: "Alt+D", action: "Open or create today's daily note" },
    ],
  },

  "codefolding-options": {
    overview:
      "Code Folding lets you collapse headings and code blocks with a single click in the editor gutter, reducing visual noise when working on long documents.",
    usage: [
      "Enable 'Fold Headings' in settings to add fold markers next to headings.",
      "Enable 'Fold Code Blocks' to add fold markers next to fenced code blocks.",
      "Set 'Minimum Fold Level' to control which heading levels get fold markers — e.g., H2 means only H2 and deeper headings can be folded.",
      "Click the fold gutter icon (chevron) next to a heading or code block to collapse it.",
      "Click the icon again (or the folded placeholder) to expand the section.",
      "Folded sections display a placeholder line so you know content is hidden.",
    ],
    tips: [
      "Set Minimum Fold Level to H2 if you want H1 titles to always be visible as document anchors.",
      "Use code folding during review sessions to collapse sections you've already processed.",
      "Combine Code Folding with the Outline panel: use the Outline to navigate and fold sections to keep only the active one visible.",
      "Folding state is not persisted between sessions — all folds reset when you close and reopen a file.",
    ],
  },

  "highlight-options": {
    overview:
      "Highlights let you mark important text with a colored background using double-equals syntax, rendered inline in Live Preview.",
    usage: [
      "Wrap any text with double equals to highlight it: `==important text==`.",
      "The highlight renders with a colored background in Live Preview.",
      "Place your cursor inside the highlighted text to reveal the raw `==` syntax for editing.",
      "Choose your highlight color from the 14 Catppuccin palette colors in settings.",
    ],
    tips: [
      "Use highlights sparingly for maximum impact — if everything is highlighted, nothing stands out.",
      "Combine highlights with bold for critical action items: `**==do this now==**`.",
      "The Catppuccin Yellow (Peach) color is a natural choice that evokes traditional highlighter pens.",
      "Highlights export well to PDF and other formats since they use standard background-color CSS.",
    ],
    syntaxExamples: [
      {
        syntax: "==highlighted text==",
        description: "Renders with a colored background",
      },
      {
        syntax: "**==bold and highlighted==**",
        description: "Combine with bold for extra emphasis",
      },
    ],
  },

  "properties-options": {
    overview:
      "The Properties widget renders your note's YAML frontmatter as an interactive, editable form at the top of the document — no raw YAML editing required.",
    usage: [
      "Add a YAML frontmatter block at the very start of your file, enclosed in triple dashes (`---`).",
      "The widget appears automatically above the note content when a frontmatter block is detected.",
      "Click any property value in the widget to edit it inline.",
      "Add new properties by clicking the '+ Add Property' button in the widget.",
      "Enable 'Show Types' in settings to display data type labels (string, number, boolean, array, date) next to each value.",
      "Supported types: strings, numbers, booleans (`true`/`false`), arrays (YAML lists), and date strings.",
    ],
    tips: [
      "Use the `tags` property as a YAML list to add multiple tags to the Tags panel: `tags: [work, project, active]`.",
      "Date properties (e.g., `created: 2026-03-08`) are displayed with friendly formatting when 'Show Types' is on.",
      "Boolean properties render as checkboxes in the widget — great for simple status flags like `published: false`.",
      "The Properties widget integrates with the Variables feature — any property you define here can be referenced in the note body with `<property_name>`.",
    ],
    syntaxExamples: [
      {
        syntax: "---\ntitle: My Note\nauthor: Jane\ntags: [work, project]\n---",
        description: "Basic frontmatter block with string and array properties",
      },
      {
        syntax: "---\npublished: false\nwordcount: 1500\n---",
        description: "Boolean and number properties",
      },
    ],
  },

  "statusbar-options": {
    overview:
      "The Status Bar displays live document statistics at the bottom of the editor — word count, character count, reading time, and selection stats.",
    usage: [
      "Statistics appear automatically in the status bar at the bottom of the editor window.",
      "Toggle each stat individually in settings: Word Count, Character Count, Reading Time, and Selection Stats.",
      "Select any text in the editor to see selection-specific word and character counts in the status bar.",
      "Reading time is calculated at approximately 200 words per minute.",
    ],
    tips: [
      "Enable Selection Stats when editing to quickly check the length of a section without doing mental math.",
      "Reading time is a useful gut-check for blog posts and articles — aim for 5-7 minutes for long-form content.",
      "Character Count is especially useful when writing for platforms with character limits (e.g., abstracts, social posts).",
      "The status bar stats update in real time as you type, with no perceptible delay.",
    ],
  },

  "autosave-options": {
    overview:
      "Auto-Save keeps your work safe by saving files automatically — either when you switch focus away from the editor, or after a configurable delay following your last keystroke.",
    usage: [
      "Choose a Save Mode in settings: 'On Focus Change' or 'After Delay'.",
      "'On Focus Change' saves the file whenever you click outside the editor (e.g., to switch files or use the sidebar).",
      "'After Delay' saves automatically after you stop typing for the configured interval.",
      "Set the Save Interval (500–30,000ms) to control how long After Delay waits before saving.",
      "Both modes work silently — no save dialog or confirmation appears.",
    ],
    tips: [
      "Use 'On Focus Change' for a frictionless experience with no delay — your notes are always saved when you navigate away.",
      "Use 'After Delay' with a short interval (1000-2000ms) if you want near-continuous saving while typing.",
      "A longer delay (5000ms+) is useful if you're on a slower device and want to reduce disk write frequency.",
      "Auto-Save does not replace manual Ctrl+S — you can still save explicitly at any time.",
    ],
  },

  "spellcheck-options": {
    overview:
      "Spell Check adds real-time spell checking to the editor, underlining misspelled words with a wavy red line so you can catch typos as you write. It uses a built-in English dictionary with per-vault custom word support.",
    usage: [
      "Enable the Spellcheck toggle in settings to activate spell checking.",
      "Misspelled words are underlined with a wavy red line as you type.",
      "Right-click an underlined word to see up to 5 spelling suggestions.",
      "Select a suggestion to replace the misspelled word instantly.",
      "'Add to Dictionary' saves the word to your vault's custom dictionary (.cascade/dictionary.json).",
      "'Ignore' hides the word for the current session only.",
      "Enable 'Skip Capitalized Words' to avoid flagging proper nouns and acronyms.",
    ],
    tips: [
      "Technical terms, proper nouns, and domain-specific jargon will often be flagged — use 'Add to Dictionary' to whitelist them permanently.",
      "Spell check automatically skips code blocks, frontmatter YAML, inline code, and URLs.",
      "If spell check feels distracting while drafting, disable it and re-enable it during editing passes.",
      "Custom dictionary words are stored per-vault in .cascade/dictionary.json and persist across sessions.",
    ],
  },

  "templates-options": {
    overview:
      "Templates let you pre-fill new notes with structured content and dynamic variables, making it fast to start any type of note consistently.",
    usage: [
      "Create template files in your vault's templates folder (configured in Files settings).",
      "When creating a new note, select a template from the template picker.",
      "The template content is inserted into the new note, with all variables expanded.",
      "Use `{{title}}` in your template to insert the new note's filename as the title.",
      "Use `{{date}}` for today's date, `{{time}}` for the current time, and `{{datetime}}` for both.",
      "Use `{{date:FORMAT}}` to specify a custom date format (e.g., `{{date:MMMM D, YYYY}}`).",
      "Place `{{cursor}}` in the template where you want the cursor to land after insertion.",
      "Use `{{clipboard}}` to paste your current clipboard content into the template.",
    ],
    tips: [
      "Create templates for recurring note types: meeting notes, book summaries, project briefs, daily journals.",
      "`{{cursor}}` is especially valuable — place it in the first blank field you need to fill in so you can start typing immediately.",
      "Combine `{{title}}` with a frontmatter `title:` property so the note's metadata always matches its filename.",
      "Store template files in a dedicated `Templates/` folder at the root of your vault and exclude it from search results.",
    ],
    syntaxExamples: [
      { syntax: "{{title}}", description: "Inserts the new note's filename" },
      { syntax: "{{date}}", description: "Inserts today's date (YYYY-MM-DD)" },
      {
        syntax: "{{date:MMMM D, YYYY}}",
        description: "Inserts today's date in a custom format",
      },
      { syntax: "{{time}}", description: "Inserts the current time" },
      {
        syntax: "{{datetime}}",
        description: "Inserts the current date and time",
      },
      {
        syntax: "{{cursor}}",
        description: "Sets the cursor position after template insertion",
      },
      {
        syntax: "{{clipboard}}",
        description: "Inserts the current clipboard content",
      },
    ],
  },

  "slashcommands-options": {
    overview:
      "Slash commands give you quick access to formatting and content insertion via an inline menu. Type / at the start of a line or after a space to open a floating dropdown with commands organized into groups: Text & Headings, Code & Media, Structured, and Embeds.",
    usage: [
      "Type `/` at the beginning of a line or after a space to open the command menu.",
      "Start typing to filter commands — for example, `/head` shows only heading options.",
      "Use Arrow Up/Down to navigate the menu, then press Enter to insert the selected command.",
      "Press Escape to dismiss the menu without inserting anything.",
      "Click any item in the menu to insert it directly.",
      "Toggle the feature on or off in Settings → Features → Slash Commands.",
    ],
    tips: [
      "Slash commands only trigger at word boundaries — typing a `/` in the middle of a URL or file path won't open the menu.",
      "Use `/callout` to quickly insert a callout block with the `> [!NOTE]` syntax.",
      "The `/template` command opens the Quick Open dialog filtered to your templates folder.",
      "The `/embed` command opens the link picker so you can search for a note to embed.",
      "Filter keywords work beyond the label — try `/todo` for task lists or `/hr` for horizontal dividers.",
    ],
    shortcuts: [
      { key: "/", action: "Open slash command menu" },
      { key: "↑ / ↓", action: "Navigate menu items" },
      { key: "Enter", action: "Insert selected command" },
      { key: "Escape", action: "Dismiss menu" },
    ],
  },

  "search-options": {
    overview:
      "Search lets you find text across every file in your vault instantly, with support for case-sensitive, whole-word, and regular expression queries.",
    usage: [
      "Press Ctrl+Shift+F to open the Search panel.",
      "Type your query to search all files in the vault in real time.",
      "Results show the file name and the matching line with the query highlighted.",
      "Click any result to open that file and jump to the match.",
      "Toggle 'Case Sensitive' in the search bar or settings to match exact casing.",
      "Toggle 'Whole Word' to only match the query as a complete word (not as part of a longer word).",
      "Toggle 'Use Regex' to write regular expression queries for advanced pattern matching.",
    ],
    tips: [
      "Use regex mode with `^# ` to find all lines that are H1 headings across your vault.",
      "Whole Word mode is useful for searching short terms that appear as substrings elsewhere (e.g., searching 'go' won't match 'going').",
      "Search indexes frontmatter and tags too — search for `#tagname` to find all notes with that tag.",
      "Combine Search with Bookmarks: search for a topic, find the key notes, then bookmark them for quick access later.",
    ],
    shortcuts: [
      { key: "Ctrl+Shift+F", action: "Open the Search panel" },
    ],
  },

  "focusmode-options": {
    overview:
      "Focus Mode hides all UI chrome and optionally dims non-active paragraphs, creating a distraction-free writing environment for deep work.",
    usage: [
      "Press F11 or Ctrl+Shift+Enter to toggle Focus Mode on.",
      "The sidebar, title bar, and status bar are hidden, leaving only the editor.",
      "Enable 'Dim Paragraphs' in settings to fade all paragraphs except the one your cursor is in.",
      "Enable 'Typewriter Scrolling' in settings to keep your active line at a fixed vertical position.",
      "Press Escape or F11 again to exit Focus Mode and return to the normal interface.",
    ],
    tips: [
      "Use Focus Mode with Typewriter Scrolling and Dim Paragraphs for a truly immersive writing experience.",
      "Pair Focus Mode with a word count goal — the goal progress in the status bar still shows on exit, so you can check progress without breaking focus.",
      "The keyboard shortcut F11 is easy to hit while keeping your hands on the keyboard — no mouse required.",
      "Focus Mode is ideal for timed writing sessions (e.g., Pomodoro). Enter with F11, write for 25 minutes, exit with F11.",
    ],
    shortcuts: [
      { key: "F11", action: "Toggle Focus Mode" },
      { key: "Ctrl+Shift+Enter", action: "Toggle Focus Mode" },
      { key: "Escape", action: "Exit Focus Mode" },
    ],
  },

  "wordcountgoal-options": {
    overview:
      "Word Count Goal lets you set a target word count for the current note and track your progress in real time from the status bar.",
    usage: [
      "Set your target word count (1–100,000) in settings.",
      "Enable 'Show in Status Bar' to see your progress as a fraction (e.g., '1,234 / 5,000 words').",
      "Enable 'Notify on Reach' to receive a toast notification when you hit your goal.",
      "The current word count updates live as you type.",
      "The goal applies per session — there's no per-note goal persistence.",
    ],
    tips: [
      "Use word count goals for timed writing sprints — set a 500-word goal for a 15-minute sprint.",
      "For long-form projects, set a daily contribution goal (e.g., 300 words) rather than a total document goal.",
      "The notification on reaching the goal is a satisfying milestone — enable it to reinforce the writing habit.",
      "Combine with Focus Mode for a distraction-free goal-oriented session: set your goal, enter Focus Mode, write until you hear the notification.",
    ],
  },

  "bookmarks-options": {
    overview:
      "Bookmarks let you star important files for instant access from the Bookmarks sidebar panel, keeping your most-used notes always one click away.",
    usage: [
      "Enable the Bookmarks feature in settings.",
      "Right-click any file in the file explorer and select 'Bookmark' to star it.",
      "Bookmarked files appear in the Bookmarks panel in the sidebar.",
      "Click any bookmarked file in the panel to open it immediately.",
      "Right-click a bookmarked file (in the explorer or Bookmarks panel) and select 'Remove Bookmark' to unstar it.",
    ],
    tips: [
      "Bookmark your vault's index or MOC (Map of Content) note for instant navigation to your knowledge hub.",
      "Bookmark your current active project note so it's always one click away, no matter how deep in subfolders it lives.",
      "Bookmarks complement Daily Notes: bookmark your current week's note so it's easy to get to throughout the week.",
      "Use Bookmarks as a 'currently reading' or 'in progress' list — bookmark notes you're actively working on, and remove the bookmark when done.",
    ],
  },

  "typewriter-options": {
    overview:
      "Typewriter Mode keeps your active editing line at a fixed vertical position on screen, so your eyes stay in one place as the text scrolls up around you.",
    usage: [
      "Enable Typewriter Mode in settings.",
      "As you type, the line you're on stays at the configured vertical position.",
      "Adjust 'Vertical Offset' (10–90%) to control where your active line sits — 50% is screen center, lower values move it higher.",
      "Extra padding is automatically added at the bottom of the document so the last line can scroll up to the target position.",
    ],
    tips: [
      "50% (center) is the classic typewriter position and works well for most users.",
      "Try a slightly lower offset (30-40%) if you like to see more upcoming text below your cursor.",
      "Typewriter Mode pairs naturally with Focus Mode — enable both for a truly immersive long-form writing environment.",
      "The vertical offset preference is personal — experiment for a session to find what feels most natural for your posture and monitor height.",
    ],
  },

  "indentguides-options": {
    overview:
      "Indent Guides draw vertical lines at each indentation level in the editor, making it easy to visually track nesting depth in lists, code, and structured content.",
    usage: [
      "Enable Indent Guides in settings.",
      "Vertical lines appear automatically at each tab/space indentation level.",
      "Choose a Guide Color from the 14 Catppuccin palette colors in settings.",
      "Choose a Guide Style: solid, dashed, or dotted.",
    ],
    tips: [
      "Use a subtle color (low-contrast, like the surface colors) so guides assist without distracting.",
      "Dashed or dotted styles feel less heavy than solid lines — a good choice if the guides feel too prominent.",
      "Indent guides are especially useful in deeply nested bullet-point outlines where it's easy to lose track of hierarchy.",
      "Match the guide color to the Catppuccin overlay or surface colors for the most harmonious look.",
    ],
  },

  "imagepreview-options": {
    overview:
      "Image Preview renders images inline below their markdown syntax, so you can see your images while editing without switching to a preview pane.",
    usage: [
      "Write standard markdown image syntax: `![alt text](path/to/image.png)`.",
      "The image renders inline below the link in Live Preview.",
      "Supports local vault images (relative paths) and external URLs.",
      "Set 'Max Height' in settings (100–800px) to control the maximum size of previewed images.",
    ],
    tips: [
      "Set Max Height to 200-300px for a compact preview that lets you see your text and image together without the image dominating the screen.",
      "Use a large Max Height (600-800px) when working in image-heavy notes like visual research boards.",
      "Local images use paths relative to the vault root — e.g., `![](attachments/diagram.png)` works if your image is in an `attachments` folder.",
      "Place your cursor on the image syntax line to temporarily collapse the preview and see the raw markdown.",
    ],
    syntaxExamples: [
      {
        syntax: "![alt text](image.png)",
        description: "Local vault image (relative path)",
      },
      {
        syntax: "![alt text](https://example.com/image.png)",
        description: "External image from a URL",
      },
    ],
  },

  "mediaviewer-options": {
    overview:
      "The Media Viewer lets you open images and PDF files directly in editor tabs, so you can view and navigate media without leaving the app.",
    usage: [
      "Click any image or PDF file in the file explorer to open it in a tab.",
      "Use Ctrl+Click to open in a new tab alongside your current work.",
      "Image viewer supports zoom (scroll wheel, +/- buttons), fit-to-view, and actual-size modes.",
      "PDF viewer renders all pages with scroll navigation, page input, and zoom controls.",
      "Set default zoom levels for images and PDFs in the Media Viewer settings.",
    ],
    tips: [
      "Use 'Fit to View' for images to always see the full picture regardless of image size.",
      "In the PDF viewer, use 'Fit Width' to match the page width to your editor pane.",
      "Click and drag to pan around zoomed-in images.",
      "The PDF viewer only renders visible pages plus a small buffer for smooth scrolling performance.",
    ],
    shortcuts: [
      { key: "Scroll wheel", action: "Zoom in/out on images" },
      { key: "Click + Drag", action: "Pan zoomed images" },
    ],
  },

  "toc-options": {
    overview:
      "The Table of Contents feature auto-generates a linked list of all headings in your document, making long notes easy to navigate with a single insert.",
    usage: [
      "Open the Command Palette and search for 'Insert Table of Contents'.",
      "The TOC is inserted at your cursor position as a linked markdown list.",
      "Each entry links to its corresponding heading in the document.",
      "Enable 'Auto-Update on Save' in settings to regenerate the TOC automatically every time you save.",
      "Without auto-update, you can manually re-run the Insert TOC command to refresh it after adding headings.",
    ],
    tips: [
      "Place the TOC near the top of the document, just below the title and any introductory paragraph.",
      "Enable Auto-Update on Save if your document's heading structure changes frequently — it prevents the TOC from going stale.",
      "For shorter documents (under 10 headings), a TOC may not be necessary; it shines in long-form notes, documentation, and MOCs.",
      "The generated TOC uses standard markdown list syntax, so it's portable and renders correctly in any markdown viewer.",
    ],
  },

  "canvas-options": {
    overview:
      "The Canvas is an infinite whiteboard for visual thinking — drag cards, draw connections, and group related ideas spatially. It uses the same `.canvas` file format as Obsidian for full compatibility.",
    usage: [
      "Create a new canvas from the Command Palette (Ctrl+Shift+C) or by right-clicking a folder and selecting 'New Canvas'.",
      "Click the canvas toolbar's 'Text' button to add a new text card, or drag a file from the sidebar to create a file card.",
      "Drag cards to reposition them; resize by pulling the corner or edge handles.",
      "Connect two cards by dragging from one card's edge handle to another card — an arrow (edge) is created.",
      "Click an edge to select it, then add a label or change its color and line style in the toolbar.",
      "Select multiple cards and use 'Group' in the toolbar to wrap them in a labeled group region.",
      "Use Ctrl+Mouse Wheel to zoom in and out; click and drag the background to pan.",
      "Enable 'Snap to Grid' in settings for precise card alignment.",
      "Use the minimap (bottom-right corner) for quick navigation on large canvases.",
      "Export your canvas as PNG or SVG from the Command Palette or canvas toolbar.",
    ],
    tips: [
      "Use groups to organize cards by topic or project phase — they act like visual folders on the canvas.",
      "Color-code your cards and edges to distinguish categories: e.g., blue for research, green for actions, red for blockers.",
      "The auto-layout options (grid, tree, force-directed) are great starting points — apply one and then manually adjust.",
      "Use Ctrl+A to select all cards, then apply alignment or distribution from the toolbar for a clean layout.",
      "Double-click a text card to edit its markdown content inline — full markdown rendering is supported.",
      "Link cards to existing vault files by creating 'file' type cards — clicking them opens the note in the editor.",
      "Canvas files are plain JSON — you can version-control them with git alongside your notes.",
    ],
    shortcuts: [
      { key: "Ctrl+Shift+C", action: "Create a new canvas" },
      { key: "T", action: "Add a text card (when canvas is focused)" },
      { key: "Ctrl+A", action: "Select all cards" },
      { key: "Ctrl+G", action: "Group selected cards" },
      { key: "Delete / Backspace", action: "Delete selected cards or edges" },
      { key: "Ctrl+D", action: "Duplicate selected cards" },
      { key: "Ctrl+Z / Ctrl+Shift+Z", action: "Undo / Redo" },
      { key: "Ctrl+Mouse Wheel", action: "Zoom in / out" },
      { key: "Space+Drag", action: "Pan the canvas" },
      { key: "Ctrl+Shift+F", action: "Zoom to fit all cards" },
    ],
  },

  "query-options": {
    overview:
      "Query Preview lets you embed dynamic query blocks in your notes that filter and display notes from your vault based on frontmatter properties — similar to a database view inside your notes. Full documentation for query syntax and options is shown directly in the settings page above.",
    usage: [
      "Create a fenced code block with the language set to `query`.",
      "Specify TABLE or LIST as the output format.",
      "Use FROM to filter by folder or tag source.",
      "Use WHERE to filter by frontmatter property conditions.",
      "Use SORT to order results, and LIMIT to cap the number of results shown.",
      "The query block renders its results inline in Live Preview mode.",
    ],
    tips: [
      "See the Query settings page for complete syntax reference, examples, and all supported operators.",
      "Query blocks are live — they re-evaluate as your vault changes, so results stay current automatically.",
    ],
    syntaxExamples: [
      {
        syntax: "```query\nTABLE author, date\nFROM \"Projects\"\nWHERE status = \"active\"\nSORT date DESC\nLIMIT 10\n```",
        description: "List active projects sorted by date",
      },
      {
        syntax: "```query\nLIST\nWHERE tags contains \"review\"\n```",
        description: "List all notes tagged for review",
      },
    ],
  },

  "sync-options": {
    overview:
      "GitHub Sync backs up your vault to a private GitHub repository and keeps it in sync across devices. It uses a Personal Access Token (PAT) for authentication and handles commits, pushes, and pulls automatically — no external git tools required.",
    usage: [
      "Enable GitHub Sync in the Features list to activate it.",
      "Open the GitHub Sync settings page and enter your repository URL (HTTPS format).",
      "Generate a Personal Access Token (PAT) on GitHub with 'repo' scope and paste it into the token field.",
      "Click 'Test Connection' to verify your credentials work.",
      "Click 'Connect & Push' to initialize the repository and push your vault.",
      "Once connected, Cascade automatically syncs on the interval you choose (default: every 5 minutes).",
      "Click the sync indicator in the status bar to trigger a manual sync at any time.",
    ],
    tips: [
      "Use a private repository to keep your notes secure — your PAT is stored locally in your vault settings.",
      "If a sync conflict occurs, Cascade saves the remote version as 'filename.conflict.md' next to your local copy. Review both, keep what you want, and delete the .conflict.md file.",
      "The status bar shows your sync state: green cloud = synced, spinning = syncing, red = error, orange = offline with pending commits.",
      "If you work offline, Cascade commits locally and pushes everything when you reconnect.",
      "Auto-sync skips if a sync is already in progress, so rapid saves won't cause issues.",
      "Cascade auto-generates a .gitignore to exclude app config, OS files, and temp files from the repo.",
    ],
  },
};
