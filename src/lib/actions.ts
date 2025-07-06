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
    has_issues: boolean;
    ai_receipt: string;
    improvement_points: string;
    detailed_analysis: string;
    reasoning: string;
    detected_mentions: string[];
    timestamp: string;
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
            has_issues: data.has_issues,
            ai_receipt: data.ai_receipt,
            improvement_points: data.improvement_points,
            detailed_analysis: data.detailed_analysis,
        })
        .select()

        if(error) {
            console.error("Supabase insert error:", error);
            throw new Error(`Database error: ${error.message}`);
        }

        console.log("Successfully saved to Supabase:", result[0]);
        return result[0];
    } catch (error) {
        console.error("Error in createConvo:", error);
        // Don't throw the error to prevent the app from crashing
        // Just log it for debugging purposes
        return null;
    }
}