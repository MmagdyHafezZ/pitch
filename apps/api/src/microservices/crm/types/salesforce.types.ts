/**
 * Salesforce API Response Types
 * These interfaces define the structure of data returned from Salesforce APIs
 */

export interface SalesforceContact {
  Id: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  Title?: string;
  Account?: {
    Id: string;
    Name: string;
  };
  MailingStreet?: string;
  MailingCity?: string;
  MailingState?: string;
  MailingPostalCode?: string;
  MailingCountry?: string;
  Description?: string;
  [key: string]: unknown;
}

export interface SalesforceAccount {
  Id: string;
  Name?: string;
  Website?: string;
  Phone?: string;
  Industry?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  BillingStreet?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingPostalCode?: string;
  BillingCountry?: string;
  Description?: string;
  Type?: string;
  [key: string]: unknown;
}

export interface SalesforceOpportunity {
  Id: string;
  Name?: string;
  Amount?: number;
  StageName?: string;
  Probability?: number;
  CloseDate?: string;
  Description?: string;
  NextStep?: string;
  Type?: string;
  LeadSource?: string;
  IsClosed?: boolean;
  IsWon?: boolean;
  [key: string]: unknown;
}

export interface SalesforceLead {
  Id: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  Company?: string;
  Title?: string;
  Status?: string;
  Rating?: string;
  LeadSource?: string;
  Street?: string;
  City?: string;
  State?: string;
  PostalCode?: string;
  Country?: string;
  Description?: string;
  Website?: string;
  IsConverted?: boolean;
  [key: string]: unknown;
}

export interface SalesforceQueryResponse<T> {
  records: T[];
  totalSize?: number;
  done?: boolean;
}

export interface SalesforceTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  instance_url: string;
  token_type?: string;
}

export interface SalesforceUserInfo {
  user_id: string;
  email: string;
  name?: string;
}

export interface SessionCrmDataPayload {
  orgId?: string;
  contacts?: SalesforceContact[];
  accounts?: SalesforceAccount[];
  opportunities?: SalesforceOpportunity[];
  leads?: SalesforceLead[];
}
