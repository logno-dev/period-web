import { Title } from "@solidjs/meta";
import { useSubmission } from "@solidjs/router";
import { Show } from "solid-js";
import { formLogin } from "~/auth";
import Header from "~/components/Header";

export default function Login() {
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
