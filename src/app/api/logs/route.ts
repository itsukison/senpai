import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { LogEntry } from '@/types/logging';

// ログ保存ディレクトリ
const LOGS_DIR = path.join(process.cwd(), 'logs');

// ディレクトリが存在しない場合は作成
async function ensureLogsDirectory() {
  try {
    await fs.access(LOGS_DIR);
  } catch {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const logEntry: LogEntry = await request.json();
    
    // IPアドレスを取得
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    
    // ログエントリにIPアドレスを追加
    logEntry.ipAddress = ipAddress;

    // ログディレクトリを確保
    await ensureLogsDirectory();

    // 日付ごとのファイル名
    const date = new Date().toISOString().split('T')[0];
    const filename = path.join(LOGS_DIR, `${date}.json`);

    // 既存のログを読み込み（ファイルがない場合は空配列）
    let logs: LogEntry[] = [];
    try {
      const fileContent = await fs.readFile(filename, 'utf-8');
      logs = JSON.parse(fileContent);
    } catch (error) {
      // ファイルが存在しない場合は空配列のまま
    }

    // 新しいログを追加
    logs.push(logEntry);

    // ファイルに保存（整形して保存）
    await fs.writeFile(filename, JSON.stringify(logs, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving log:', error);
    return NextResponse.json(
      { error: 'Failed to save log' },
      { status: 500 }
    );
  }
}