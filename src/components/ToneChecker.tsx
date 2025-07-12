"use client";

import { useState, useRef, useEffect, useCallback } from "react";
// import { ToneSuggestion } from "./ToneSuggestion";
import { MessageEditor } from "./MessageEditor";
import { Textarea } from "@/components/ui/textarea";
import { useLogging } from "@/hooks/useLogging"; //ログ保存機能
import { createConvo } from "@/lib/actions";
import { ChevronDown, ChevronUp } from "lucide-react";

// 変更後
interface ToneAnalysis {
  hasIssues: boolean;
  // originalText: string; // APIから削除
  suggestion: string | null;
  reasoning: string;
  ai_receipt?: string;
  improvement_points?: string;
  detailed_analysis?: string;    // 新規追加
  issue_pattern?: string[];
  detected_mentions?: string[];
}

interface ToneCheckerProps {
  isJapanese: boolean;
  promptVersion: string;  // 文字列型に変更して柔軟性を持たせる
}

export function ToneChecker({ isJapanese, promptVersion }: ToneCheckerProps) {
  const [userDraft, setUserDraft] = useState("");
  const { log } = useLogging(isJapanese ? "ja" : "en"); // log保存用
  const [threadContext, setThreadContext] = useState("");
  const [analysisState, setAnalysisState] = useState<'ready' | 'analyzing' | 'analyzed'>('ready');
  const [suggestion, setSuggestion] = useState<ToneAnalysis | null>(null);
  const [originalText, setOriginalText] = useState(""); // 元のテキストを保存
  const [hasAcceptedSuggestion, setHasAcceptedSuggestion] = useState(false); // 提案を受け入れたかどうか
  const [acceptedSuggestionText, setAcceptedSuggestionText] = useState(""); // 反映した提案のテキスト
  const [isTransitioning, setIsTransitioning] = useState(false); // アニメーション状態
  const [showSuggestionArea, setShowSuggestionArea] = useState(false); // 提案エリアの表示状態
  const [externalChanges, setExternalChanges] = useState(false); // 外部変更フラグ
  const [animationPhase, setAnimationPhase] = useState<'input' | 'transitioning' | 'suggestion'>('input'); // アニメーションフェーズ
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const animationTimersRef = useRef<NodeJS.Timeout[]>([]); // アニメーションタイマーの管理
  const [isFirstAnalysis, setIsFirstAnalysis] = useState(true); // 初回解析かどうか
  const [isReanalyzing, setIsReanalyzing] = useState(false); // 再解析中かどうか
  const [displayText, setDisplayText] = useState<string>(''); // 表示用テキスト（ランダムアニメーション用）
  const [isShowingRandomText, setIsShowingRandomText] = useState(false); // ランダムテキスト表示中
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false); // 詳細分析の表示状態
  const [showRandomTextFlag, setShowRandomTextFlag] = useState(false); // ランダムテキスト開始フラグ
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // エラーメッセージ
  const [hasReceivedResponse, setHasReceivedResponse] = useState(false); // API応答受信フラグ
  const [isContextOpen, setIsContextOpen] = useState(false); // Context Inputの開閉状態（モバイル・タブレット用）
  
  // Phase 4 追加: 解析中テキスト管理
  const [analysisPhaseText, setAnalysisPhaseText] = useState({
    ai_receipt: '',
    improvement_points: ''
  });
  const [currentAnalysisPhase, setCurrentAnalysisPhase] = useState<'relationship' | 'analyzing' | 'finalizing' | null>(null);
  
  // Phase 3 追加: 解析完了フラグ
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  
  // Phase 3 追加: テキストエリアの最大高さ管理
  const [maxTextAreaHeight, setMaxTextAreaHeight] = useState<number | null>(null);
  
  // Phase 3 追加: 編集モード管理（PC版の位置調整用）
  const [isEditingMode, setIsEditingMode] = useState(false);
  
  // ========== トグル機能の状態管理 ==========
  // ユーザーストーリー：
  // 1. AIの提案が良い場合 → そのまま提案を編集して完成
  // 2. AIの提案がイマイチな場合 → 元文章に戻って、元文章を編集して完成
  // どちらのパスでも、編集内容を保持しつつ、再解析も可能にする
  const [isShowingOriginal, setIsShowingOriginal] = useState(false); // true: 元文章を表示中, false: AI提案を表示中
  const [editedOriginalText, setEditedOriginalText] = useState<string>(""); // 元文章に戻った時の編集内容を保持
  
  // Phase 3 ハイブリッドアプローチ: 提案の編集を明示的に管理
  const [editedSuggestionText, setEditedSuggestionText] = useState<string>(""); // AI提案を編集した内容を保持
  
  // 編集済みフラグ
  const [hasEditedOriginal, setHasEditedOriginal] = useState(false);
  const [hasEditedSuggestion, setHasEditedSuggestion] = useState(false);

  // 関係性セレクター用のstate
  const [hierarchy, setHierarchy] = useState('peer');
  const [social_distance, setSocialDistance] = useState('neutral');
  
  // Phase 4 定数定義
  const DISTANCE_ADJECTIVES: Record<string, string> = {
    'very_close': 'かなり近しい',
    'close': '仲間感のある',
    'neutral': '一般的な職場の',
    'distant': '少し距離感のある',
    'very_distant': 'かなり遠いご関係の'
  };

  const HIERARCHY_NOUNS: Record<string, string> = {
    'junior': '相手のかた',
    'peer': 'かた', 
    'senior': '目上のかた'
  };

  const ANALYSIS_MESSAGES = {
    phase2: {
      ai_receipt: [
        "このメッセージで達成したい目的を分析しています",
        "ビジネスゴールと人間関係の両立を検討しています"
      ],
      improvement_points: [
        "改善ポイントを抽出しています",
        "相手の視点から検証しています"
      ]
    },
    phase3: {
      ai_receipt: [
        "あなたの状況を深く理解し、最適な表現を調整しています",
        "相手の立場に立って、メッセージの受け取られ方を検証しています", 
        "プロフェッショナルかつ温かみのある表現に仕上げています"
      ],
      improvement_points: [
        "関係性を大切にしながら、目的を達成する方法を最終化しています",
        "誤解なく、スムーズに伝わる表現に磨き上げています",
        "このコミュニケーションが生み出す価値を最大化しています"
      ]
    }
  };

  // 文字数による調整
  const LENGTH_BASED_MESSAGES = {
    short: { // 30字以下
      phase2: "簡潔なメッセージから意図を読み取っています",
      phase3: "短い言葉に込められた想いを大切にしています"
    },
    medium: { // 30-200字
      phase2: "メッセージの構造を整理しています",
      phase3: "バランスの取れた表現に調整しています"
    },
    long: { // 200字以上
      phase2: "詳細な内容から要点を抽出しています",
      phase3: "情報を整理して伝わりやすくしています"
    }
  };
  
  // 解析時の元文章を保持（originalText削除に伴う対応）
  const [analyzedOriginalText, setAnalyzedOriginalText] = useState<string>("");
  

