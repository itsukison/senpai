// APIキーなどの設定を保存するための変数
let apiSettings = {
  provider: 'openai', // 'openai' または 'deepseek'
  apiKey: '', // APIキー（ユーザーが設定する）
  systemPrompt: `あなたはプロフェッショナルなビジネス文書のエディターです。与えられたテキストを分析し、以下の問題がないか確認してください：
1. 強制的または攻撃的な表現
2. 不適切な口調や敬語の誤用
3. 曖昧または過度に冗長な表現
4. 不必要な感情表現

問題が見つかった場合は、より専門的でプロフェッショナルな代替案を提案してください。
元のメッセージの意図は保持しつつ、より明確で礼儀正しい表現に改善してください。`
};

// コンテンツスクリプトからのメッセージを処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeText') {
    analyzeTextWithAI(request.text)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('Error in API call:', error);
        sendResponse({ error: 'API呼び出し中にエラーが発生しました' });
      });
    return true; // 非同期レスポンスを示す
  } else if (request.action === 'saveSettings') {
    // 設定の保存
    apiSettings = { ...apiSettings, ...request.settings };
    chrome.storage.local.set({ apiSettings }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'getSettings') {
    // 設定の取得
    sendResponse({ settings: apiSettings });
    return false;
  }
});

// 拡張機能の初期化時に保存された設定を読み込む
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('apiSettings', (data) => {
    if (data.apiSettings) {
      apiSettings = data.apiSettings;
    } else {
      // デフォルト設定を保存
      chrome.storage.local.set({ apiSettings });
    }
  });
});

// AIによるテキスト分析
async function analyzeTextWithAI(text) {
  // APIキーがなければモック応答を返す
  if (!apiSettings.apiKey) {
    return mockAnalysisResponse(text);
  }

  try {
    if (apiSettings.provider === 'openai') {
      return await callOpenAI(text);
    } else if (apiSettings.provider === 'deepseek') {
      return await callDeepSeek(text);
    } else {
      throw new Error('Unknown API provider');
    }
  } catch (error) {
    console.error('AI API error:', error);
    return mockAnalysisResponse(text); // エラー時はモックレスポンスを返す
  }
}

// OpenAI APIを呼び出す
async function callOpenAI(text) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiSettings.apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: apiSettings.systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0]?.message?.content;

  // レスポンスをパースして構造化
  return parseAIResponse(aiResponse, text);
}

// DeepSeek APIを呼び出す（OpenAIと同様のインターフェースと仮定）
async function callDeepSeek(text) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiSettings.apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: apiSettings.systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0]?.message?.content;

  // レスポンスをパースして構造化
  return parseAIResponse(aiResponse, text);
}

// AIレスポンスをパース
function parseAIResponse(aiResponse, originalText) {
  try {
    // 簡易的なパース（実際にはより堅牢なパーサーが必要かもしれません）
    const issues = [];
    let suggestion = '';

    // 「問題:」と「提案:」の部分を探す
    const problemMatch = aiResponse.match(/問題[：:](.*?)(?=(提案[：:]|$))/s);
    const suggestionMatch = aiResponse.match(/提案[：:](.*?)$/s);

    if (problemMatch && problemMatch[1]) {
      // 箇条書きを分割
      const problemText = problemMatch[1].trim();
      const problemItems = problemText.split(/\n-|\n\d+\./).filter(item => item.trim().length > 0);
      issues.push(...problemItems.map(item => item.trim()));
    }

    if (suggestionMatch && suggestionMatch[1]) {
      suggestion = suggestionMatch[1].trim();
    } else {
      // 提案が明示的に示されていない場合は、全体を提案として扱う
      suggestion = aiResponse.trim();
    }

    return {
      suggestion: suggestion || originalText,
      issues: issues.length > 0 ? issues : null
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return {
      suggestion: originalText,
      issues: ['AIレスポンスの解析中にエラーが発生しました']
    };
  }
}

// モックレスポンス（APIキーがない場合や開発中のテスト用）
function mockAnalysisResponse(text) {
  // テキストに「要求」または「すぐに」が含まれているかチェック
  const hasIssues = text.includes('要求') || text.includes('すぐに') || text.includes('早急に');

  if (hasIssues) {
    return {
      suggestion: text
        .replace('要求', 'お願い')
        .replace('すぐに', 'できるだけ早く')
        .replace('早急に', '可能な限り早く'),
      issues: [
        '強制的な表現が含まれています',
        '緊急性を強調しすぎる表現があります'
      ]
    };
  } else {
    // 問題がない場合
    return {
      suggestion: text,
      issues: null
    };
  }
}
