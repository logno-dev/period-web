import { type RouteDefinition, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { MetaProvider } from "@solidjs/meta";
import { Suspense } from "solid-js";
import { querySession } from "./auth";
import Auth from "./components/Context";
import { ThemeProvider } from "./contexts/ThemeContext";
// import Nav from "./components/Nav"; // Temporarily disabled to fix hydration mismatch
import ErrorNotification from "./components/Error";
import "./app.css";

export const route: RouteDefinition = {
  preload: ({ location }) => querySession(location.pathname)
};

export default function App() {
  return (
    <Router
      root={props => (
        <MetaProvider>
          <ThemeProvider>
            <Auth>
              <Suspense>
                {/* <Nav /> Temporarily commented out to fix hydration mismatch */}
                {props.children}
                <ErrorNotification />
              </Suspense>
            </Auth>
          </ThemeProvider>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
