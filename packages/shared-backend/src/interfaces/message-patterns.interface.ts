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

export const SIMULATION_SERVICE_PATTERNS = {
  CREATE_SESSION: 'simulation.session.create',
  GET_SESSION: 'simulation.session.get',
  END_SESSION: 'simulation.session.end',
  UPDATE_SESSION: 'simulation.session.update',
  LIST_SESSIONS: 'simulation.session.list',

  CREATE_TURN: 'simulation.turn.create',
  GET_TURN: 'simulation.turn.get',
  LIST_TURNS: 'simulation.turn.list',

  CHAT_COMPLETE: 'simulation.chat.complete',
  CHAT_STREAM: 'simulation.chat.stream',
  CHAT_CANCEL: 'simulation.chat.cancel',

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
} as const

export type UserServicePattern = (typeof USER_SERVICE_PATTERNS)[keyof typeof USER_SERVICE_PATTERNS]
export type BusinessServicePattern =
  (typeof BUSINESS_SERVICE_PATTERNS)[keyof typeof BUSINESS_SERVICE_PATTERNS]
export type SimulationServicePattern =
  (typeof SIMULATION_SERVICE_PATTERNS)[keyof typeof SIMULATION_SERVICE_PATTERNS]
