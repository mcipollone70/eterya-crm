/** Auth module — login, registrazione, RBAC. */
export const AUTH_MODULE = "auth" as const;

export { authenticateAction, signOutAction, type AuthFormState } from "./actions/auth";
export { getCurrentUser, getCurrentUserProfile } from "./session";
export type { AppUserProfile } from "./types";
