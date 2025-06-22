import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here',
})

export async function POST(request: NextRequest) {
  try {
    const { text, context, language } = await request.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    // Create language-specific prompts
    const getSystemPrompt = (lang: string) => {
      if (lang === 'japanese') {
        return `あなたはSlack/Teamsコミュニケーション改善AI『SenpAI Sensei』です。
## 目的
日本企業の職場チャットで心理的安全性と業務効率を高めるため、ユーザーが送信予定のメッセージを改善提案してください。
## 入力仕様
- thread_context: ユーザーが対応中のチャット履歴全文（空文字列可）
- user_draft: ユーザーが返信しようとしている下書き文面
## 出力フォーマット（厳守）
- JSON オブジェクトのみを返す。説明文・コードブロック禁止。
- キー順と文字数制約を厳守（句読点・改行もカウント）。
    1. "ai_receipt": 20–40字。状況を共感的に受け止める一文（賞賛ではなく共感）。
    2. "suggestion": 100–200字。敬語・箇条書き(「・」)を含む改善後メッセージ。{{boss}}, {{member}} は保持。
    3. "improvement_points": 50–100字。『具体化・明確化・支援性・建設性』4軸を踏まえた改善理由。
- 内部思考・推論過程は一切出力しない。`
      } else {
        return `You are SenpAI Sensei, a professional communication improvement AI for workplace chat platforms like Slack/Teams.
## Purpose
Help users improve their draft messages to enhance psychological safety and work efficiency in workplace chat environments.
## Input Specification
- thread_context: Full chat history the user is responding to (can be empty string)
- user_draft: The draft message the user intends to send
## Output Format (Strict)
- Return only JSON object. No explanations or code blocks.
- Follow key order and character constraints (including punctuation and line breaks).
    1. "ai_receipt": 20–40 characters. One empathetic sentence acknowledging the situation (empathy, not praise).
    2. "suggestion": 100–200 characters. Improved message with respectful language and bullet points (•). Preserve {{boss}}, {{member}}.
    3. "improvement_points": 50–100 characters. Improvement reasoning based on 4 criteria: specificity, clarity, supportiveness, constructiveness.
- Do not output internal thoughts or reasoning processes.`
      }
    }

    const systemPrompt = getSystemPrompt(language || 'english')
    
    // Prepare user message with context
    const userMessage = context 
      ? `Thread Context: ${context}\n\nUser Draft: ${text}`
      : `User Draft: ${text}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    })

    const response = completion.choices[0]?.message?.content
    
    if (!response) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    try {
      const parsedResponse = JSON.parse(response)
      return NextResponse.json(parsedResponse)
    } catch (parseError) {
      // Fallback if AI doesn't return valid JSON
      return NextResponse.json({
        hasIssues: false,
        originalText: text,
        suggestion: null,
        issues: [],
        reasoning: "Unable to parse AI response"
      })
    }

  } catch (error) {
    console.error('Error checking tone:', error)
    return NextResponse.json(
      { error: 'Failed to check tone' },
      { status: 500 }
    )
  }
} 