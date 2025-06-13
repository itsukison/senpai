document.addEventListener('DOMContentLoaded', () => {
  // DOM要素
  const providerSelect = document.getElementById('provider');
  const apiKeyInput = document.getElementById('apiKey');
  const systemPromptTextarea = document.getElementById('systemPrompt');
  const saveButton = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');

  // 保存されている設定を読み込む
  loadSettings();

  // 保存ボタンのイベントリスナー
  saveButton.addEventListener('click', saveSettings);

  // 設定の読み込み
  function loadSettings() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response && response.settings) {
        const settings = response.settings;
        providerSelect.value = settings.provider || 'openai';
        apiKeyInput.value = settings.apiKey || '';
        systemPromptTextarea.value = settings.systemPrompt || '';
      }
    });
  }

  // 設定の保存
  function saveSettings() {
    const settings = {
      provider: providerSelect.value,
      apiKey: apiKeyInput.value,
      systemPrompt: systemPromptTextarea.value
    };

    chrome.runtime.sendMessage(
      { action: 'saveSettings', settings: settings },
      (response) => {
        if (response && response.success) {
          showStatus('設定が保存されました', 'success');
        } else {
          showStatus('設定の保存中にエラーが発生しました', 'error');
        }
      }
    );
  }

  // ステータスメッセージの表示
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    // 3秒後に非表示
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});
