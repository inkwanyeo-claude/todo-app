// React 앱을 정적으로 빌드해 origin의 gh-pages 브랜치로 배포한다.
// GitHub Pages에는 서버를 올릴 수 없으므로 저장소는 브라우저 localStorage를 쓴다.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'web', 'dist');
const branch = process.env.PAGES_BRANCH ?? 'gh-pages';

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', ...opts, cwd: opts.cwd ?? root });
const capture = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim();

const remote = capture('git', ['remote', 'get-url', 'origin']);
const repo = remote.replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
const base = process.env.VITE_BASE ?? `/${repo.split('/')[1]}/`;

console.log(`▶ 빌드 (base=${base}, 저장소=localStorage)`);
run('npm', ['run', 'build', '--workspace', '@todo2/web'], {
  env: { ...process.env, VITE_BASE: base, VITE_STORAGE: 'local' },
});

const staging = mkdtempSync(path.join(os.tmpdir(), 'todo2-pages-'));
try {
  cpSync(dist, staging, { recursive: true });
  // Jekyll 처리를 건너뛰게 한다 (_로 시작하는 파일이 무시되는 문제 방지)
  writeFileSync(path.join(staging, '.nojekyll'), '');
  // SPA 딥링크가 404로 떨어지지 않도록 404.html에 같은 문서를 둔다
  cpSync(path.join(staging, 'index.html'), path.join(staging, '404.html'));

  const name = capture('git', ['config', 'user.name']);
  const email = capture('git', ['config', 'user.email']);
  const stamp = new Date().toISOString();

  const git = (...args) => run('git', ['-c', `user.name=${name}`, '-c', `user.email=${email}`, ...args], { cwd: staging });

  git('init', '-q', '-b', branch);
  git('add', '-A');
  git('commit', '-q', '-m', `deploy: ${stamp}`);
  console.log(`▶ ${branch} 브랜치로 푸시 → ${repo}`);
  git('push', '-q', '--force', remote, `${branch}:${branch}`);

  console.log(`✅ 배포 완료 → https://${repo.split('/')[0]}.github.io${base}`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
