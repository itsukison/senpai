"use server"
import { createSupabaseClient } from "./supbase";

interface ConvoInput {
    input: string;
    feedback: string;
    hierarchy: string;
    social_distance: string;
    language: string;
    thread_context: string;
    issue_pattern: string[];
    has_issue: boolean;
    improvement_points: string;
    detailed_analysis: string;
}

// Test function to verify Supabase connection
export const testSupabaseConnection = async() => {
    try {
        const supabase = createSupabaseClient();
        
        // Check if environment variables are set
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            throw new Error("Missing Supabase environment variables");
        }
        
        console.log("✅ Supabase URL configured:", process.env.NEXT_PUBLIC_SUPABASE_URL);
        console.log("✅ Supabase Key configured:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Yes" : "No");
        
        // Test connection by trying to read from the history table
        const { data, error } = await supabase
            .from("history")
            .select("*")
            .limit(1);
            
        if (error) {
            console.error("❌ Supabase connection test failed:", error);
            throw error;
        }
        
        console.log("✅ Supabase connection test successful");
        
        // Check table structure by looking at the first row (if exists)
        if (data && data.length > 0) {
            console.log("📋 Existing table columns:", Object.keys(data[0]));
        } else {
            console.log("📋 Table exists but is empty - unable to check column structure");
        }
        
        return { success: true, message: "Connection successful" };
    } catch (error) {
        console.error("❌ Supabase connection test failed:", error);
        return { success: false, error: error };
    }
}

export const createConvo = async(data: ConvoInput) => {
    try {
        const supabase = createSupabaseClient();

        const { data: result, error } = await supabase
        .from("history")
        .insert({
            input: data.input,
            feedback: data.feedback,
            hierarchy: data.hierarchy,
            social_distance: data.social_distance,
            language: data.language,
            thread_context: data.thread_context,
            issue_pattern: data.issue_pattern,
            has_issue: data.has_issue,
            improvement_points: data.improvement_points,
            detailed_analysis: data.detailed_analysis
        })
        .select()

        if(error) {
            console.error("Supabase insert error:", error);
            throw new Error(`Database error: ${error.message}`);
        }

        console.log("Successfully saved to Supabase:", result);
        return result[0];
    } catch (error) {
        console.error("Error in createConvo:", error);
        // Re-throw the error so it can be properly handled
        throw error;
    }
}