// 合計文字数を取得
  const getTotalTextLength = () => {
    return threadContext.trim().length + userDraft.trim().length;
  };

  // 解析可能かどうか
  const canAnalyze = getTotalTextLength() >= 8;

  // 文字列の編集距離を簡易的に計算
  const getEditDistance = (str1: string, str2: string): number => {
    const lengthDiff = Math.abs(str1.length - str2.length);
    const commonLength = Math.min(str1.length, str2.length);
    let differences = 0;
    
    for (let i = 0; i < commonLength; i++) {
      if (str1[i] !== str2[i]) differences++;
    }
    
    return lengthDiff + differences;
  };

  // 有意な変更があるかどうか
  const hasSignificantChange = () => {
    if (!hasAcceptedSuggestion || !acceptedSuggestionText) return true;
    
    const editDistance = getEditDistance(userDraft, acceptedSuggestionText);
    return editDistance > 5;
  };

  // Phase 3 ハイブリッドアプローチ: 表示するテキストを決定する関数
  // 画面に表示すべきテキストを一元的に管理し、複雑な条件分岐を整理
  const getDisplayTextForEditor = () => {
    // 入力モード（提案エリアが表示されていない）
    if (!showSuggestionArea) {
      return userDraft;
    }
    
    // 解析中はdisplayTextを信頼（ランダムアニメーション対応）
    if (analysisState === 'analyzing') {
      return displayText;
    }
    
    // 解析完了後の通常処理
    if (isShowingOriginal) {
      // 「←元文章に戻す」を押した状態
      return hasEditedOriginal ? editedOriginalText : analyzedOriginalText;
    } else {
      // AI提案を表示中
      return hasEditedSuggestion ? editedSuggestionText : (suggestion?.suggestion || "");
    }
  };

