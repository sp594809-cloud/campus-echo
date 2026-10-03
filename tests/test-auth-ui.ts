// Rendering fixture only. Production uses Supabase Auth and never imports this file.
export function useAuth() { return { userId: 'alice', isSignedIn: true, isLoaded: true, getToken: async () => 'fixture-token' }; }

export async function signOut() {}
