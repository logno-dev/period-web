import { json } from "@solidjs/router";
import { db } from "../../db/index";

export async function GET() {
  "use server";
  try {
    console.log("Testing database connection...");
    
    // Try to query the users table
    const result = await db.query.users?.findMany?.() || [];
    console.log("Database test successful, users found:", result.length);
    
    return json({ 
      success: true, 
      message: "Database connection successful",
      userCount: result.length 
    });
  } catch (error: any) {
    console.error("Database test failed:", error);
    return json({ 
      success: false, 
      error: "Database connection failed", 
      details: error?.message || String(error) 
    }, { status: 500 });
  }
}