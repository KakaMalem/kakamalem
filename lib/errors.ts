/**
 * Professional Error Handling System
 *
 * Error codes follow the pattern: [CATEGORY]-[SPECIFIC]
 * - SYS: System/infrastructure errors
 * - DB: Database errors
 * - AUTH: Authentication/authorization errors
 * - VAL: Validation errors
 * - RES: Resource errors (not found, etc.)
 * - EXT: External service errors
 */

export type ErrorCategory =
  | "system"
  | "database"
  | "authentication"
  | "authorization"
  | "validation"
  | "not_found"
  | "external_service"
  | "rate_limit"
  | "maintenance";

export interface AppError {
  code: string;
  category: ErrorCategory;
  message: string; // User-friendly message
  technicalMessage?: string; // For logging only
  recoverable: boolean;
  retryable: boolean;
  statusCode: number;
}

/**
 * Error definitions with user-friendly messages
 * These messages are safe to show to users
 */
export const ERROR_DEFINITIONS: Record<string, AppError> = {
  // System errors
  "SYS-001": {
    code: "SYS-001",
    category: "system",
    message:
      "We're experiencing technical difficulties. Please try again in a few moments.",
    technicalMessage: "Unexpected system error",
    recoverable: true,
    retryable: true,
    statusCode: 500,
  },
  "SYS-002": {
    code: "SYS-002",
    category: "maintenance",
    message:
      "We're currently performing maintenance. Please check back shortly.",
    technicalMessage: "System under maintenance",
    recoverable: true,
    retryable: false,
    statusCode: 503,
  },

  // Database errors
  "DB-001": {
    code: "DB-001",
    category: "database",
    message:
      "We're having trouble connecting to our servers. Please try again in a moment.",
    technicalMessage: "Database connection failed",
    recoverable: true,
    retryable: true,
    statusCode: 503,
  },
  "DB-002": {
    code: "DB-002",
    category: "database",
    message: "The request took too long to process. Please try again.",
    technicalMessage: "Database query timeout",
    recoverable: true,
    retryable: true,
    statusCode: 504,
  },
  "DB-003": {
    code: "DB-003",
    category: "database",
    message: "We couldn't save your changes. Please try again.",
    technicalMessage: "Database write operation failed",
    recoverable: true,
    retryable: true,
    statusCode: 500,
  },

  // Authentication errors
  "AUTH-001": {
    code: "AUTH-001",
    category: "authentication",
    message: "Your session has expired. Please log in again.",
    technicalMessage: "Session expired or invalid",
    recoverable: true,
    retryable: false,
    statusCode: 401,
  },
  "AUTH-002": {
    code: "AUTH-002",
    category: "authentication",
    message: "Invalid email or password. Please check your credentials.",
    technicalMessage: "Invalid credentials provided",
    recoverable: true,
    retryable: false,
    statusCode: 401,
  },
  "AUTH-003": {
    code: "AUTH-003",
    category: "authorization",
    message: "You don't have permission to access this resource.",
    technicalMessage: "Insufficient permissions",
    recoverable: false,
    retryable: false,
    statusCode: 403,
  },

  // Resource errors
  "RES-001": {
    code: "RES-001",
    category: "not_found",
    message: "The page you're looking for doesn't exist or has been moved.",
    technicalMessage: "Resource not found",
    recoverable: false,
    retryable: false,
    statusCode: 404,
  },
  "RES-002": {
    code: "RES-002",
    category: "not_found",
    message: "This store doesn't exist or is no longer available.",
    technicalMessage: "Store not found",
    recoverable: false,
    retryable: false,
    statusCode: 404,
  },
  "RES-003": {
    code: "RES-003",
    category: "not_found",
    message: "This product is no longer available.",
    technicalMessage: "Product not found or inactive",
    recoverable: false,
    retryable: false,
    statusCode: 404,
  },
  "RES-004": {
    code: "RES-004",
    category: "not_found",
    message: "This order could not be found.",
    technicalMessage: "Order not found",
    recoverable: false,
    retryable: false,
    statusCode: 404,
  },

  // External service errors
  "EXT-001": {
    code: "EXT-001",
    category: "external_service",
    message: "We're having trouble processing your payment. Please try again.",
    technicalMessage: "Payment gateway error",
    recoverable: true,
    retryable: true,
    statusCode: 502,
  },
  "EXT-002": {
    code: "EXT-002",
    category: "external_service",
    message: "We couldn't send the email. Please try again later.",
    technicalMessage: "Email service error",
    recoverable: true,
    retryable: true,
    statusCode: 502,
  },

  // Rate limiting
  "RATE-001": {
    code: "RATE-001",
    category: "rate_limit",
    message: "Too many requests. Please wait a moment before trying again.",
    technicalMessage: "Rate limit exceeded",
    recoverable: true,
    retryable: true,
    statusCode: 429,
  },

  // Validation errors
  "VAL-001": {
    code: "VAL-001",
    category: "validation",
    message: "Please check your input and try again.",
    technicalMessage: "Validation failed",
    recoverable: true,
    retryable: false,
    statusCode: 400,
  },
};

