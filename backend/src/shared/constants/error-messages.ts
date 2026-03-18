export const ERROR_MESSAGES = {
  // Auth & Account
  INVALID_EMAIL_FORMAT:
    "Please enter a valid email address (e.g., user@example.com)",
  EMAIL_ALREADY_EXISTS:
    "This email is already registered. Please log in instead.",
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  USER_NOT_FOUND: "Email not registered. Please sign up first.",
  PASSWORD_MISMATCH: "Passwords do not match.",
  WEAK_PASSWORD: "Password must be at least 8 characters long.",

  // Studio & Access
  NOT_STUDIO_MEMBER: "You do not have access to this studio.",
  STUDIO_NOT_FOUND: "Studio not found or has been deleted.",
  STUDIO_NAME_ALREADY_EXISTS:
    "This studio name is already in use. Please choose a different studio name.",
  ACCESS_DENIED: "You do not have permission to perform this action.",

  // Personal Accounts
  PERSONAL_ACCOUNT_NOT_FOUND: "Personal account not found.",
  PERSONAL_ACCOUNT_EXISTS: "A personal account with this email already exists.",

  // Wallet & Assets
  WALLET_NOT_FOUND: "Wallet not found or invalid address.",
  INSUFFICIENT_BALANCE: "Insufficient balance to complete this transaction.",
  RPC_UNAVAILABLE:
    "Blockchain service is temporarily unavailable. Please try again later.",
  INVALID_WALLET_ADDRESS: "Invalid wallet address format.",

  // Game & Platform
  GAME_NOT_FOUND: "Game not found or access denied.",
  ASSET_NOT_FOUND: "Asset not found.",

  // Server & Internal
  MISSING_ENV_VAR: (varName: string) =>
    `Missing required configuration: ${varName}`,
  ENCRYPTION_ERROR: "An encryption error occurred. Please try again.",
  DATABASE_ERROR: "A database error occurred. Please try again later.",
  INTERNAL_SERVER_ERROR:
    "An unexpected error occurred. Please try again later.",

  // Validation
  VALIDATION_ERROR: (field: string) =>
    `Invalid ${field}. Please check and try again.`,
  MISSING_REQUIRED_FIELD: (field: string) => `${field} is required.`,
};
