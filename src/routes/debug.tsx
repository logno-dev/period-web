import { Title } from "@solidjs/meta";
import { createSignal, onMount, Show } from "solid-js";
import { useAuth } from "~/components/Context";

export default function Debug() {
  const { session } = useAuth();
  const [loading, setLoading] = createSignal(true);
  const [periods, setPeriods] = createSignal([]);
  const [error, setError] = createSignal<string | null>(null);

  const loadData = async () => {
    try {
      console.log('Debug: Starting load...');
      const response = await fetch('/api/periods');
      console.log('Debug: Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Debug: Data received:', data);
        setPeriods(data.periods || []);
      } else {
        const errorData = await response.json();
        console.log('Debug: Error response:', errorData);
        setError(`API Error: ${errorData.error}`);
      }
    } catch (err: any) {
      console.log('Debug: Fetch error:', err);
      setError(`Fetch Error: ${err.message}`);
    } finally {
      console.log('Debug: Setting loading to false');
      setLoading(false);
    }
  };

  onMount(() => {
    console.log('Debug: Component mounted');
    loadData();
  });

  return (
    <main class="p-8">
      <Title>Debug - Period Tracker</Title>
      
      <h1 class="text-2xl font-bold mb-4">Debug Page</h1>
      
      <div class="space-y-4">
        <div>
          <strong>User:</strong> {session()?.email || 'Not logged in'}
        </div>
        
        <div>
          <strong>Loading:</strong> {loading() ? 'YES' : 'NO'}
        </div>
        
        <Show when={error()}>
          <div class="text-red-600">
            <strong>Error:</strong> {error()}
          </div>
        </Show>
        
        <div>
          <strong>Periods Count:</strong> {periods().length}
        </div>
        
        <div>
          <strong>Periods Data:</strong>
          <pre class="bg-gray-100 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(periods(), null, 2)}
          </pre>
        </div>
      </div>
    </main>
  );
}