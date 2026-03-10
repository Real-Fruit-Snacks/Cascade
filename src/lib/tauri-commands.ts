import { invoke } from '@tauri-apps/api/core';
import type { FileEntry } from '../types/index';

export function openVault(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('open_vault', { path });
}

export function listFiles(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('list_files', { path });
}

export function readFile(vaultRoot: string, path: string): Promise<string> {
  return invoke<string>('read_file', { vaultRoot, path });
}

export function readFileBinary(vaultRoot: string, path: string): Promise<number[]> {
  return invoke<number[]>('read_file_binary', { vaultRoot, path });
}

export function writeFile(vaultRoot: string, path: string, content: string): Promise<void> {
  return invoke<void>('write_file', { vaultRoot, path, content });
}

export function createFile(vaultRoot: string, path: string): Promise<void> {
  return invoke<void>('create_file', { vaultRoot, path });
}

export function deleteFile(vaultRoot: string, path: string): Promise<void> {
  return invoke<void>('delete_file', { vaultRoot, path });
}

export function trashFile(vaultRoot: string, path: string): Promise<string> {
  return invoke<string>('trash_file', { vaultRoot, path });
}

export function createFolder(vaultRoot: string, path: string): Promise<void> {
  return invoke<void>('create_folder', { vaultRoot, path });
}

export function renameFile(vaultRoot: string, oldPath: string, newPath: string): Promise<void> {
  return invoke<void>('rename_file', { vaultRoot, oldPath, newPath });
}

export function moveFile(vaultRoot: string, srcPath: string, destDir: string): Promise<string> {
  return invoke<string>('move_file', { vaultRoot, srcPath, destDir });
}

export function exportFile(vaultRoot: string, path: string, content: string): Promise<void> {
  return invoke<void>('export_file', { vaultRoot, path, content });
}

export interface SearchMatch {
  filePath: string;
  lineNumber: number;
  lineText: string;
}

export function searchVault(
  vaultRoot: string,
  query: string,
  useRegex = false,
  caseSensitive = false,
  wholeWord = false,
): Promise<SearchMatch[]> {
  return invoke<SearchMatch[]>('search_vault', { vaultRoot, query, useRegex, caseSensitive, wholeWord });
}

export interface ReplaceResult {
  filesChanged: number;
  totalReplacements: number;
}

export function replaceInFiles(
  vaultRoot: string,
  query: string,
  replacement: string,
  filePaths: string[],
  useRegex = false,
  caseSensitive = false,
  wholeWord = false,
): Promise<ReplaceResult> {
  return invoke<ReplaceResult>('replace_in_files', { vaultRoot, query, replacement, filePaths, useRegex, caseSensitive, wholeWord });
}

export function saveAttachment(vaultRoot: string, folder: string, filename: string, data: number[]): Promise<string> {
  return invoke<string>('save_attachment', { vaultRoot, folder, filename, data });
}

export function copyTemplateFolder(vaultRoot: string, templatePath: string, destPath: string): Promise<string[]> {
  return invoke<string[]>('copy_template_folder', { vaultRoot, templatePath, destPath });
}

export function listPlugins(vaultRoot: string): Promise<string[]> {
  return invoke<string[]>('list_plugins', { vaultRoot });
}

export function readVaultSettings(vaultRoot: string): Promise<string> {
  return invoke<string>('read_vault_settings', { vaultRoot });
}

export function writeVaultSettings(vaultRoot: string, settings: string): Promise<void> {
  return invoke<void>('write_vault_settings', { vaultRoot, settings });
}

export interface VaultIndex {
  tagIndex: Record<string, string[]>;
  backlinkIndex: Record<string, string[]>;
}

export function buildIndex(vaultRoot: string): Promise<VaultIndex> {
  return invoke<VaultIndex>('build_index', { vaultRoot });
}

export interface HistoryEntry {
  timestamp: number;
  size: number;
}

export function listFileHistory(vaultRoot: string, path: string): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>('list_file_history', { vaultRoot, path });
}

export function readFileHistory(vaultRoot: string, path: string, timestamp: number): Promise<string> {
  return invoke<string>('read_file_history', { vaultRoot, path, timestamp });
}

export interface ObsidianConfig {
  detected: boolean;
  themeMode: string | null;
  baseFontSize: number | null;
  vimMode: boolean | null;
  showLineNumber: boolean | null;
  spellcheck: boolean | null;
  attachmentFolderPath: string | null;
  newFileLocation: string | null;
  templateFolder: string | null;
  hotkeys: Record<string, string>;
}

export function readObsidianConfig(vaultRoot: string): Promise<ObsidianConfig> {
  return invoke<ObsidianConfig>('read_obsidian_config', { vaultRoot });
}

export interface ImportResult {
  filesImported: number;
  filesSkipped: number;
  errors: string[];
}

