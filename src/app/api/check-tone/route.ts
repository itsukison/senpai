import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here',
})

// プロンプトファイルを読み込む関数
function loadPromptFromFile(version: string): string {
  try {
    // versions フォルダからプロンプトを読み込む
    const filePath = join(process.cwd(), 'src/app/api/check-tone/versions', `${version}.md`)
    return readFileSync(filePath, 'utf-8')
  } catch (error) {
    console.error(`Failed to load prompt version ${version}:`, error)
    // エラー時はデフォルトプロンプトを返す
    return `<system>
// Default fallback prompt
You are a helpful assistant.
</system>`
  }
}

// 利用可能なバージョンを自動選択する関数
function getAvailableVersions(): string[] {
  try {
    const versionsDir = join(process.cwd(), 'src/app/api/check-tone/versions')
    const files = readdirSync(versionsDir)
    const allVersions = files
      .filter(file => file.endsWith('.md'))
      .map(file => file.replace('.md', ''))
    
    // vX.X系とβ系に分類
    const vVersions = allVersions
      .filter(v => v.match(/^v\d+\.\d+$/))
      .sort((a, b) => {
        const [aMajor, aMinor] = a.substring(1).split('.').map(Number)
        const [bMajor, bMinor] = b.substring(1).split('.').map(Number)
        return bMajor - aMajor || bMinor - aMinor
      })
    
    const betaVersions = allVersions
      .filter(v => v.match(/^b\d+\.\d+$/))
      .sort((a, b) => {
        const [aMajor, aMinor] = a.substring(1).split('.').map(Number)
        const [bMajor, bMinor] = b.substring(1).split('.').map(Number)
        return bMajor - aMajor || bMinor - aMinor
      })
    
    // vX.X系から最新1つ、β系から最新2つを選択
    const selectedVersions = [
      ...vVersions.slice(0, 1),
      ...betaVersions.slice(0, 2)
    ]
    
    return selectedVersions.length > 0 ? selectedVersions : ['v8.4', 'b1.4']
  } catch (error) {
    console.error('Failed to get available versions:', error)
    return ['v8.4', 'b1.4']
  }
}

// 設定を一元管理
const CONFIG = {
  DEFAULT_PROMPT_VERSION: 'b1.4',  // ハードコード指定
  AVAILABLE_VERSIONS: getAvailableVersions()
}

// 新しい単一のシステムプロンプト（互換性のため維持）
const SYSTEM_PROMPT = ``
;

// プロンプトのバージョン管理（遅延読み込みでキャッシュ）
const promptCache: { [key: string]: string } = {}
const PROMPTS = new Proxy({} as Record<string, string>, {
  get(target, version: string) {
    // キャッシュにあればそれを返す
    if (promptCache[version]) {
      return promptCache[version]
    }
    // なければファイルから読み込んでキャッシュ
    const prompt = loadPromptFromFile(version)
    promptCache[version] = prompt
    return prompt
  }
})

// GETメソッドを追加（設定を返す）
export async function GET() {
  return NextResponse.json({
    defaultVersion: CONFIG.DEFAULT_PROMPT_VERSION,
    availableVersions: CONFIG.AVAILABLE_VERSIONS
  })
}

export async function POST(request: NextRequest) {
  try {
    // リクエストヘッダーを確認（デバッグ用）
    const contentType = request.headers.get('content-type');
    console.log('=== Request Headers ===');
    console.log('Content-Type:', contentType);
    
    const requestBody = await request.json()
    const { 
      user_draft, 
      thread_context, 
      language,
      hierarchy = 'peer',
      social_distance = 'neutral',
      prompt_version = CONFIG.DEFAULT_PROMPT_VERSION
    } = requestBody

    // リクエストボディ全体をログ出力
    console.log('=== API Request Received ===');
    console.log('Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('Received prompt_version:', prompt_version);

    if (!user_draft || user_draft.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    // 構造化されたXML形式のユーザーメッセージ
    const userMessage = `<input>
  <lang>${language}</lang>
  <thread_context>${thread_context || ''}</thread_context>
  <user_draft>${user_draft}</user_draft>
  <tags>
    {"social_distance":"${social_distance}", "hierarchy":"${hierarchy}"}
  </tags>
</input>`;

    // OpenAIに送信する内容をログ出力
    console.log('=== OpenAI Request ===');
    console.log('System Prompt Length:', SYSTEM_PROMPT.length);
    console.log('User Message:', userMessage);

    // バージョンに応じたプロンプトを選択
    const selectedPrompt = PROMPTS[prompt_version as string] || loadPromptFromFile('v8.4');

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini", //"gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: selectedPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.4,
      max_tokens: 1500,
    })

    const response = completion.choices[0]?.message?.content
    
    // OpenAIからの生のレスポンスをログ出力
    console.log('=== OpenAI Raw Response ===');
    console.log(response);

    if (!response) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    try {
      const parsedResponse = JSON.parse(response)
      
      // パース後のJSONをログ出力
      console.log('=== Parsed Response ===');
      console.log(JSON.stringify(parsedResponse, null, 2));

      return NextResponse.json(parsedResponse)
    } catch (parseError) {
      console.error('=== JSON Parse Error ===');
      console.error('Parse Error:', parseError);
      console.error('Raw Response that failed to parse:', response);
      
      // Fallback if AI doesn't return valid JSON
      return NextResponse.json({
        hasIssues: false,
        originalText: user_draft,
        suggestion: null,
        issue_pattern: [],
        reasoning: "Unable to parse AI response"
      })
    }

  } catch (error) {
    console.error('=== API Error ===');
    console.error('Error checking tone:', error)
    return NextResponse.json(
      { error: 'Failed to check tone' },
      { status: 500 }
    )
  }
}