export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Push notifications not configured'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    publicKey
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
