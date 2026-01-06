import { createAsync, useLocation, type AccessorWithLatest } from "@solidjs/router";
import { createContext, useContext, createEffect, type ParentProps } from "solid-js";
import { logout, querySession } from "../auth";
import type { Session } from "../auth/server";

const Context = createContext<{
  session: AccessorWithLatest<Session | null | undefined>;
  signedIn: () => boolean;
  logout: typeof logout;
}>();

export default function Auth(props: ParentProps) {
  const location = useLocation();
  const session = createAsync(() => querySession(location.pathname), {
    deferStream: true
  });
  const signedIn = () => Boolean(session()?.id);

  // Auto-detect and initialize timezone on first login
  createEffect(() => {
    const currentSession = session();
    if (currentSession?.id && typeof window !== 'undefined') {
      // Check if we've already initialized timezone for this session
      const timezoneInitKey = `timezone_init_${currentSession.id}`;
      const alreadyInitialized = sessionStorage.getItem(timezoneInitKey);
      
      if (!alreadyInitialized) {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        fetch('/api/init-timezone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone: detectedTimezone })
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              sessionStorage.setItem(timezoneInitKey, 'true');
              if (data.updated) {
                console.log('Timezone auto-detected and set to:', detectedTimezone);
              }
            }
          })
          .catch(error => {
            console.error('Failed to initialize timezone:', error);
          });
      }
    }
  });

  return (
    <Context.Provider value={{ session, signedIn, logout }}>{props.children}</Context.Provider>
  );
}

export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("useAuth must be used within Auth context");
  return context;
}
