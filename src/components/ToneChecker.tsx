"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ToneSuggestion } from "./ToneSuggestion";
import { Textarea } from "@/components/ui/textarea";
import { useLogging } from "@/hooks/useLogging"; //ログ保存機能

interface ToneAnalysis {
  hasIssues: boolean;
  originalText: string;
  suggestion: string | null;
  issues: string[];
  reasoning: string;
  ai_receipt?: string;
  improvement_points?: string;
}

interface ToneCheckerProps {
  isJapanese: boolean;
}

export function ToneChecker({ isJapanese }: ToneCheckerProps) {
  const [text, setText] = useState("");
  const { log } = useLogging(isJapanese ? "ja" : "en"); // log保存用
  const [context, setContext] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<ToneAnalysis | null>(null);
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const [originalText, setOriginalText] = useState(""); // 元のテキストを保存
  const [hasAcceptedSuggestion, setHasAcceptedSuggestion] = useState(false); // 提案を受け入れたかどうか
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

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
        const sentenceStarts = Array.from(beforeCursor.matchAll(/[.!?]\s+/g));
        const sentenceStart =
          sentenceStarts.length > 0
            ? sentenceStarts[sentenceStarts.length - 1].index +
              sentenceStarts[sentenceStarts.length - 1][0].length
            : 0;

        // Find sentence end (next . ! ? or end of text)
        const sentenceEndMatch = afterCursor.match(/[.!?]/);
        const sentenceEnd =
          sentenceEndMatch && sentenceEndMatch.index !== undefined
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
        return;
      }
      // Get only the newly typed content for analysis
      const newContent = getNewlyTypedText(textToAnalyze, lastAnalyzedText);
      console.log("Analyzing text:", newContent); // デバッグ用

      if (!newContent.trim() || newContent.length < 10) {
        console.log("Text too short, skipping analysis"); // デバッグ用
        return;
      }

      setIsAnalyzing(true);
      const startTime = Date.now(); // 処理時間計測用

      try {
        const response = await fetch("/api/check-tone", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: newContent,
            context: context,
            language: isJapanese ? "japanese" : "english",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to analyze text");
        }

        const analysis: ToneAnalysis = await response.json();
        console.log("API Response:", analysis); // デバッグ用

        // AI分析完了ログを記録
        await log("analysis_completed", {
          context: context,
          originalMessage: newContent,
          aiResponse: {
            hasIssues: analysis.hasIssues,
            ai_receipt: analysis.ai_receipt,
            improvement_points: analysis.improvement_points,
            suggestion: analysis.suggestion || undefined,
            reasoning: analysis.reasoning,
            issues: analysis.issues,
          },
          processingTime: Date.now() - startTime,
        });

        console.log(
          "hasIssues:",
          analysis.hasIssues,
          "suggestion:",
          analysis.suggestion
        ); // デバッグ用

        if (analysis.hasIssues && analysis.suggestion) {
          setSuggestion(analysis);
          console.log("Suggestion set!"); // デバッグ用
        } else {
          setSuggestion(null);
          console.log("No suggestion set"); // デバッグ用
        }

        setLastAnalyzedText(textToAnalyze);
      } catch (error) {
        console.error("Error analyzing text:", error);
        setSuggestion(null);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [lastAnalyzedText, getNewlyTypedText, context, isJapanese, log]
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
  const acceptSuggestion = async () => {
    if (suggestion?.suggestion) {
      // 元のテキストを保存
      setOriginalText(text);
      // Replace the problematic part with the suggestion
      const newContent = getNewlyTypedText(text, lastAnalyzedText);
      const newText = text.replace(newContent, suggestion.suggestion);
      setText(newText);
      setLastAnalyzedText(newText);
      setHasAcceptedSuggestion(true);
      // setSuggestion(null); // 提案を消さない
      textareaRef.current?.focus();

      // ログ記録
      await log("suggestion_accepted", {
        action: "accept",
        previousText: text,
        newText: newText,
      });
    }
  };

  // Revert to original text
  const revertToOriginal = async () => {
    if (originalText) {
      setText(originalText);
      setLastAnalyzedText(originalText);
      setHasAcceptedSuggestion(false);
      setOriginalText("");
      textareaRef.current?.focus();

      // ログ記録
      await log("suggestion_rejected", {
        action: "reject",
        previousText: text,
        newText: originalText,
      });
    }
  };

  // Dismiss suggestion
  const dismissSuggestion = () => {
    setSuggestion(null);
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

  const labels = {
    contextTitle: isJapanese
      ? "過去のやりとり・会話の履歴"
      : "Conversation Context",
    contextPlaceholder: isJapanese
      ? "よろしければ、Slack/Teamsから、これまでの会話履歴をここにコピー＆ペーストして、AIが文脈を理解を助けてください。(なくても動きます)"
      : "Paste your conversation history here so the AI can understand the context...",
    writeTitle: isJapanese
      ? "投稿予定のメッセージを書く"
      : "Write your message",
    writePlaceholder: isJapanese
      ? "ここに、これから相手に送ろうとしているメッセージを入力してください...。入力が進むと、自動的にAIの解析が始まります"
      : "Start typing your message here... We'll help you make it more professional and respectful.",
    analyzing: isJapanese ? "分析中..." : "Analyzing...",
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Responsive Grid Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 h-full min-h-0">
        {/* Context Input - Full width on mobile, left 1/3 on laptop+ */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col lg:col-span-1 min-h-0">
          {/* Context Header */}
          <div className="px-4 sm:px-5 py-2 sm:py-3 border-b border-purple-200 bg-purple-50 flex-shrink-0">
            <h3 className="text-sm sm:text-base font-semibold text-purple-800 tracking-wide">
              {labels.contextTitle}
            </h3>
          </div>

          {/* Context Text Area */}
          <div className="relative flex-1 flex flex-col min-h-0">
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={labels.contextPlaceholder}
              className="flex-1 resize-none border-0 rounded-none focus-visible:ring-2 focus-visible:ring-slack-blue text-xs sm:text-sm leading-relaxed h-full"
              style={{ fontFamily: "Inter, sans-serif" }}
            />
          </div>
        </div>

        {/* Right Side Container - Message Input and Suggestions stacked vertically */}
        <div className="lg:col-span-2 flex flex-col gap-3 sm:gap-4 min-h-0">
          {/* Message Input - Top of right side */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col flex-1 min-h-0">
            {/* Header */}
            <div className="px-4 sm:px-5 py-2 sm:py-3 border-b border-purple-200 bg-purple-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-semibold text-purple-800 tracking-wide">
                  {labels.writeTitle}
                </h3>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  {isAnalyzing && (
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs sm:text-sm font-medium text-purple-700">
                        {labels.analyzing}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Text Area */}
            <div className="relative flex-1 flex flex-col min-h-0">
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={labels.writePlaceholder}
                className="flex-1 resize-none border-0 rounded-none focus-visible:ring-2 focus-visible:ring-slack-blue text-xs sm:text-sm leading-relaxed h-full"
                style={{ fontFamily: "Inter, sans-serif" }}
              />
            </div>
          </div>

          {/* Suggestion Box - Bottom of right side */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col flex-1 min-h-0">
            <div className="flex-1 flex flex-col min-h-0">
              {suggestion ? (
                <ToneSuggestion
                  suggestion={suggestion}
                  onAccept={() => acceptSuggestion()}
                  onDismiss={dismissSuggestion}
                  onRevert={() => revertToOriginal()}
                  hasAcceptedSuggestion={hasAcceptedSuggestion}
                  position={{ top: 0, left: 0 }}
                  isJapanese={isJapanese}
                  isEmbedded={true}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-slate-50 p-3 sm:p-4">
                  <p className="text-slate-500 text-sm sm:text-base font-medium text-center max-w-xs">
                    {isJapanese
                      ? "メッセージを入力すると、トーンの提案がここに表示されます"
                      : "Tone suggestions will appear here as you type your message"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
