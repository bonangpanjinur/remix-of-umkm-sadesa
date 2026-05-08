// Lovable-specific OAuth integration stub for Replit environment.
// Google/Apple/Microsoft OAuth is handled via Supabase directly.

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: "google" | "apple" | "microsoft", _opts?: { redirect_uri?: string; extraParams?: Record<string, string> }) => {
      return { error: new Error("Social OAuth not configured. Please use email/password login.") };
    },
  },
};
