/**
 * Authentication & Authorization Types
 */

export type UserRole = 'admin' | 'engineer' | 'viewer';
export type AuthProvider = 'email' | 'google' | 'github' | 'saml' | 'oidc';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: UserRole;
  workspace_id: string;
  auth_provider: AuthProvider;
  preferences: UserPreferencesStore;
  created_at: string;
  last_login_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: 'free' | 'professional' | 'enterprise';
  settings: WorkspaceSettings;
  members: WorkspaceMember[];
  created_at: string;
}

export interface WorkspaceMember {
  user_id: string;
  role: UserRole;
  invited_at: string;
  joined_at?: string;
}

export interface WorkspaceSettings {
  default_cloud: string;
  allowed_clouds: string[];
  budget_limit_usd: number;
  require_approval_for_production: boolean;
  allowed_regions: string[];
  data_residency_region?: string;
  sso_enabled: boolean;
  sso_config?: SSOConfig;
}

export interface SSOConfig {
  provider: 'saml' | 'oidc';
  issuer_url: string;
  client_id: string;
  client_secret_ref: string; // reference to secrets manager
  allowed_domains: string[];
}

export interface UserPreferencesStore {
  theme: 'light' | 'dark' | 'system';
  font_size: 'small' | 'medium' | 'large';
  code_theme: string;
  show_thinking: boolean;
  show_token_usage: boolean;
  default_cloud: string;
  keyboard_shortcuts: boolean;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email_on_pipeline_failure: boolean;
  email_on_approval_request: boolean;
  slack_webhook?: string;
  browser_notifications: boolean;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}
