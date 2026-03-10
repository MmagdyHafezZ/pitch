/**
 * OpenAI tool definitions for the PITCH AI Coach.
 *
 * Three tools are available:
 *  - propose_ui_action   — navigate, click, fill, highlight, sequence, etc.
 *  - generate_document   — produce a downloadable PDF / markdown / txt
 *  - fetch_document      — read a document uploaded by the user from an S3 URL
 */

export const UI_ACTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'propose_ui_action',
    description:
      'Propose a clickable UI action button for the user. Call this when the user asks to go somewhere, create something, find something on screen, or do something in the app.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'navigate',
            'open_settings',
            'scroll_to',
            'highlight',
            'click',
            'start_tour',
            'fill',
            'sequence',
          ],
          description:
            'navigate = go to a route; open_settings = open Settings modal; scroll_to = scroll to a UI element; highlight = scroll + flash; click = click an element; start_tour = guided tour; fill = type a value into a form field (provide target or selector + value); sequence = execute multiple steps in order (provide steps array)',
        },
        label: {
          type: 'string',
          description:
            'Short button label shown to the user, e.g. "Show me" or "Click Create Session"',
        },
        path: {
          type: 'string',
          description:
            'Route path for navigate type (e.g. /studio/sessions/create)',
        },
        target: {
          type: 'string',
          description:
            'data-tour-id value of the DOM element to act on. Use for scroll_to, highlight, and click actions. Preferred over selector when available — no permission prompt.',
        },
        screen: {
          type: 'string',
          enum: ['home', 'sessions', 'analytics', 'challenges', 'team-config'],
          description: 'Tour screen name for start_tour action.',
        },
        selector: {
          type: 'string',
          description:
            'An arbitrary CSS selector for DOM elements not covered by data-tour-id targets. ALWAYS prefer target over selector. REQUIRES reason to be set.',
        },
        reason: {
          type: 'string',
          description:
            'Required when using selector. Shown to the user in a permission dialog before the action executes.',
        },
        value: {
          type: 'string',
          description:
            'The text to type into a form field. Required for fill type.',
        },
        steps: {
          type: 'array',
          description:
            'Ordered list of sub-actions for sequence type. The user sees and approves the full list before anything runs.',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: [
                  'navigate',
                  'open_settings',
                  'scroll_to',
                  'highlight',
                  'click',
                  'start_tour',
                  'fill',
                ],
              },
              label: {
                type: 'string',
                description: 'Short description of this step',
              },
              path: { type: 'string' },
              target: { type: 'string' },
              selector: { type: 'string' },
              value: { type: 'string' },
              reason: { type: 'string' },
              screen: { type: 'string' },
            },
            required: ['type', 'label'],
          },
        },
      },
      required: ['label'],
    },
  },
};

export const DOCUMENT_GENERATION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'generate_document',
    description:
      'Generate a downloadable document (coaching plan, session summary, sales guide, etc.) for the user. Call this when the user asks for a written artifact they can save or share.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description:
            'Document title — used as the filename (no extension). E.g. "IBM Code Engine Sales Coaching Plan"',
        },
        content: {
          type: 'string',
          description:
            'Full document content. Use markdown headings and bullet points for structure.',
        },
        format: {
          type: 'string',
          enum: ['pdf', 'txt', 'markdown'],
          description: 'Output format. Default: pdf.',
        },
      },
      required: ['title', 'content'],
    },
  },
};

export const FETCH_DOCUMENT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'fetch_document',
    description:
      'Fetch and read the text content of a document from a URL (e.g. a PDF uploaded by the user). Call this tool whenever the user has shared a document and you need its contents to answer their question.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The presigned URL of the document to fetch.',
        },
      },
      required: ['url'],
    },
  },
};

/** All coach tools in the order they are registered with OpenAI. */
export const ALL_COACH_TOOLS = [
  UI_ACTION_TOOL,
  DOCUMENT_GENERATION_TOOL,
  FETCH_DOCUMENT_TOOL,
];
