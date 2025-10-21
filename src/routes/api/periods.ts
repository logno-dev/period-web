import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "../../auth/server";
import { getUserPeriods, createPeriod, updatePeriod, deletePeriod } from "../../db/periods";

export async function GET() {
  "use server";
  try {
    console.log("GET /api/periods - Starting");
    const session = await getSession();
    console.log("Session data:", session.data);
    const user = session.data;
    
    if (!user?.id) {
      console.log("No user ID found, returning unauthorized");
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Fetching periods for user:", user.id);
    const periods = await getUserPeriods(user.id);
    console.log("Periods fetched:", periods.length, periods);
    console.log("Returning JSON response");
    return json({ periods });
  } catch (error: any) {
    console.error("Error fetching periods:", error);
    return json({ error: "Failed to fetch periods", details: error?.message || String(error) }, { status: 500 });
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
    const { startDate, endDate } = body;

    if (!startDate) {
      return json({ error: "Start date is required" }, { status: 400 });
    }

    const period = await createPeriod(user.id, startDate, endDate);
    return json({ period });
  } catch (error) {
    console.error("Error creating period:", error);
    return json({ error: "Failed to create period" }, { status: 500 });
  }
}

export async function PUT({ request }: APIEvent) {
  "use server";
  try {
    const session = await getSession();
    const user = session.data;
    
    if (!user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, startDate, endDate } = body;

    if (!id) {
      return json({ error: "Period ID is required" }, { status: 400 });
    }

    const updates: { startDate?: string; endDate?: string | null } = {};
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;

    const period = await updatePeriod(id, user.id, updates);
    
    if (!period) {
      return json({ error: "Period not found" }, { status: 404 });
    }

    return json({ period });
  } catch (error) {
    console.error("Error updating period:", error);
    return json({ error: "Failed to update period" }, { status: 500 });
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
    const periodId = url.searchParams.get("id");

    if (!periodId) {
      return json({ error: "Period ID is required" }, { status: 400 });
    }

    const success = await deletePeriod(periodId, user.id);
    
    if (!success) {
      return json({ error: "Period not found" }, { status: 404 });
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error deleting period:", error);
    return json({ error: "Failed to delete period" }, { status: 500 });
  }
}