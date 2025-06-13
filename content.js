// グローバル変数
let currentElement = null;
let suggestionTooltip = null;
let debounceTimer = null;
let lastText = '';

// 初期設定
function initialize() {
  // ドキュメント全体にイベントリスナーを追加
  document.addEventListener('focusin', handleFocusIn);

  // ツールチップの作成
  createSuggestionTooltip();

  console.log('Professional Tone Checker initialized');
}

// フォーカスイベントのハンドラー
function handleFocusIn(event) {
  const element = event.target;

  // テキストエリアまたはcontentEditableの要素か確認
  if (isEditableElement(element)) {
    currentElement = element;

    // 入力イベントリスナーを追加
    element.addEventListener('input', handleInput);

    // フォーカスが外れた時のイベントリスナー
    element.addEventListener('focusout', () => {
      element.removeEventListener('input', handleInput);
      hideSuggestionTooltip();
    });
  }
}

// 編集可能な要素かどうかを確認
function isEditableElement(element) {
  return (
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'INPUT' && element.type === 'text' ||
    element.isContentEditable
  );
}

// 入力イベントのハンドラー
function handleInput(event) {
  const text = getElementText(event.target);

  // テキストが空、または前回と同じなら処理しない
  if (!text || text === lastText || text.length < 10) {
    hideSuggestionTooltip();
    return;
  }

  lastText = text;

  // デバウンス処理（ユーザーが入力を一時停止した時だけAPIを呼び出す）
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    analyzeText(text);
  }, 1000); // 1秒のデバウンス
}

// 要素からテキストを取得
function getElementText(element) {
  if (element.isContentEditable) {
    return element.textContent;
  } else {
    return element.value;
  }
}

// テキスト分析のためのAPI呼び出し
async function analyzeText(text) {
  try {
    // APIリクエストの前にローディング表示
    showLoadingIndicator();

    // background.jsを介してAPIリクエストを送信
    chrome.runtime.sendMessage(
      { action: 'analyzeText', text: text },
      handleAnalysisResponse
    );
  } catch (error) {
    console.error('Error analyzing text:', error);
    hideSuggestionTooltip();
  }
}

// APIレスポンスのハンドラー
function handleAnalysisResponse(response) {
  hideLoadingIndicator();

  if (!response || !response.suggestion || response.suggestion === lastText) {
    hideSuggestionTooltip();
    return;
  }

  // 修正提案があれば表示
  showSuggestion(response.suggestion, response.issues);
}

// ツールチップの作成
function createSuggestionTooltip() {
  suggestionTooltip = document.createElement('div');
  suggestionTooltip.className = 'tone-checker-tooltip';
  suggestionTooltip.style.cssText = `
    position: absolute;
    max-width: 300px;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    display: none;
  `;

  document.body.appendChild(suggestionTooltip);
}

// ローディングインジケーターの表示
function showLoadingIndicator() {
  if (!currentElement || !suggestionTooltip) return;

  suggestionTooltip.innerHTML = '<div style="text-align: center;">分析中...</div>';
  positionTooltip();
  suggestionTooltip.style.display = 'block';
}

// ローディングインジケーターの非表示
function hideLoadingIndicator() {
  // 特に何もしない（提案表示または非表示の関数が処理する）
}

// 提案の表示
function showSuggestion(suggestion, issues) {
  if (!currentElement || !suggestionTooltip) return;

  let issuesHtml = '';
  if (issues && issues.length > 0) {
    issuesHtml = `
      <div style="margin-bottom: 8px; color: #d93025;">
        <strong>検出された問題:</strong>
        <ul style="margin: 5px 0; padding-left: 20px;">
          ${issues.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  suggestionTooltip.innerHTML = `
    ${issuesHtml}
    <div style="margin-bottom: 8px;">
      <strong>提案:</strong>
      <div style="padding: 5px; background-color: #f5f5f5; border-radius: 3px; margin-top: 5px;">
        ${suggestion}
      </div>
    </div>
    <div style="text-align: right;">
      <button id="tone-checker-accept" style="
        background-color: #4285f4;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
      ">採用する</button>
      <button id="tone-checker-dismiss" style="
        background-color: transparent;
        border: none;
        padding: 5px 10px;
        cursor: pointer;
        font-size: 12px;
      ">閉じる</button>
    </div>
  `;

  // ボタンにイベントリスナーを追加
  document.getElementById('tone-checker-accept').addEventListener('click', () => {
    applyTextChange(suggestion);
    hideSuggestionTooltip();
  });

  document.getElementById('tone-checker-dismiss').addEventListener('click', () => {
    hideSuggestionTooltip();
  });

  // ツールチップの位置を設定して表示
  positionTooltip();
  suggestionTooltip.style.display = 'block';
}

// ツールチップの位置を設定
function positionTooltip() {
  if (!currentElement || !suggestionTooltip) return;

  const rect = currentElement.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  // カーソルの下に表示
  suggestionTooltip.style.top = `${rect.bottom + scrollTop + 5}px`;
  suggestionTooltip.style.left = `${rect.left + scrollLeft}px`;
}

// 提案されたテキストを適用
function applyTextChange(newText) {
  if (!currentElement) return;

  if (currentElement.isContentEditable) {
    currentElement.textContent = newText;
  } else {
    currentElement.value = newText;
  }

  // イベント発火してウェブページに変更を通知
  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });

  currentElement.dispatchEvent(inputEvent);
  currentElement.dispatchEvent(changeEvent);

  // 最新のテキストを更新
  lastText = newText;
}

// ツールチップを非表示
function hideSuggestionTooltip() {
  if (suggestionTooltip) {
    suggestionTooltip.style.display = 'none';
  }
}

// 初期化実行
initialize();
