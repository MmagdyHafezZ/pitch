/**
 * OpenAI tool definitions for the PITCH AI Coach.
 *
 *  - propose_ui_action   — navigate, click, fill, highlight, sequence, etc.
 *  - generate_document   — produce a downloadable PDF / markdown / txt
 *  - fetch_document      — read a document uploaded by the user from an S3 URL
 *  - show_options        — render quick-reply pill buttons in the chat widget
 *  - create_session      — create a session in the background (no wizard)
 *  - get_calendar_events — fetch upcoming calendar meetings
 *  - configure_session   — apply AI + delivery config to an existing session
 */

export const SHOW_OPTIONS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'show_options',
    description:
      'Show 2–5 clickable quick-reply buttons to the user. ALWAYS call this alongside any question that has a small, enumerable set of valid answers — e.g. "background or wizard?", "text or voice session?", "which meeting?", "yes or no?". The buttons appear above the input bar and auto-send the chosen option as a message. Keep labels short (1–5 words). This does NOT replace your text reply — always include a natural-language question in your text AND call this tool.',
    parameters: {
      type: 'object',
      properties: {
        options: {
          type: 'array',
          description:
            'Button labels shown to the user. 2–5 items. Keep each under 5 words. Mark the recommended/default option with a ✓ suffix if applicable.',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 5,
        },
      },
      required: ['options'],
    },
  },
};

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
          description: 'The attachment download URL of the document to fetch.',
        },
      },
      required: ['url'],
    },
  },
};

export const CREATE_SESSION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'create_session',
    description:
      'Create a new practice session in the background without the wizard. Use this when the user asks you to create a session for them directly — AFTER you have asked whether they want background mode or step-by-step wizard, and they chose background (or agreed to the default). You MUST gather: name, topic, ai_role, and user_role before calling this tool. Infer them from context (uploaded files, calendar events, user description) or ask if missing.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Session display name. Make it descriptive. E.g. "Q1 Review Prep — Acme Corp" or "Cold Call Practice: Enterprise Software".',
        },
        type: {
          type: 'string',
          enum: ['text', 'voice', 'video', 'phone'],
          description: 'Session modality. Default: text.',
        },
        topic: {
          type: 'string',
          description: 'Main topic, product, or meeting being practiced.',
        },
        objective: {
          type: 'string',
          description:
            "Practice goal. E.g. 'Present Q1 results and secure Q2 budget approval', 'Handle price objections and close the deal'.",
        },
        context: {
          type: 'string',
          description:
            'Background info for the AI persona. Include company names, attendee roles, pain points, deal stage, or any relevant facts extracted from uploaded files or calendar events.',
        },
        ai_role: {
          type: 'string',
          description:
            "Who the AI persona plays. Be specific — e.g. 'Skeptical VP of Finance', 'Technical CTO evaluating vendors', 'Demanding procurement manager'.",
        },
        user_role: {
          type: 'string',
          description:
            "Who the user plays. E.g. 'Account Executive', 'Solutions Consultant', 'SDR', 'Founder'.",
        },
        tone: {
          type: 'string',
          enum: ['formal', 'professional', 'friendly', 'casual'],
          description: 'Conversational tone. Default: professional.',
        },
        difficulty: {
          type: 'string',
          enum: ['warm-up', 'focused', 'challenging', 'elite'],
          description:
            'AI persona difficulty. Default: focused. Use challenging/elite for high-stakes or executive-level meetings.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional categorization tags. E.g. ["enterprise", "q1", "discovery"].',
        },
        calendar_event_id: {
          type: 'string',
          description:
            'Calendar event ID to link to this session. Set when creating from a specific meeting.',
        },
        calendar_provider: {
          type: 'string',
          enum: ['google', 'microsoft'],
          description:
            'Calendar provider. Required when calendar_event_id is set.',
        },
      },
      required: ['name', 'topic', 'ai_role', 'user_role'],
    },
  },
};

export const GET_CALENDAR_EVENTS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_calendar_events',
    description:
      "Fetch the user's upcoming calendar events. Call this when the user asks about upcoming meetings, their schedule, what's on their calendar, or when you want to proactively suggest preparing for a meeting.",
    parameters: {
      type: 'object',
      properties: {
        look_ahead_days: {
          type: 'number',
          description:
            'How many days ahead to look for events. Defaults to 7. Max 30.',
          minimum: 1,
          maximum: 30,
        },
      },
      required: [],
    },
  },
};

export const CONFIGURE_SESSION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'configure_session',
    description:
      "Configure or improve a session's AI persona, scenario, and delivery settings. Call this when the user asks to set up, configure, fix, or improve a session's AI settings — especially for calendar-generated sessions that are missing a persona, scenario, or LLM configuration. Also call this proactively when the user is viewing a session detail page and mentions that the session is empty, not configured, or missing settings.",
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description:
            'The ID of the session to configure. Use the session ID from the current page context.',
        },
        topic: {
          type: 'string',
          description:
            'The main topic or meeting title. Infer from the session name or calendar event title.',
        },
        objective: {
          type: 'string',
          description:
            "The practice goal. E.g. 'Present Q1 results and secure Q2 budget approval', 'Overcome price objections and close the deal'.",
        },
        context: {
          type: 'string',
          description:
            'Background info for the scenario. Include attendee names/roles, company info, and meeting purpose.',
        },
        ai_role: {
          type: 'string',
          description:
            "Who the AI persona should play. Be specific — e.g. 'Skeptical VP of Finance', 'Technical CTO evaluating vendors', 'Friendly enterprise buyer'.",
        },
        user_role: {
          type: 'string',
          description:
            "Who the user is playing. E.g. 'Account Executive', 'Solutions Consultant', 'SDR'.",
        },
        tone: {
          type: 'string',
          enum: ['formal', 'professional', 'friendly', 'casual'],
          description:
            'Conversational tone for the AI persona. Default: professional.',
        },
        difficulty: {
          type: 'string',
          enum: ['warm-up', 'focused', 'challenging', 'elite'],
          description:
            'How tough the AI persona should be. Default: focused. Use challenging or elite for high-stakes meetings.',
        },
      },
      required: ['session_id', 'topic', 'ai_role', 'user_role'],
    },
  },
};

/** All coach tools in the order they are registered with OpenAI. */
export const ALL_COACH_TOOLS = [
  SHOW_OPTIONS_TOOL,
  UI_ACTION_TOOL,
  DOCUMENT_GENERATION_TOOL,
  FETCH_DOCUMENT_TOOL,
  GET_CALENDAR_EVENTS_TOOL,
  CREATE_SESSION_TOOL,
  CONFIGURE_SESSION_TOOL,
];