// Debounced analysis function - analyze full text
const analyzeText = useCallback(
  async () => {
    console.log("=== 解析開始 ===");
    console.log("合計文字数:", getTotalTextLength());
    console.log("user_draft:", userDraft);
    console.log("thread_context長さ:", threadContext.length);
    console.log("初回解析:", isFirstAnalysis);
    console.log("提案エリア表示中:", showSuggestionArea);
    
    if (!canAnalyze) {
      return;
    }

    // Phase 3: 解析完了フラグをリセット
    setIsAnalysisComplete(false);

    // 再解析かどうかを判定
    const isReanalysis = showSuggestionArea && suggestion !== null;
    setIsReanalyzing(isReanalysis);
    
    // 現在表示されているテキストを取得
    // Phase 3 修正: 編集された内容を正しく取得
    // ユーザーが編集した内容（元文章の編集 or 提案の編集）をAPIに送信
    const currentText = isReanalysis
      ? getDisplayTextForEditor()  // 既存の関数を活用して正確に取得
      : userDraft;  // 初回解析時は常にuserDraft
    
    console.log("=== 解析タイプ判定 ===");
    console.log("isFirstAnalysis:", isFirstAnalysis);
    console.log("showSuggestionArea:", showSuggestionArea);
    console.log("suggestion:", suggestion);
    console.log("isReanalysis:", isReanalysis);
    console.log("currentText:", currentText);  // デバッグ用

    if (isReanalysis) {
      // 再解析時：移動アニメーションなし、内容のフェードのみ
      setIsTransitioning(true);
      setExternalChanges(false);
      
      // 再解析時の元文章を更新
      setAnalyzedOriginalText(currentText);
      
      // Phase 4: 無効化前 再解析時は即座にランダムテキストを開始
      //setShowRandomTextFlag(true);
      //console.log("=== 再解析: showRandomTextFlag を true に設定 ===");
      
      // Phase 4: ランダムテキストは無効化
      console.log("=== 再解析: ランダムテキストは無効化 ===");

    } else {
      // Phase 4: ランダムテキストは無効化
      console.log("=== 初回解析: ランダムテキストは無効化 ===");
    }
    
    if (isReanalysis) {
      // Phase 3 追加: 編集状態を保持（再解析時のみ）
      // 再解析時は現在の編集内容を新しいオリジナルとして扱う
      // これにより、編集→再解析→編集のサイクルが可能になる
      if (!isShowingOriginal && hasEditedSuggestion) {
        // 提案を編集していた場合、その内容を新しいオリジナルとする
        setOriginalText(editedSuggestionText);
      } else if (isShowingOriginal && hasEditedOriginal) {
        // 元文章を編集していた場合、その内容を新しいオリジナルとする
        setOriginalText(editedOriginalText);
      }
    } else {
      // 初回解析時：フルアニメーション
      setAnimationPhase('transitioning');
      setIsTransitioning(true);
      setExternalChanges(false);
      
      // 即座に提案エリアを表示（移動開始）
      setShowSuggestionArea(true);
      
      console.log("=== タイマー設定開始 ===");
      console.log("現在のタイマー配列:", animationTimersRef.current);
      
      // アニメーション完了（1秒に修正）
      const mainTimer = setTimeout(() => {
        console.log("=== メインタイマー実行（1秒後） ===");
        console.log("タイマー内 - animationTimersRef.current:", animationTimersRef.current);
        
        setAnimationPhase('suggestion');
        setIsTransitioning(false);
        setIsFirstAnalysis(false);
      }, 1000); // CSS transitionと同期（1秒）
      
      animationTimersRef.current.push(mainTimer);
      
      console.log("=== タイマーID: mainTimer=", mainTimer);
      console.log("=== 保存されたタイマー数:", animationTimersRef.current.length);
      console.log("=== 保存されたタイマー配列:", animationTimersRef.current);
    }
    // モバイルの場合、スクロール調整（初回のみ）
    if (!isReanalysis && window.innerWidth < 768) {
      const scrollTimer = setTimeout(() => {
        // 提案エリア全体を探す（統合コンテナ内の提案部分）
        const suggestionHeader = document.querySelector('[class*="改善提案"], [class*="Improvement Suggestion"]')?.parentElement?.parentElement;
        if (suggestionHeader) {
          // ナビゲーションバーの高さを考慮して、少し余白を持たせる
          const yOffset = -80; // ナビゲーションバー分のオフセット
          const y = suggestionHeader.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 1200); // アニメーション完了後にスクロール
      animationTimersRef.current.push(scrollTimer);
    }
    
    // トグル状態のリセット
    setIsShowingOriginal(false);
    setEditedOriginalText("");
    
    // 解析開始時に空のsuggestionをセット（スケルトンUI表示用）
    // ただし、suggestionフィールドはnullのままにして、ランダムテキストの判定に影響しないようにする
    // Phase 3 修正: 再解析時は現在のテキストを保持
    if (!isReanalysis) {
      // 初回解析時の元文章を保存
      setAnalyzedOriginalText(userDraft);
      
      setSuggestion({
        hasIssues: true,  // デフォルトでtrueと仮定
        // originalText: userDraft, // 削除
        suggestion: null,  // 重要: nullのままにする
        reasoning: '',
        ai_receipt: '',
        improvement_points: '',
        detailed_analysis: '',
        issue_pattern: [],
        detected_mentions: []
      });
    }
    
    // displayTextも初期化
    // 画面には編集中のテキストを表示し続ける（ユーザーの編集内容が消えない）
    setDisplayText(isReanalysis ? currentText : userDraft);
    
    // ランダムテキストフラグをリセット（初回解析時のみ）
    if (!isReanalysis) {
      setShowRandomTextFlag(false);
    }
    setHasReceivedResponse(false);  // API応答フラグをリセット
    // エラーメッセージもリセット
    setErrorMessage(null);

    // 既存の解析をキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 既存のタイマーをクリア（初回・再解析どちらも）
    animationTimersRef.current.forEach(timer => clearTimeout(timer));
    animationTimersRef.current = [];

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();
    
    setAnalysisState('analyzing');
    const startTime = Date.now();

    try {
      const requestBody = {
        user_draft: currentText,  // 現在表示されているテキストを送信
        thread_context: threadContext,
        language: isJapanese ? "japanese" : "english",
        hierarchy: hierarchy,
        social_distance: social_distance,
        prompt_version: promptVersion, // 追加
      };
      
      // 送信データの詳細をログ出力
      console.log("=== APIリクエスト詳細 ===");
      console.log("language:", requestBody.language);
      console.log("hierarchy:", requestBody.hierarchy);
      console.log("social_distance:", requestBody.social_distance);
      console.log("thread_context長さ:", requestBody.thread_context.length);
      console.log("完全なリクエストボディ:", JSON.stringify(requestBody, null, 2));

      const response = await fetch("/api/check-tone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      console.log("APIレスポンスステータス:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("APIエラーレスポンス:", errorText);
        
        // ユーザー向けのエラーメッセージを設定
        let userMessage = isJapanese 
          ? "エラーが発生しました。もう一度お試しください。"
          : "An error occurred. Please try again.";
        
        if (response.status === 401) {
          userMessage = isJapanese
            ? "認証エラーが発生しました。APIキーを確認してください。"
            : "Authentication error. Please check the API key.";
        } else if (response.status >= 500) {
          userMessage = isJapanese
            ? "サーバーエラーが発生しました。しばらく待ってからお試しください。"
            : "Server error. Please try again later.";
        }
        
        setErrorMessage(userMessage);
        throw new Error("Failed to analyze text");
      }

      const analysis: ToneAnalysis = await response.json();
      
      // レスポンスの詳細をログ出力
      console.log("=== APIレスポンス詳細 ===");
      console.log("hasIssues:", analysis.hasIssues);
      console.log("issue_pattern:", analysis.issue_pattern);
      console.log("ai_receipt:", analysis.ai_receipt);
      console.log("improvement_points:", analysis.improvement_points);
      console.log("detailed_analysis:", analysis.detailed_analysis);
      console.log("suggestion長さ:", analysis.suggestion?.length || 0);
      console.log("完全なレスポンス:", JSON.stringify(analysis, null, 2));

      // 変更後
      await log("analysis_completed", {
        context: threadContext,
        originalMessage: userDraft,
        issue_pattern: analysis.issue_pattern || [],  // 追加
        aiResponse: {
          hasIssues: analysis.hasIssues,
          ai_receipt: analysis.ai_receipt,
          improvement_points: analysis.improvement_points,
          suggestion: analysis.suggestion || undefined,
          reasoning: analysis.reasoning,
          issue_pattern: analysis.issue_pattern || [],  // 追加
        },
        processingTime: Date.now() - startTime,
      });

      // Log analysis data to Supabase
      try {
        const result = await createConvo({
          input: userDraft,
          feedback: analysis.suggestion || "",
          hierarchy: hierarchy,
          social_distance: social_distance,
          language: isJapanese ? "japanese" : "english",
          thread_context: threadContext,
          issue_pattern: analysis.issue_pattern || [],
          has_issues: analysis.hasIssues,
          ai_receipt: analysis.ai_receipt || "",
          improvement_points: analysis.improvement_points || "",
          detailed_analysis: analysis.detailed_analysis || "",
          reasoning: analysis.reasoning || "",
          detected_mentions: analysis.detected_mentions || [],
          timestamp: new Date().toISOString()
        });
        
        if (result) {
          console.log("Successfully logged to Supabase with full data");
        } else {
          console.warn("Failed to log to Supabase, but continuing with analysis");
        }
      } catch (error) {
        console.error("Error logging to Supabase:", error);
      }

      console.log("hasIssues:", analysis.hasIssues);
      console.log("suggestion:", analysis.suggestion);

      // API応答を受信したことを記録
      setHasReceivedResponse(true);
      
      // Phase 1 修正: 最小待機時間の確保
      const elapsedTime = Date.now() - startTime;
      const minimumWaitTime = isFirstAnalysis && !isReanalysis ? 1200 : 0; // 初回は1.2秒、再解析は即座
      const remainingWaitTime = Math.max(0, minimumWaitTime - elapsedTime);
      
      console.log("=== 待機時間計算 ===");
      console.log("経過時間:", elapsedTime, "ms");
      console.log("最小待機時間:", minimumWaitTime, "ms");
      console.log("残り待機時間:", remainingWaitTime, "ms");
      
      if (remainingWaitTime > 0) {
        // 最小待機時間まで待つ
        await new Promise(resolve => setTimeout(resolve, remainingWaitTime));
      }

      // API応答を受信したことを記録
      setHasReceivedResponse(true);
      
      // API応答時に確実にランダムテキストを終了
      setSuggestion(analysis);
      setIsShowingRandomText(false);  // 必ずfalseに設定
      setShowRandomTextFlag(false);    // フラグもリセット
      if (analysis.suggestion) {
        setDisplayText(analysis.suggestion);
        // Phase 3: 新しい提案が来たら編集状態をリセット
        setEditedSuggestionText("");  // 次回の編集に備えてクリア
        setHasEditedSuggestion(false); // 編集フラグもリセット
        setEditedOriginalText("");     // 元文章の編集もクリア
        setHasEditedOriginal(false);   // 元文章の編集フラグもリセット
        // トグル状態を提案表示に戻す
        setIsShowingOriginal(false);
      }
      console.log("分析結果を設定 - hasIssues:", analysis.hasIssues, "suggestion:", analysis.suggestion);
      
      // Phase 3: 解析完了フラグを設定
      setIsAnalysisComplete(true);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('解析がキャンセルされました');
        
        // Phase 1 修正: キャンセル時の完全なリセット
        setIsTransitioning(false);
        setAnalysisState('ready');
        setIsReanalyzing(false);
        setShowRandomTextFlag(false);
        setIsShowingRandomText(false);  // 確実にリセット
        setHasReceivedResponse(false);  // API応答フラグもリセット
        setIsAnalysisComplete(false);   // Phase 3: 解析完了フラグもリセット
        
        // 初回解析でキャンセルされた場合
        if (isFirstAnalysis && showSuggestionArea) {
          setAnimationPhase('input');
          setShowSuggestionArea(false);
          setSuggestion(null);
          setIsFirstAnalysis(true); // 初回フラグも維持
        } else {
          // 再解析でキャンセルされた場合は提案エリアは維持
          setAnimationPhase('suggestion');
        }
        
        return;
      }
      console.error("エラー詳細:", error);
      setSuggestion(null);
      setAnalysisState('ready'); // エラー時もreadyに戻す
      setIsShowingRandomText(false); // Phase 1 修正: エラー時も確実にリセット
      setShowRandomTextFlag(false);
      setHasReceivedResponse(false); // API応答フラグもリセット
      setIsAnalysisComplete(false);  // Phase 3: 解析完了フラグもリセット
      
      // ネットワークエラーの場合
      if (!error.name || error.name !== 'AbortError') {
        const userMessage = isJapanese
          ? "ネットワークエラーが発生しました。インターネット接続を確認してください。"
          : "Network error. Please check your internet connection.";
        setErrorMessage(userMessage);
      }
    } finally {
      // Phase 1 修正: finallyでも確実にリセット
      if (!abortControllerRef.current?.signal.aborted) {
        setAnalysisState('analyzed');
        setIsShowingRandomText(false); // 解析終了時に必ずリセット
        setShowRandomTextFlag(false);  // フラグもリセット
        console.log("=== 解析終了 - isShowingRandomText を false に設定 ===");
      }
    }
  },
  [threadContext, userDraft, isJapanese, log, hierarchy, social_distance, canAnalyze, showSuggestionArea, isShowingOriginal, editedOriginalText, suggestion, isFirstAnalysis]
);

  // トグル機能の実装
  // ユーザーが提案と元文章を自由に切り替えて、それぞれを独立して編集できるようにする
  const handleToggleOriginal = () => {
    setIsShowingOriginal(!isShowingOriginal);
    // トグル時に表示テキストを更新
    // 画面の表示が即座に切り替わる
    if (!isShowingOriginal) {
      // オリジナルに切り替え
      // 編集済みの元文章 or 最初の元文章を表示
      setDisplayText(editedOriginalText || analyzedOriginalText);
    } else {
      // 提案に切り替え
      // 編集済みの提案 or AIの提案を表示
      setDisplayText(editedSuggestionText || suggestion?.suggestion || "");
    }
  };

  // Handle text change with debouncing
  const handleTextChange = (value: string) => {
    // Phase 1 修正: ランダムテキスト表示中でも編集を受け付ける
    setUserDraft(value);
    setDisplayText(value);
    
    // オリジナル表示中の編集を記録
    if (isShowingOriginal) {
      setEditedOriginalText(value);
    }
    
    // 解析済みの場合、ready状態に戻す
    if (analysisState === 'analyzed') {
      setAnalysisState('ready');
    }

    // 反映ボタンが押された後の編集
    if (hasAcceptedSuggestion && value !== acceptedSuggestionText) {
      if (hasSignificantChange()) {
        setHasAcceptedSuggestion(false);
        setAcceptedSuggestionText("");
      }
    }
  };

  // 提案の編集を処理
  const handleSuggestionEdit = (newText: string) => {
    // Phase 3: editedSuggestionTextに保存して、提案の編集を明示的に管理
    setEditedSuggestionText(newText);
    // 画面の表示も更新（リアルタイムで編集内容を反映）
    setDisplayText(newText);
    
    // 再解析可能にする
    if (analysisState === 'analyzed') {
      setAnalysisState('ready');
    }
  };

  // 編集時のテキスト処理を統一
  // 重要：どちらのモードでも編集内容は独立して保存される
  // これにより、ユーザーは提案と元文章を行き来しながら、それぞれのバージョンを編集できる
  const handleEditInSuggestionMode = (value: string) => {
    // Phase 3 修正: 空文字列も正しく処理し、適切な状態に保存
    if (isShowingOriginal) {
      // 「←元文章に戻す」を押している状態での編集
      setEditedOriginalText(value);
      setHasEditedOriginal(true);
      // 画面の表示も即座に更新
      setDisplayText(value);
    } else {
      // AI提案を表示中の編集
      // 専用の状態（editedSuggestionText）に保存
      setEditedSuggestionText(value);
      setHasEditedSuggestion(true);
      // 画面の表示も即座に更新
      setDisplayText(value);
    }
    
    // 再解析可能にする（編集したら再解析ボタンを有効化）
    if (analysisState === 'analyzed') {
      setAnalysisState('ready');
    }
  };

    // Accept suggestion
    const acceptSuggestion = async () => {
      if (suggestion?.suggestion) {
        // 元のテキストを保存
        setOriginalText(userDraft);
        // 全文を置換
        setUserDraft(suggestion.suggestion);
        setAcceptedSuggestionText(suggestion.suggestion);
        setHasAcceptedSuggestion(true);
        setAnalysisState('analyzed');
        textareaRef.current?.focus();

        // ログ記録
        await log("suggestion_accepted", {
          action: "accept",
          previousText: userDraft,
          newText: suggestion.suggestion,
        });
      }
    };

  // Revert to original text
  const revertToOriginal = async () => {
    if (originalText) {
      setUserDraft(originalText);
      setAnalysisState('ready');
      setHasAcceptedSuggestion(false);
      setAcceptedSuggestionText("");
      setOriginalText("");
      
      // MessageEditorにフォーカスを戻すための処理は後で追加

      // ログ記録
      await log("suggestion_rejected", {
        action: "reject",
        previousText: userDraft,
        newText: originalText,
      });
    }
  };

  // Dismiss suggestion
  const dismissSuggestion = () => {
    // アニメーションを逆再生
    setAnimationPhase('transitioning');
    setIsTransitioning(true);
    
    // 段階的に戻す
    setTimeout(() => {
      setAnimationPhase('input');
    }, 300);
    
    setTimeout(() => {
      setShowSuggestionArea(false);
      setSuggestion(null);
      setAnalysisState('ready');
      setIsTransitioning(false);
      setIsFirstAnalysis(true); // リセット
      setIsReanalyzing(false);
      setShowRandomTextFlag(false); // フラグもリセット
      setIsShowingRandomText(false); // ランダムテキスト表示もリセット
      setHasReceivedResponse(false); // API応答フラグもリセット
      setIsAnalysisComplete(false);  // Phase 3: 解析完了フラグもリセット
      // トグル関連の状態もリセット
      setIsShowingOriginal(false);
      setEditedOriginalText("");
      setEditedSuggestionText("");
      setHasEditedOriginal(false);
      setHasEditedSuggestion(false);
      // Phase 3: 最大高さもリセット
      setMaxTextAreaHeight(null);
      // 元文章もリセット
      setAnalyzedOriginalText("");
      // ユーザーの入力もクリア
      setUserDraft("");
    }, 1200);
  };

// ランダムテキストアニメーション
  useEffect(() => {
    console.log("=== ランダムテキストuseEffect実行 ===");
    console.log("suggestion:", suggestion);
    console.log("showSuggestionArea:", showSuggestionArea);
    console.log("showRandomTextFlag:", showRandomTextFlag);
    console.log("hasReceivedResponse:", hasReceivedResponse);
    console.log("isReanalyzing:", isReanalyzing);  // Phase 3: 再解析チェック追加
    
    // Phase 3: 再解析時もランダムテキストを表示する（スキップを削除）
    // 初回も再解析も同じユーザー体験を提供
    
    if (!suggestion || !showSuggestionArea) {
      setDisplayText(userDraft);
      return;
    }

    let animationFrame: number | undefined;
    let isTransitioningToReal = false;

    // ランダムな文字を生成する関数
    const generatePartialRandomText = (baseText: string, progress: number): string => {
      const lines = baseText.split('\n');
      const randomChars = isJapanese 
        ? '石井遼介イシイリョウスケｲｼｲﾘｮｳｽｹ月奈なづきツキナナヅキﾂｷﾅﾅﾂﾞｷ孫逸歓ソンイツキｿﾝｲﾂｷ心理的安全性顧客志向両利きの経営エンゲージメントウェルビーイングSDGsPsychologicalSafetySonItsukiRyosukeIshiiTsukinaNazuki^&*()_+-=[]{}|;:,.<>?αβγδεζηθικλμνξοπρστυφχψω'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?αβγδεζηθικλμνξοπρστυφχψω';
      
      return lines.map((line, lineIndex) => {
        if (!line) return line;
        
        return line.split('').map((char, charIndex) => {
          if (char === ' ' || char === '\n') return char;
          
          const waveOffset = Math.sin((lineIndex * 3 + charIndex * 0.5 + Date.now() * 0.001)) * 0.5 + 0.5;
          const randomThreshold = progress * (0.7 + waveOffset * 0.3);
          
          if (Math.random() < randomThreshold) {
            return randomChars[Math.floor(Math.random() * randomChars.length)];
          } else {
            return char;
          }
        }).join('');
      }).join('\n');
    };

    // 実際の結果への遷移アニメーション
    const transitionToReal = (targetText: string) => {
      isTransitioningToReal = true;
      const startTime = Date.now();
      const duration = 200;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        if (progress >= 1) {
          setDisplayText(targetText);
          setIsShowingRandomText(false);
          console.log("=== transitionToReal完了 - isShowingRandomText を false に設定 ===");
          return;
        }
        
        const lines = targetText.split('\n');
        const result = lines.map(line => {
          if (!line) return line;
          
          return line.split('').map((char, index) => {
            const charProgress = progress + (Math.random() * 0.2 - 0.1);
            
            if (charProgress > Math.random()) {
              return char;
            } else {
              const randomChars = isJapanese 
                ? 'あいうえおかきくけこさしすせそたちつてとなにぬねのアイウエオカキクケコ会議資料確認共有連絡報告'
                : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
              return randomChars[Math.floor(Math.random() * randomChars.length)];
            }
          }).join('');
        }).join('\n');
        
        setDisplayText(result);
        animationFrame = requestAnimationFrame(animate);
      };
      
      animate();
    };

    // AIの実際の改善案が来たら、遷移アニメーションを開始
    if (hasReceivedResponse && suggestion.suggestion) {
      if (isShowingRandomText && !isTransitioningToReal) {
        transitionToReal(suggestion.suggestion);
      } else if (!isShowingRandomText && !showRandomTextFlag) {
        // ランダムテキストが開始予定でない場合のみ即座に表示
        setDisplayText(suggestion.suggestion);
      }
      // returnを削除：ランダムアニメーションのチェックを続行
    }

    // 改善案がまだない場合、フラグに基づいてランダムテキストアニメーション
    console.log("=== ランダムテキスト条件チェック ===");
    console.log("showRandomTextFlag:", showRandomTextFlag);
    console.log("hasReceivedResponse:", hasReceivedResponse);
    console.log("analyzedOriginalText:", analyzedOriginalText);
    console.log("条件1 (showRandomTextFlag):", showRandomTextFlag);
    console.log("条件2 (!hasReceivedResponse):", !hasReceivedResponse);
    console.log("条件3 (analyzedOriginalText):", !!analyzedOriginalText);
    console.log("全条件:", showRandomTextFlag && !hasReceivedResponse && analyzedOriginalText);
    
    if (showRandomTextFlag && !hasReceivedResponse && analyzedOriginalText) {
      console.log("=== ランダムテキストアニメーション条件成立 ===");
      console.log("showRandomTextFlag:", showRandomTextFlag);
      console.log("hasReceivedResponse:", hasReceivedResponse);
      console.log("analyzedOriginalText:", analyzedOriginalText);
      
      // Phase 3: 再解析時は編集されたテキストをベースにアニメーション
      // これにより、ユーザーが編集した内容がランダムに変化する様子が見える
      const baseTextForAnimation = isReanalyzing 
        ? getDisplayTextForEditor()  // 現在表示中のテキストを正確に取得
        : analyzedOriginalText;
      
      if (!isShowingRandomText) {
        console.log("=== ランダムテキストアニメーション開始 ===");
        setDisplayText(baseTextForAnimation);
        setIsShowingRandomText(true);
      }
      
      const animationStartTime = Date.now();
      
      let frameCount = 0;
      const continuousAnimate = () => {
        if (hasReceivedResponse && suggestion.suggestion) {
          transitionToReal(suggestion.suggestion);
          return;
        }
        
        frameCount++;
        if (frameCount % 12 === 0) {
          const elapsed = Date.now() - animationStartTime;
          const progress = Math.min(1, elapsed / 3000);
          
          const partiallyRandomText = generatePartialRandomText(baseTextForAnimation, progress);
          setDisplayText(partiallyRandomText);
        }
        
        animationFrame = requestAnimationFrame(continuousAnimate);
      };
      
      continuousAnimate();
      
      return () => {
        if (animationFrame !== undefined) {
          cancelAnimationFrame(animationFrame);
        }
      };
    } else if (hasReceivedResponse && suggestion?.suggestion) {
      // 既に改善案がある場合は即座に表示
      console.log("=== 即座に表示 - suggestion:", suggestion.suggestion);
      setDisplayText(suggestion.suggestion);
      setIsShowingRandomText(false);
    }

    return () => {
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [suggestion, showSuggestionArea, analysisState, isJapanese, showRandomTextFlag, hasReceivedResponse, isReanalyzing]);


  // Phase 1 修正: ランダムテキスト状態の安全装置を強化
  useEffect(() => {
    // 解析が完了したらランダムテキストを必ず終了
    if (analysisState === 'analyzed') {
      setIsShowingRandomText(false);
      setShowRandomTextFlag(false);
      console.log("=== 安全装置: analyzed状態でisShowingRandomTextをfalseに ===");
    }
  }, [analysisState]);

  // 言語切り替えを検知
  useEffect(() => {
    setAnalysisState('ready');
    if (showSuggestionArea) {
      setExternalChanges(true);
    }
  }, [isJapanese]);

  // 各種設定変更を検知
  useEffect(() => {
    if (analysisState === 'analyzed') {
      setAnalysisState('ready');
    }
  }, [threadContext, hierarchy, social_distance]);
  // ========== 言語切り替えの検知ここまで ==========

  // Phase 3: PC版の編集モード管理
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    
    if (!isMobile && isEditingMode) {
      // PC版のみ: 編集時に画面下部に余白を追加
      document.body.style.paddingBottom = '60vh';
      document.body.style.transition = 'padding-bottom 0.3s ease';
    } else {
      // 編集終了時または、モバイルでは余白を削除
      document.body.style.paddingBottom = '0';
    }
    
    return () => {
      document.body.style.paddingBottom = '0';
    };
  }, [isEditingMode]);

  // AI提案の初期編集テキスト設定
  useEffect(() => {
    if (suggestion?.suggestion && isAnalysisComplete && !isShowingOriginal && !editedSuggestionText) {
      setEditedSuggestionText(suggestion.suggestion);
    }
  }, [suggestion?.suggestion, isAnalysisComplete, isShowingOriginal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("=== コンポーネントアンマウント - クリーンアップ実行 ===");
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // タイマーのクリーンアップ
      animationTimersRef.current.forEach(timer => clearTimeout(timer));
      animationTimersRef.current = [];  // 配列もリセット
      // Phase 3: body要素のスタイルもリセット
      document.body.style.paddingBottom = '0';
    };
  }, []);

