const { spawnSync } = require('child_process');

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function getListeningPids(port) {
  const result = run('netstat', ['-ano', '-p', 'tcp']);
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || 'Unable to inspect local ports.');
  }

  const lines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const pids = new Set();

  for (const line of lines) {
    if (!line.includes('LISTENING')) {
      continue;
    }

    const parts = line.split(/\s+/);
    if (parts.length < 5) {
      continue;
    }

    const localAddress = parts[1];
    const pid = parts[parts.length - 1];
    const portSuffix = `:${port}`;

    if (
      (localAddress.endsWith(portSuffix) || localAddress.endsWith(`]:${port}`)) &&
      /^\d+$/.test(pid)
    ) {
      pids.add(pid);
    }
  }

  return [...pids];
}

function getProcessName(pid) {
  const result = run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || `Unable to inspect PID ${pid}.`);
  }

  const line = result.stdout.trim();
  if (!line || line.startsWith('INFO:')) {
    return null;
  }

  const [imageName] = line
    .replace(/^"|"$/g, '')
    .split('","');

  return imageName || null;
}

function stopNodeProcess(pid) {
  const result = run('taskkill', ['/PID', String(pid), '/T', '/F']);
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || `Unable to stop PID ${pid}.`);
  }
}

function main() {
  const port = Number(process.argv[2] || process.env.PORT || 3001);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Port must be a positive integer.');
  }

  const pids = getListeningPids(port);
  if (pids.length === 0) {
    console.log(`[free-port] Port ${port} is already free.`);
    return;
  }

  for (const pid of pids) {
    const processName = getProcessName(pid);
    if (!processName) {
      console.log(`[free-port] PID ${pid} disappeared before cleanup.`);
      continue;
    }

    if (processName.toLowerCase() !== 'node.exe') {
      throw new Error(
        `Port ${port} is owned by ${processName} (PID ${pid}). Refusing to stop a non-Node process automatically.`,
      );
    }

    console.log(`[free-port] Stopping ${processName} on port ${port} (PID ${pid}).`);
    stopNodeProcess(pid);
  }
}

try {
  main();
} catch (error) {
  console.error(
    `[free-port] ${error instanceof Error ? error.message : 'Unexpected cleanup failure.'}`,
  );
  process.exit(1);
}
