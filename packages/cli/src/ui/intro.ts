import pc from 'picocolors';

const LOGO = `
  ╦╔═  ╔═╗  ╔╦╗  ╔═╗
  ╠╩╗  ║ ║   ║   ║ ║
  ╩ ╩  ╚═╝   ╩   ╚═╝`;

export function printIntro(version: string): void {
  console.log(pc.cyan(LOGO));
  console.log(pc.dim(`  v${version} — context-aware i18n\n`));
}

export function printCompact(version: string): void {
  console.log(`\n  ${pc.cyan(pc.bold('koto'))} ${pc.dim(`v${version}`)}\n`);
}
