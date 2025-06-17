"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ToneSuggestion } from "./ToneSuggestion";

interface ToneAnalysis {
  hasIssues: boolean;
  originalText: string;
  suggestion: string | null;
  issues: string[];
  reasoning: string;
}

export function ToneChecker() {
  const [text, setText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<ToneAnalysis | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Calculate cursor position in textarea
  const calculateCursorPosition = useCallback(() => {
    if (!textareaRef.current) return { top: 0, left: 0 };

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;

    // Simple approximation based on character position
    const lineHeight = 24; // Approximate line height
    const charWidth = 8; // Approximate character width
    const padding = 24; // textarea padding

    // Calculate approximate line and column
    const textBeforeCursor = text.substring(0, cursorPos);
    const lines = textBeforeCursor.split("\n");
    const currentLine = lines.length - 1;
    const currentColumn = lines[lines.length - 1].length;

    // Calculate position
    const top = currentLine * lineHeight + padding;
    const left = Math.min(
      currentColumn * charWidth + padding,
      textarea.offsetWidth - 300
    );

    return { top, left };
  }, [text]);

  // Get newly added text for analysis with better sentence detection
  const getNewlyTypedText = useCallback(
    (currentText: string, previousText: string) => {
      if (!previousText || currentText.length <= previousText.length) {
        // If it's the first time or text was deleted, analyze last sentence
        const cursorPos =
          textareaRef.current?.selectionStart || currentText.length;
        const textBeforeCursor = currentText.substring(0, cursorPos);

        // Find the last complete sentence
        const sentences = textBeforeCursor
          .split(/[.!?]+/)
          .filter((s) => s.trim().length > 0);
        if (sentences.length > 0) {
          return sentences[sentences.length - 1].trim();
        }
        return currentText.length > 50
          ? currentText.substring(0, 50)
          : currentText;
      }

      // Find the newly added portion
      const newText = currentText.substring(previousText.length);

      // If just a few characters were added, analyze the current sentence/phrase
      if (newText.trim().length < 10) {
        const cursorPos =
          textareaRef.current?.selectionStart || currentText.length;

        // Look for sentence boundaries around the cursor
        const beforeCursor = currentText.substring(0, cursorPos);
        const afterCursor = currentText.substring(cursorPos);

        // Find sentence start (look for . ! ? followed by space, or start of text)
        const sentenceStarts = [...beforeCursor.matchAll(/[.!?]\s+/g)];
        const sentenceStart =
          sentenceStarts.length > 0
            ? sentenceStarts[sentenceStarts.length - 1].index +
              sentenceStarts[sentenceStarts.length - 1][0].length
            : 0;

        // Find sentence end (next . ! ? or end of text)
        const sentenceEndMatch = afterCursor.match(/[.!?]/);
        const sentenceEnd = sentenceEndMatch
          ? cursorPos + sentenceEndMatch.index + 1
          : currentText.length;

        const sentence = currentText
          .substring(sentenceStart, sentenceEnd)
          .trim();
        return sentence.length > 10 ? sentence : newText;
      }

      // For longer additions, include some context
      const contextStart = Math.max(0, previousText.length - 30);
      return currentText.substring(contextStart);
    },
    []
  );

  // Debounced analysis function with smart text detection
  const analyzeText = useCallback(
    async (textToAnalyze: string) => {
      if (!textToAnalyze.trim() || textToAnalyze.length < 10) {
        setSuggestion(null);
        setShowSuggestion(false);
        return;
      }

      // Get only the newly typed content for analysis
      const newContent = getNewlyTypedText(textToAnalyze, lastAnalyzedText);

      if (!newContent.trim() || newContent.length < 10) {
        return;
      }

      setIsAnalyzing(true);

      try {
        const response = await fetch("/api/check-tone", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: newContent }),
        });

        if (!response.ok) {
          throw new Error("Failed to analyze text");
        }

        const analysis: ToneAnalysis = await response.json();

        if (analysis.hasIssues && analysis.suggestion) {
          // Calculate cursor position when showing suggestion
          const position = calculateCursorPosition();
          setCursorPosition(position);
          setSuggestion(analysis);
          setShowSuggestion(true);
        } else {
          setSuggestion(null);
          setShowSuggestion(false);
        }

        setLastAnalyzedText(textToAnalyze);
      } catch (error) {
        console.error("Error analyzing text:", error);
        setSuggestion(null);
        setShowSuggestion(false);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [lastAnalyzedText, getNewlyTypedText, calculateCursorPosition]
  );

  // Handle text change with debouncing
  const handleTextChange = (value: string) => {
    setText(value);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for analysis
    timeoutRef.current = setTimeout(() => {
      analyzeText(value);
    }, 1000); // 1 second delay
  };

  // Accept suggestion
  const acceptSuggestion = () => {
    if (suggestion?.suggestion) {
      // Replace the problematic part with the suggestion
      const newContent = getNewlyTypedText(text, lastAnalyzedText);
      const newText = text.replace(newContent, suggestion.suggestion);
      setText(newText);
      setLastAnalyzedText(newText);
      setSuggestion(null);
      setShowSuggestion(false);
      textareaRef.current?.focus();
    }
  };

  // Dismiss suggestion
  const dismissSuggestion = () => {
    setSuggestion(null);
    setShowSuggestion(false);
    // Mark current text as analyzed to avoid re-analyzing
    setLastAnalyzedText(text);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="relative max-w-4xl mx-auto">
        <div className="bg-spotify-lightgray rounded-2xl shadow-spotify-lg overflow-hidden border border-gray-800">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 bg-spotify-darkgray">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-spotify-white">
                Write your message
              </h2>
              <div className="flex items-center space-x-2">
                {isAnalyzing && (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-spotify-green border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-spotify-gray">
                      Analyzing...
                    </span>
                  </div>
                )}
                <div className="text-sm text-spotify-gray">
                  {text.length} characters
                </div>
              </div>
            </div>
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Start typing your message here... We'll help you make it more professional and respectful."
              className="w-full h-96 p-6 bg-transparent text-spotify-white placeholder-spotify-gray resize-none focus:outline-none text-lg leading-relaxed"
              style={{ fontFamily: "Inter, sans-serif" }}
            />

            {/* Word count and tips */}
            <div className="absolute bottom-4 left-6 text-sm text-spotify-gray">
              {text.split(" ").filter((word) => word.length > 0).length} words
            </div>

            {/* Suggestion Popup - Positioned right next to the text area like Grammarly */}
            {showSuggestion && suggestion && (
              <ToneSuggestion
                suggestion={suggestion}
                onAccept={acceptSuggestion}
                onDismiss={dismissSuggestion}
                position={cursorPosition}
              />
            )}
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 text-center">
        <p className="text-spotify-gray text-sm max-w-2xl mx-auto">
          ToneCheck analyzes your writing in real-time and suggests improvements
          for tone, professionalism, and clarity. Write naturally and we'll help
          you communicate more effectively.
        </p>
      </div>

      {/* Examples */}
      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="bg-spotify-lightgray rounded-xl p-6 border border-gray-800">
          <h3 className="text-spotify-white font-semibold mb-3 flex items-center">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
            Needs Improvement
          </h3>
          <p className="text-spotify-gray text-sm leading-relaxed">
            "You need to fix this immediately. This is completely wrong and
            unacceptable."
          </p>
        </div>

        <div className="bg-spotify-lightgray rounded-xl p-6 border border-gray-800">
          <h3 className="text-spotify-white font-semibold mb-3 flex items-center">
            <span className="w-2 h-2 bg-spotify-green rounded-full mr-3"></span>
            Professional Tone
          </h3>
          <p className="text-spotify-gray text-sm leading-relaxed">
            "I'd like to discuss some concerns about this approach. Could we
            schedule time to review the requirements together?"
          </p>
        </div>
      </div>
    </>
  );
}