/**
 * Classify an error and return appropriate error info
 */
export function classifyError(error: Error & { digest?: string }): AppError {
  const errorMessage = error.message?.toLowerCase() || "";
  const errorName = error.name?.toLowerCase() || "";

  // Database connection errors
  if (
    errorMessage.includes("connection") ||
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("enotfound") ||
    errorMessage.includes("socket") ||
    errorMessage.includes("pgbouncer")
  ) {
    return ERROR_DEFINITIONS["DB-001"];
  }

  // Database timeout
  if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("timed out") ||
    errorMessage.includes("canceling statement")
  ) {
    return ERROR_DEFINITIONS["DB-002"];
  }

  // Database write errors
  if (
    errorMessage.includes("duplicate key") ||
    errorMessage.includes("foreign key") ||
    errorMessage.includes("constraint")
  ) {
    return ERROR_DEFINITIONS["DB-003"];
  }

  // Auth errors
  if (
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("not authenticated") ||
    errorName.includes("auth")
  ) {
    return ERROR_DEFINITIONS["AUTH-001"];
  }

  // Permission errors
  if (
    errorMessage.includes("forbidden") ||
    errorMessage.includes("permission") ||
    errorMessage.includes("access denied")
  ) {
    return ERROR_DEFINITIONS["AUTH-003"];
  }

  // Rate limiting
  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("too many requests")
  ) {
    return ERROR_DEFINITIONS["RATE-001"];
  }

  // Default to generic system error
  return ERROR_DEFINITIONS["SYS-001"];
}

/**
 * Generate a unique error reference ID for support
 * Format: YYYYMMDD-XXXXX (date + random 5 chars)
 */
export function generateErrorReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${date}-${random}`;
}

/**
 * Log error with context (preparation for error tracking service)
 * In production, this would send to Sentry/LogRocket/etc.
 */
export function logError(
  error: Error,
  context?: {
    userId?: string;
    storeId?: string;
    url?: string;
    action?: string;
    errorRef?: string;
  }
): void {
  const classifiedError = classifyError(error);
  const errorRef = context?.errorRef || generateErrorReference();

  // In development, log to console
  // In production, this would go to an error tracking service
  console.error("[Error]", {
    ref: errorRef,
    code: classifiedError.code,
    category: classifiedError.category,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get user-friendly error message with optional reference
 */
export function getUserErrorMessage(
  error: Error,
  includeReference = false
): { message: string; reference?: string; retryable: boolean } {
  const classifiedError = classifyError(error);
  const reference = includeReference ? generateErrorReference() : undefined;

  if (reference) {
    logError(error, { errorRef: reference });
  }

  return {
    message: classifiedError.message,
    reference,
    retryable: classifiedError.retryable,
  };
}