export function importNotionExport(vaultRoot: string, exportPath: string): Promise<ImportResult> {
  return invoke<ImportResult>('import_notion_export', { vaultRoot, exportPath });
}

export function importRoamExport(vaultRoot: string, exportPath: string): Promise<ImportResult> {
  return invoke<ImportResult>('import_roam_export', { vaultRoot, exportPath });
}

export function importBearExport(vaultRoot: string, exportPath: string): Promise<ImportResult> {
  return invoke<ImportResult>('import_bear_export', { vaultRoot, exportPath });
}

export function listCustomThemes(vaultRoot: string): Promise<string[]> {
  return invoke<string[]>('list_custom_themes', { vaultRoot });
}

export function saveCustomTheme(vaultRoot: string, filename: string, content: string): Promise<void> {
  return invoke<void>('save_custom_theme', { vaultRoot, filename, content });
}

export function deleteCustomTheme(vaultRoot: string, filename: string): Promise<void> {
  return invoke<void>('delete_custom_theme', { vaultRoot, filename });
}

export interface PropertyQuery {
  output: string;
  fields: string[];
  fromTag?: string | null;
  fromFolder?: string | null;
  filters: QueryFilter[];
  sortBy?: string | null;
  sortOrder?: string | null;
  limit?: number | null;
}

export interface QueryFilter {
  field: string;
  operator: string;
  value: string;
}

export interface QueryResult {
  rows: QueryRow[];
  total: number;
}

export interface QueryRow {
  filePath: string;
  fileName: string;
  values: Record<string, string>;
}

export function queryProperties(vaultRoot: string, query: PropertyQuery): Promise<QueryResult> {
  return invoke<QueryResult>('query_properties', { vaultRoot, query });
}

export function readCustomDictionary(vaultRoot: string): Promise<string[]> {
  return invoke<string[]>('read_custom_dictionary', { vaultRoot });
}

export function writeCustomDictionary(vaultRoot: string, words: string[]): Promise<void> {
  return invoke<void>('write_custom_dictionary', { vaultRoot, words });
}

export function exportBinary(path: string, data: number[]): Promise<void> {
  return invoke<void>('export_binary', { path, data });
}

export function batchExport(vaultRoot: string, folderPath: string, format: string, outputPath: string): Promise<number> {
  return invoke<number>('batch_export', { vaultRoot, folderPath, format, outputPath });
}

export function computePluginChecksums(vaultRoot: string, pluginId: string): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('compute_plugin_checksums', { vaultRoot, pluginId });
}

export function writeIntegrityFile(vaultRoot: string, pluginId: string, installedFrom: string, checksums: Record<string, string>): Promise<void> {
  return invoke<void>('write_integrity_file', { vaultRoot, pluginId, installedFrom, checksums });
}

export function verifyPluginIntegrity(vaultRoot: string, pluginId: string): Promise<boolean> {
  return invoke<boolean>('verify_plugin_integrity', { vaultRoot, pluginId });
}

export function extractPluginZip(vaultRoot: string, pluginId: string, data: number[]): Promise<void> {
  return invoke<void>('extract_plugin_zip', { vaultRoot, pluginId, data });
}

// ── Git Sync ──────────────────────────────────────────────────

export interface SyncResult {
  committed_files: string[];
  conflicts: string[];
  push_status: 'pushed' | 'nothing_to_push' | 'offline';
}

export interface GitStatus {
  is_repo: boolean;
  has_remote: boolean;
  changed_files: number;
  unpushed_commits: number;
}

export function gitTestConnection(remoteUrl: string, pat: string): Promise<void> {
  return invoke<void>('git_test_connection', { remoteUrl, pat });
}

export function gitInitRepo(vaultPath: string, remoteUrl: string, pat: string): Promise<void> {
  return invoke<void>('git_init_repo', { vaultPath, remoteUrl, pat });
}

export function gitCloneRepo(vaultPath: string, remoteUrl: string, pat: string): Promise<void> {
  return invoke<void>('git_clone_repo', { vaultPath, remoteUrl, pat });
}

export function gitSync(vaultPath: string, pat: string): Promise<SyncResult> {
  return invoke<SyncResult>('git_sync', { vaultPath, pat });
}

export function gitStatus(vaultPath: string): Promise<GitStatus> {
  return invoke<GitStatus>('git_status', { vaultPath });
}

export function gitDisconnect(vaultPath: string): Promise<void> {
  return invoke<void>('git_disconnect', { vaultPath });
}

// ── Secure PAT storage ───────────────────────────────────────────

export function storeSyncPat(vaultPath: string, pat: string): Promise<void> {
  return invoke<void>('store_sync_pat', { vaultPath, pat });
}

export function readSyncPat(vaultPath: string): Promise<string> {
  return invoke<string>('read_sync_pat', { vaultPath });
}

export function deleteSyncPat(vaultPath: string): Promise<void> {
  return invoke<void>('delete_sync_pat', { vaultPath });
}
