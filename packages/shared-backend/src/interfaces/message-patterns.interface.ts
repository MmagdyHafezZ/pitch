export const USER_SERVICE_PATTERNS = {
  GET_USER: 'get_user',
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user',
  GET_USERS: 'get_users',
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REFRESH: 'auth.refresh',
  VALIDATE_USER: 'auth.validateUser',
  OAUTH_GET_PROVIDERS: 'auth.oauth.getProviders',
  CHECK_EMAIL: 'auth.checkEmail',
  CREATE_TEAM: 'create_team',
  UPDATE_TEAM: 'update_team',
  DELETE_TEAM: 'delete_team',
  GET_TEAM: 'get_team',
  GET_TEAMS: 'get_teams',
  GET_USER_TEAMS: 'get_user_teams',
  ADD_TEAM_MEMBER: 'add_team_member',
  UPDATE_TEAM_MEMBER: 'update_team_member',
  DELETE_TEAM_MEMBER: 'delete_team_member',
} as const

export const BUSINESS_SERVICE_PATTERNS = {
  GET_BUSINESS: 'get_business',
  GET_BUSINESS_WITH_USER: 'get_business_with_user',
  CREATE_BUSINESS: 'create_business',
  UPDATE_BUSINESS: 'update_business',
  DELETE_BUSINESS: 'delete_business',
  GET_BUSINESSES: 'get_businesses',
} as const

export const CRM_SERVICE_PATTERNS = {
  SALESFORCE_CONNECT: 'salesforce.connect',
  SALESFORCE_CALLBACK: 'salesforce.callback',
  SALESFORCE_GET_STATUS: 'salesforce.getStatus',
  SALESFORCE_GET_CONTACTS: 'salesforce.getContacts',
  SALESFORCE_GET_ACCOUNTS: 'salesforce.getAccounts',
  SALESFORCE_GET_OPPORTUNITIES: 'salesforce.getOpportunities',
  SALESFORCE_GET_LEADS: 'salesforce.getLeads',
  SALESFORCE_QUERY: 'salesforce.query',
  SALESFORCE_SEARCH: 'salesforce.search',
  SALESFORCE_DISCONNECT: 'salesforce.disconnect',
} as const
export const SIMULATION_SERVICE_PATTERNS = {
  CREATE_SESSION: 'simulation.session.create',
  GET_SESSION: 'simulation.session.get',
  END_SESSION: 'simulation.session.end',
  UPDATE_SESSION: 'simulation.session.update',
  DELETE_SESSION: 'simulation.session.delete',
  LIST_SESSIONS: 'simulation.session.list',
  SESSION_TIMELINE: 'simulation.session.timeline',
  ADD_SESSION_MEMBERS: 'simulation.session.members.add',
  LIST_SESSION_MEMBERS: 'simulation.session.members.list',
  REMOVE_SESSION_MEMBER: 'simulation.session.members.remove',

  CREATE_INVITATIONS: 'simulation.invitation.create',
  GET_INVITATION: 'simulation.invitation.get',
  LIST_SESSION_INVITATIONS: 'simulation.invitation.listBySession',
  LIST_USER_INVITATIONS: 'simulation.invitation.listByUser',
  LIST_SENT_INVITATIONS: 'simulation.invitation.listSent',
  ACCEPT_INVITATION: 'simulation.invitation.accept',
  DECLINE_INVITATION: 'simulation.invitation.decline',
  REVOKE_INVITATION: 'simulation.invitation.revoke',
  DELETE_INVITATION: 'simulation.invitation.delete',
  GET_PENDING_COUNT: 'simulation.invitation.pendingCount',

  CREATE_TURN: 'simulation.turn.create',
  GET_TURN: 'simulation.turn.get',
  LIST_TURNS: 'simulation.turn.list',

  CHAT_COMPLETE: 'simulation.chat.complete',
  CHAT_STREAM: 'simulation.chat.stream',
  CHAT_CANCEL: 'simulation.chat.cancel',

  CONVERSATION_PROCESS: 'simulation.conversation.process',
  CONVERSATION_STREAM: 'simulation.conversation.stream',
  CONVERSATION_TEXT_STREAM: 'simulation.conversation.text.stream',

  LLM_ROUTING_GET: 'simulation.llm.routing.get',
  LLM_ROUTING_UPSERT: 'simulation.llm.routing.upsert',

  STT_TRANSCRIBE: 'simulation.stt.transcribe',
  STT_STREAM: 'simulation.stt.stream',

  TTS_SYNTHESIZE: 'simulation.tts.synthesize',

  GET_SCENARIO: 'simulation.scenario.get',
  LIST_SCENARIOS: 'simulation.scenario.list',
  CREATE_SCENARIO: 'simulation.scenario.create',
  UPDATE_SCENARIO: 'simulation.scenario.update',
  DELETE_SCENARIO: 'simulation.scenario.delete',

  GET_PERSONA: 'simulation.persona.get',
  LIST_PERSONAS: 'simulation.persona.list',
  CREATE_PERSONA: 'simulation.persona.create',
  UPDATE_PERSONA: 'simulation.persona.update',
  DELETE_PERSONA: 'simulation.persona.delete',

  CREATE_CALL_SESSION: 'simulation.call.create',
  END_CALL_SESSION: 'simulation.call.end',
  UPLOAD_MEDIA: 'simulation.media.upload',
  GET_MEDIA: 'simulation.media.get',

  GET_TRANSCRIPT: 'simulation.transcript.get',
  LIST_TRANSCRIPTS: 'simulation.transcript.list',

  GET_SCORECARD: 'simulation.scorecard.get',
  CREATE_SCORECARD: 'simulation.scorecard.create',
  GET_RUBRIC: 'simulation.rubric.get',
  LIST_RUBRICS: 'simulation.rubric.list',
  CREATE_RUBRIC: 'simulation.rubric.create',

  REQUEST_REPORT: 'simulation.report.request',
  GET_REPORT: 'simulation.report.get',

  PUBLISH_EVENT: 'simulation.event.publish',

  ASSESSMENT_RUN_REQUEST: 'assessment.run.request',
  ASSESSMENT_RUN_COMPLETED: 'assessment.run.completed',
  ASSESSMENT_RUN_FAILED: 'assessment.run.failed',
  ASSESSMENT_RUN: 'assessment.run',
  ASSESSMENT_STATUS: 'assessment.status',
  ASSESSMENT_LATEST: 'assessment.latest',

  HINTS_GENERATE: 'simulation.hints.generate',
  HINTS_HISTORY: 'simulation.hints.history',

  PHONE_CALL_START: 'simulation.phone.call.start',
} as const

export type UserServicePattern = (typeof USER_SERVICE_PATTERNS)[keyof typeof USER_SERVICE_PATTERNS]
export type BusinessServicePattern =
  (typeof BUSINESS_SERVICE_PATTERNS)[keyof typeof BUSINESS_SERVICE_PATTERNS]
export type CrmServicePattern = (typeof CRM_SERVICE_PATTERNS)[keyof typeof CRM_SERVICE_PATTERNS]
export type SimulationServicePattern =
  (typeof SIMULATION_SERVICE_PATTERNS)[keyof typeof SIMULATION_SERVICE_PATTERNS]
export const SUPPORT_SERVICE_PATTERNS = {
  EMAIL_SEND_VERIFICATION_CODE: 'support.email.sendVerificationCode',
} as const
export const TTS_SERVICE_PATTERNS = {
  SPEAK: 'tts.speak',
  STREAM: 'tts.stream',
  LIST_PROVIDERS: 'tts.providers',
  GET_VOICES: 'tts.voices',
} as const
