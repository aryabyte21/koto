import pc from 'picocolors';
import { getLanguageFlag, getLanguageName } from '../utils/language.js';

export interface DiffEntry {
  key: string;
  type: 'added' | 'changed' | 'removed';
  sourceValue?: string;
  oldValue?: string;
}

export interface LocaleDiff {
  locale: string;
  entries: DiffEntry[];
}

export function printDiff(diffs: LocaleDiff[]): void {
  if (diffs.length === 0) {
    console.log(`\n  ${pc.green('✓')} All translations are up to date.\n`);
    return;
  }

  let totalPending = 0;

  for (const diff of diffs) {
    const flag = getLanguageFlag(diff.locale);
    const name = getLanguageName(diff.locale);
    const added = diff.entries.filter((e) => e.type === 'added');
    const changed = diff.entries.filter((e) => e.type === 'changed');
    const removed = diff.entries.filter((e) => e.type === 'removed');

    console.log(`\n  ${flag}  ${pc.bold(name)} (${diff.locale})`);
    console.log(pc.dim('  ' + '─'.repeat(48)));

    if (added.length > 0) {
      console.log(`  ${pc.green('+')} ${pc.green(pc.bold(String(added.length)))} new key${added.length > 1 ? 's' : ''}`);
      for (const entry of added.slice(0, 10)) {
        const preview = truncate(entry.sourceValue ?? '', 50);
        console.log(`    ${pc.green('+')} ${pc.dim(entry.key)} ${pc.dim('→')} ${preview}`);
      }
      if (added.length > 10) {
        console.log(pc.dim(`    ... and ${added.length - 10} more`));
      }
    }

    if (changed.length > 0) {
      console.log(`  ${pc.yellow('~')} ${pc.yellow(pc.bold(String(changed.length)))} changed key${changed.length > 1 ? 's' : ''}`);
      for (const entry of changed.slice(0, 5)) {
        console.log(`    ${pc.yellow('~')} ${pc.dim(entry.key)}`);
      }
      if (changed.length > 5) {
        console.log(pc.dim(`    ... and ${changed.length - 5} more`));
      }
    }

    if (removed.length > 0) {
      console.log(`  ${pc.red('-')} ${pc.red(pc.bold(String(removed.length)))} removed key${removed.length > 1 ? 's' : ''}`);
    }

    totalPending += added.length + changed.length;
  }

  console.log('');
  console.log(`  ${pc.bold(String(totalPending))} key${totalPending > 1 ? 's' : ''} pending translation.`);
  console.log(`  ${pc.dim('Run')} ${pc.cyan('koto translate')} ${pc.dim('to translate.')}`);
  console.log('');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

export function printDiffJson(diffs: LocaleDiff[]): void {
  const output: Record<string, Record<string, string[]>> = {};

  for (const diff of diffs) {
    output[diff.locale] = {
      added: diff.entries.filter((e) => e.type === 'added').map((e) => e.key),
      changed: diff.entries.filter((e) => e.type === 'changed').map((e) => e.key),
      removed: diff.entries.filter((e) => e.type === 'removed').map((e) => e.key),
    };
  }

  console.log(JSON.stringify(output, null, 2));
}
