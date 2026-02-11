import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "../../auth/server";
import { getUserMoodMarkers, createMoodMarker, deleteMoodMarker } from "../../db/moodMarkers";

export async function GET() {
  "use server";
  try {
    const session = await getSession();
    const user = session.data;

    if (!user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const markers = await getUserMoodMarkers(user.id);
    return json({ markers });
  } catch (error: any) {
    console.error("Error fetching mood markers:", error);
    return json({ error: "Failed to fetch mood markers", details: error?.message || String(error) }, { status: 500 });
  }
}

export async function POST({ request }: APIEvent) {
  "use server";
  try {
    const session = await getSession();
    const user = session.data;

    if (!user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { date, mood } = body;

    if (!date || !mood) {
      return json({ error: "Date and mood are required" }, { status: 400 });
    }

    const marker = await createMoodMarker(user.id, date, mood);
    return json({ marker });
  } catch (error) {
    console.error("Error creating mood marker:", error);
    return json({ error: "Failed to create mood marker" }, { status: 500 });
  }
}

export async function DELETE({ request }: APIEvent) {
  "use server";
  try {
    const session = await getSession();
    const user = session.data;

    if (!user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const markerId = url.searchParams.get("id");

    if (!markerId) {
      return json({ error: "Mood marker ID is required" }, { status: 400 });
    }

    const success = await deleteMoodMarker(markerId, user.id);

    if (!success) {
      return json({ error: "Mood marker not found" }, { status: 404 });
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error deleting mood marker:", error);
    return json({ error: "Failed to delete mood marker" }, { status: 500 });
  }
}