// 解析状態に応じたクリーンアップの強化
  useEffect(() => {
    return () => {
      // 解析中にコンポーネントがアンマウントされる場合の対策
      if (analysisState === 'analyzing' && abortControllerRef.current) {
        console.log("=== 解析中のアンマウント検出 - 解析をキャンセル ===");
        abortControllerRef.current.abort();
      }
      
      // すべてのタイマーを確実にクリア
      if (animationTimersRef.current.length > 0) {
        console.log("=== 残存タイマーのクリア:", animationTimersRef.current.length, "個 ===");
        animationTimersRef.current.forEach(timer => clearTimeout(timer));
        animationTimersRef.current = [];
      }
    };
  }, [analysisState]);

  // 改善ポイント表示セクションのレンダリング関数
  const renderImprovementSection = () => {
    // 型推論の問題を回避するため、早期リターンパターンを使用
    if ((analysisState as string) === 'analyzing') {
      return (
        <div className="space-y-2">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 min-h-[80px]">
            {currentAnalysisPhase && analysisPhaseText.improvement_points ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {analysisPhaseText.improvement_points}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-slate-200 rounded animate-pulse w-4/5"></div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (!suggestion) return null;

    if (suggestion.hasIssues) {
      return (
        <div className="space-y-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 min-h-[80px]">
            {suggestion.improvement_points ? (
              <>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {suggestion.improvement_points}
                </p>
                
                {/* 詳細分析のアコーディオン */}
                {suggestion.detailed_analysis && (
                  <div className="mt-3">
                    <button
                      onClick={async () => {
                        const newState = !showDetailedAnalysis;
                        setShowDetailedAnalysis(newState);
                        
                        // ログ記録
                        await log("detailed_analysis_toggled", {
                          action: newState ? "expand" : "collapse",
                          previousText: analyzedOriginalText,
                          newText: suggestion.suggestion || undefined
                        });
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-yellow-700 hover:text-yellow-800 transition-colors"
                    >
                      <span>{isJapanese ? "もっと詳しく" : "Learn more"}</span>
                      {showDetailedAnalysis ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    
                    {showDetailedAnalysis && (
                      <div className="mt-2 pt-2 border-t border-yellow-300">
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {suggestion.detailed_analysis}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="h-4 bg-yellow-200 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-yellow-200 rounded animate-pulse w-4/5"></div>
                <div className="mt-3 h-3 bg-yellow-300 rounded animate-pulse w-24"></div>
              </div>
            )}
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            {currentAnalysisPhase && analysisPhaseText.improvement_points ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {analysisPhaseText.improvement_points}
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {suggestion.improvement_points}
                </p>
                
                {/* 詳細分析のアコーディオン（hasIssues: falseの場合） */}
                {suggestion.detailed_analysis && (
                  <div className="mt-3">
                    <button
                      onClick={async () => {
                        const newState = !showDetailedAnalysis;
                        setShowDetailedAnalysis(newState);
                        
                        // ログ記録
                        await log("detailed_analysis_toggled", {
                          action: newState ? "expand" : "collapse",
                          previousText: analyzedOriginalText,
                          newText: suggestion.suggestion || undefined
                        });
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 transition-colors"
                    >
                      <span>{isJapanese ? "もっと詳しく" : "Learn more"}</span>
                      {showDetailedAnalysis ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    
                    {showDetailedAnalysis && (
                      <div className="mt-2 pt-2 border-t border-green-300">
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {suggestion.detailed_analysis}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    }
  };

  // Phase 4: 解析中テキストアニメーション
  useEffect(() => {
    // ガード条件：解析中かつ提案エリア表示中のみ動作
    if (analysisState !== 'analyzing' || !showSuggestionArea) {
      setCurrentAnalysisPhase(null);
      setAnalysisPhaseText({ ai_receipt: '', improvement_points: '' });
      return;
    }

    const phaseTimers: NodeJS.Timeout[] = [];
    let dotTimer: NodeJS.Timeout;
    let rotationTimer: NodeJS.Timeout;
    let dots = 1;

    // 文字数判定
    const textLength = userDraft.length;
    const lengthCategory = textLength <= 30 ? 'short' : textLength <= 200 ? 'medium' : 'long';

    // transition完了を待つ（既存の1000msと同期）
    const initTimer = setTimeout(() => {
      // Phase 1: 関係性認識（0-1500ms）
      setCurrentAnalysisPhase('relationship');
      const relationshipText = `${DISTANCE_ADJECTIVES[social_distance]}${HIERARCHY_NOUNS[hierarchy]}へのメッセージですね`;
      
      // ドットアニメーション
      const updateDots = () => {
        setAnalysisPhaseText(prev => ({
          ...prev,
          ai_receipt: relationshipText + '.'.repeat(dots)
        }));
        dots = (dots % 3) + 1;
      };
      
      updateDots();
      dotTimer = setInterval(updateDots, 500);
      
      // Phase 2への遷移（1500ms後）
      const phase2Timer = setTimeout(() => {
        clearInterval(dotTimer);
        setCurrentAnalysisPhase('analyzing');
        
        // 累積表示の実装
        setAnalysisPhaseText({
          ai_receipt: ANALYSIS_MESSAGES.phase2.ai_receipt[0] + '...',
          improvement_points: ANALYSIS_MESSAGES.phase2.improvement_points[0] + '...'
        });
        
        // 800ms後に2行目追加（文字数に応じて調整）
        const addSecondLine = setTimeout(() => {
          const secondLineAi = lengthCategory === 'short' 
            ? LENGTH_BASED_MESSAGES.short.phase2
            : ANALYSIS_MESSAGES.phase2.ai_receipt[1];
            
          setAnalysisPhaseText({
            ai_receipt: ANALYSIS_MESSAGES.phase2.ai_receipt[0] + '...\n' + secondLineAi + '...',
            improvement_points: ANALYSIS_MESSAGES.phase2.improvement_points.join('...\n') + '...'
          });
        }, 800);
        
        phaseTimers.push(addSecondLine);
      }, 1500);
      
      // Phase 3への遷移（3500ms後）
      const phase3Timer = setTimeout(() => {
        setCurrentAnalysisPhase('finalizing');
        let rotationIndex = 0;
        
        const rotate = () => {
          const aiMessage = lengthCategory !== 'medium'
            ? (rotationIndex === 0 ? LENGTH_BASED_MESSAGES[lengthCategory].phase3 : ANALYSIS_MESSAGES.phase3.ai_receipt[rotationIndex])
            : ANALYSIS_MESSAGES.phase3.ai_receipt[rotationIndex];
            
          setAnalysisPhaseText({
            ai_receipt: aiMessage + '...',
            improvement_points: ANALYSIS_MESSAGES.phase3.improvement_points[rotationIndex] + '...'
          });
          rotationIndex = (rotationIndex + 1) % 3;
        };
        
        rotate();
        rotationTimer = setInterval(rotate, 2500);
      }, 3500);
      
      phaseTimers.push(phase2Timer, phase3Timer);
    }, 1000); // transition完了待ち

    phaseTimers.push(initTimer);
    
    // animationTimersRefに追加（既存のクリーンアップ機構を活用）
    animationTimersRef.current.push(...phaseTimers);
    
    return () => {
      clearInterval(dotTimer);
      clearInterval(rotationTimer);
      phaseTimers.forEach(timer => clearTimeout(timer));
      setAnalysisPhaseText({ ai_receipt: '', improvement_points: '' });
      setCurrentAnalysisPhase(null);
    };
  }, [analysisState, showSuggestionArea, hierarchy, social_distance, userDraft.length]);

  // ========== ここにショートカットキーの実装を追加 ==========
  // ショートカットキーの実装
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canAnalyze && analysisState === 'ready' && (!hasAcceptedSuggestion || hasSignificantChange())) {
          analyzeText();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canAnalyze, analysisState, hasAcceptedSuggestion, analyzeText]);
  // ========== ショートカットキーの実装ここまで ==========


  const labels = {
    contextTitle: isJapanese
      ? "過去のやりとり・会話の履歴"
      : "Conversation Context",
    contextPlaceholder: isJapanese
      ? "SlackやTeamsから、これまでの会話履歴をここにコピー & ペーストして、SenpAI Senseiが文脈を理解するのを助けてください。(回答の精度が上がります)"
      : "Paste your conversation history here so the AI can understand the context...",
    writeTitle: isJapanese
      ? "投稿予定のメッセージを書く"
      : "Write your message",
    writePlaceholder: isJapanese
      ? "ここに、これから相手に送ろうとしているメッセージを入力してください。　入力後、右下の送信/解析ボタンをクリックしてください。"
      : "Start typing your message here... Click the analyze button when ready.",
    analyzing: isJapanese ? "分析中......" : "Analyzing...",
  };

  return (

    <div className="flex-1 flex flex-col overflow-visible p-2">
      {/* Responsive Grid Container */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-3 gap-2.5 sm:gap-4 lg:gap-6 lg:min-h-0 max-h-[calc(100vh-140px)]">

        {/* Context Input - Accordion on mobile/tablet, normal on desktop */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 lg:flex lg:flex-col lg:col-span-1 lg:h-full flex-shrink-0">
          {/* モバイル・タブレット用アコーディオン */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsContextOpen(!isContextOpen)}
              className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-purple-50 hover:bg-purple-100 transition-colors flex items-center justify-between min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 text-purple-700 transition-transform ${
                    isContextOpen ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <h3 className="text-sm sm:text-base font-semibold text-purple-800">
                  {labels.contextTitle}
                </h3>
                <span className="text-xs text-purple-600 ml-2">
                  {isJapanese ? "（任意）" : "(Optional)"}
                </span>
              </div>
              {threadContext && !isContextOpen && (
                <span className="text-xs text-purple-600">
                  {isJapanese ? "入力済み" : "Added"}
                </span>
              )}
            </button>

            {/* アコーディオンコンテンツ */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ${
                isContextOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <textarea
                  value={threadContext}
                  onChange={(e) => {
                    setThreadContext(e.target.value);
                    if (showSuggestionArea && analysisState === 'analyzed') {
                      setExternalChanges(true);
                    }
                  }}
                  placeholder={labels.contextPlaceholder}
                  className="w-full resize-none border-0 border-t border-purple-200 focus-visible:ring-2 focus-visible:ring-purple-500 text-xs sm:text-sm leading-relaxed transition-all duration-300 overflow-y-auto px-4 py-3 bg-white text-gray-900 h-[120px]"
                  style={{ 
                    fontFamily: "Inter, sans-serif"
                  }}
                />
              </div>
            </div>
          </div>

          {/* PC版通常表示 */}
          <div className="hidden lg:flex lg:flex-col lg:h-full">
            {/* Context Header */}
            <div className="px-4 sm:px-5 py-2 sm:py-3 border-b border-purple-200 bg-purple-50 flex-shrink-0">
              <h3 className="text-sm sm:text-base font-semibold text-purple-800 tracking-wide">
                {labels.contextTitle}
              </h3>
            </div>

            {/* Context Text Area */}
            <div className="relative flex-1 flex flex-col min-h-0">
              <textarea
                value={threadContext}
                onChange={(e) => {
                  setThreadContext(e.target.value);
                  if (showSuggestionArea && analysisState === 'analyzed') {
                    setExternalChanges(true);
                  }
                }}
                placeholder={labels.contextPlaceholder}
                className={`flex-1 resize-none border-0 rounded-none focus-visible:ring-2 focus-visible:ring-purple-500 text-xs sm:text-sm leading-relaxed transition-all duration-300 overflow-y-auto px-3 py-2 bg-white text-gray-900 ${
                  // モバイルでの高さ制御
                  analysisState === 'analyzed' 
                    ? 'min-h-[60px] sm:min-h-full' 
                    : 'min-h-[120px] sm:min-h-full'
                }`}
                style={{ 
                  fontFamily: "Inter, sans-serif",
                  minHeight: '120px'
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Side Container - Message Input and Suggestions */}
        <div className="lg:col-span-2">
          {/* 統合コンテナ - 常に存在 */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 hover:shadow-xl overflow-hidden">
            {/* 解析結果部分 - 常にDOMに存在、高さで制御 */}
            {/* grid-rowsトリック: 0frから1frへの変化で自然な高さアニメーション */}
            <div 
              className={`grid suggestion-area-transition ${
                showSuggestionArea ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
              style={{
                opacity: showSuggestionArea ? 1 : 0,
                transform: showSuggestionArea ? 'translateY(0)' : 'translateY(-10px)'
              }}
            >
              <div className="overflow-hidden">
              {(suggestion || errorMessage) && (
                <div className="p-5 space-y-4 rounded-t-xl">
                {/* エラーメッセージの表示 */}
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm text-red-800">{errorMessage}</p>
                        <button
                          onClick={() => {
                            setErrorMessage(null);
                            analyzeText();
                          }}
                          className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          {isJapanese ? "もう一度試す" : "Try again"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 通常の提案内容（suggestionがある場合のみ） */}
                {suggestion && !errorMessage && (
                  <>
                {/* ヘッダー with アイコン */}
                  <div className="flex items-start justify-between rounded-t-xl">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">
                        {suggestion.hasIssues ? '💡' : '❤️'}
                      </span>
                      <h3 className="text-base font-bold text-slate-800">
                        {suggestion.hasIssues 
                          ? (isJapanese ? "改善提案" : "Improvement Suggestion")
                          : (isJapanese ? "素敵なメッセージです" : "Great message!")}
                      </h3>
                    </div>
                    <button
                      onClick={dismissSuggestion}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* AI Receipt */}
                  <div className="text-sm text-slate-700 leading-relaxed min-h-[40px]">
                    {analysisState === 'analyzing' && currentAnalysisPhase && analysisPhaseText.ai_receipt ? (
                      <div className="whitespace-pre-wrap">{analysisPhaseText.ai_receipt}</div>
                    ) : (suggestion.ai_receipt || suggestion.reasoning) ? (
                      suggestion.ai_receipt || suggestion.reasoning
                    ) : (
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/5"></div>
                      </div>
                    )}
                  </div>

                  {/* 改善ポイント / Goodポイント */}
                  {renderImprovementSection()}

                  {/* hasIssues: falseの場合のみ青いバッジを表示 */}
                  {!suggestion.hasIssues && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {isJapanese ? "このまま送信OKです！" : "Ready to send!"}
                      </p>
                    </div>
                 )}
                </>
                )}
                </div>
              )}
              </div>
            </div>
            
            {/* MessageEditor - 同じコンテナ内に常に存在 */}
            <MessageEditor
                mode={showSuggestionArea ? "suggestion" : "input"}
                text={showSuggestionArea ? getDisplayTextForEditor() : userDraft}
                onTextChange={showSuggestionArea ? handleEditInSuggestionMode : handleTextChange}
                hierarchy={hierarchy}
                socialDistance={social_distance}
                onHierarchyChange={(value) => {
                  setHierarchy(value);
                  if (analysisState === 'analyzing' && abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                  // Phase 3: セレクタ変更時に再解析可能に
                  if (analysisState === 'analyzed' || showSuggestionArea) {
                    setAnalysisState('ready');
                    setExternalChanges(true);
                  }
                }}
                onSocialDistanceChange={(value) => {
                  setSocialDistance(value);
                  if (analysisState === 'analyzing' && abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                  // Phase 3: セレクタ変更時に再解析可能に
                  if (analysisState === 'analyzed' || showSuggestionArea) {
                    setAnalysisState('ready');
                    setExternalChanges(true);
                  }
                }}
                onAnalyze={() => {
                  if (!canAnalyze) return;
                  if (hasAcceptedSuggestion && !hasSignificantChange()) {
                    return;
                  }
                  analyzeText();
                }}
                analysisState={analysisState}
                canAnalyze={canAnalyze}
                isJapanese={isJapanese}
                hasAcceptedSuggestion={hasAcceptedSuggestion}
                hasSignificantChange={hasSignificantChange()}
                
                // Phase 1 修正: 解析中以外は常に編集可能
                isEditable={analysisState !== 'analyzing'}
                isTransitioning={false}

                title={showSuggestionArea && isAnalysisComplete  // Phase 3: 解析完了後のみタイトル変更
                  ? (isJapanese ? "SenpAI Senseiのメッセージ案（編集可能）" : "SenpAI Sensei's suggestion (editable)")
                  : undefined
                }
                externalChanges={externalChanges}
                // トグル機能用の新規props
                originalText={analyzedOriginalText}
                suggestionText={suggestion?.suggestion || undefined}
                isShowingOriginal={isShowingOriginal}
                onToggleOriginal={handleToggleOriginal}
                hasEditedOriginal={!!editedOriginalText}
                
                // Phase 3: 追加props
                isAnalysisComplete={isAnalysisComplete}
                maxHeight={maxTextAreaHeight}
                onMaxHeightChange={setMaxTextAreaHeight}
                onFocusChange={setIsEditingMode}
              />
          </div>
        </div>
      </div>
    </div>
  );
}