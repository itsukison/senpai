"use server"
import { createSupabaseClient } from "./supbase";

interface ConvoInput {
    input: string;
    feedback: string;
}

export const createConvo = async({ input, feedback }: ConvoInput) => {
    try {
        const supabase = createSupabaseClient();

        const { data, error } = await supabase
        .from("history")
        .insert({ input, feedback })
        .select()

        if(error) {
            console.error("Supabase insert error:", error);
            throw new Error(`Database error: ${error.message}`);
        }

        console.log("Successfully saved to Supabase:", data[0]);
        return data[0];
    } catch (error) {
        console.error("Error in createConvo:", error);
        // Don't throw the error to prevent the app from crashing
        // Just log it for debugging purposes
        return null;
    }
}