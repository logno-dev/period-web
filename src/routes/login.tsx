import { Title } from "@solidjs/meta";
import { useSubmission } from "@solidjs/router";
import { Show } from "solid-js";
import { useOAuthLogin } from "start-oauth";
import { formLogin } from "~/auth";
import { Discord } from "~/components/Icons";
import Header from "~/components/Header";

export default function Login() {
  const login = useOAuthLogin();

  return (
    <div style={{"background-color": "var(--bg-primary)", "min-height": "100vh"}}>
      <Title>Sign In</Title>
      <Header />
      <main class="p-8">
        <h1 
          class="text-center text-2xl font-bold mb-8"
          style={{"color": "var(--text-primary)"}}
        >
          Sign in
        </h1>
        <div class="space-y-6 font-medium">
          <PasswordLogin />
        <div class="flex items-center w-full text-xs">
          <span 
            class="flex-grow h-[1px]" 
            style={{"background-color": "var(--border-color)"}}
          />
          <span 
            class="flex-grow-0 mx-2"
            style={{"color": "var(--text-secondary)"}}
          >
            Or continue with
          </span>
          <span 
            class="flex-grow h-[1px]"
            style={{"background-color": "var(--border-color)"}}
          />
        </div>
        <a
          href={login("discord")}
          rel="external"
          class="group w-full px-3 py-2 border rounded-lg hover:bg-[#5865F2] hover:border-gray-300 focus:outline-none transition-colors duration-300 flex items-center justify-center gap-2.5 hover:text-white"
          style={{
            "background-color": "var(--bg-primary)",
            "border-color": "var(--border-color)",
            "color": "var(--text-primary)"
          }}
        >
          <Discord class="h-5 fill-[#5865F2] group-hover:fill-white duration-300" />
          Sign in with Discord
        </a>
        </div>
      </main>
    </div>
  );
}

function PasswordLogin() {
  const submission = useSubmission(formLogin);

  return (
    <form action={formLogin} method="post" class="space-y-4 space-x-12">
      <label 
        for="email" 
        class="block text-left w-full"
        style={{"color": "var(--text-primary)"}}
      >
        Email
        <input
          id="email"
          name="email"
          type="email"
          autocomplete="email"
          placeholder="john@doe.com"
          required
          class="mt-1 block w-full px-4 py-2 border rounded-md transition-colors"
          style={{
            "background-color": "var(--input-bg)",
            "color": "var(--input-text)",
            "border-color": "var(--input-border)"
          }}
        />
      </label>
      <label 
        for="password" 
        class="block text-left w-full"
        style={{"color": "var(--text-primary)"}}
      >
        Password
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••"
          minLength={6}
          required
          class="mt-1 block w-full px-4 py-2 border rounded-md transition-colors"
          style={{
            "background-color": "var(--input-bg)",
            "color": "var(--input-text)",
            "border-color": "var(--input-border)"
          }}
        />
      </label>
      <button
        type="submit"
        disabled={submission.pending}
        class="w-full px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 shadow-lg"
        style={{
          "background": "linear-gradient(to right, #0ea5e9, #3b82f6)",
          "color": "white"
        }}
        onmouseover={(e) => {
          if (!submission.pending) {
            e.currentTarget.style.background = "linear-gradient(to right, #0284c7, #2563eb)";
          }
        }}
        onmouseout={(e) => {
          if (!submission.pending) {
            e.currentTarget.style.background = "linear-gradient(to right, #0ea5e9, #3b82f6)";
          }
        }}
      >
        Submit
      </button>
      <Show when={submission.error} keyed>
        {({ message }) => (
          <p 
            class="mt-2 text-xs text-center"
            style={{"color": "var(--error-color)"}}
          >
            {message}
          </p>
        )}
      </Show>
    </form>
  );
}
