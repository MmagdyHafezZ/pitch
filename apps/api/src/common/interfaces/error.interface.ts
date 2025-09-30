export interface ServiceError {
  status?: number;
  message?: string;
  stack?: string;
}

export interface PrismaError {
  code?: string;
  message?: string;
}
