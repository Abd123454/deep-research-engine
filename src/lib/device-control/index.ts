// Device Control — cross-platform device management agent.
// Supports Windows, macOS, and Linux.
//
// SECURITY: this module is a library — it never auto-executes anything.
// Every action is invoked explicitly by an authenticated caller via
// /api/device-control (which audit-logs each invocation). The shell
// commands run via child_process with a strict timeout and a capped
// output buffer to bound the worst-case latency and memory.
//
// The commands are deliberately permissive — the agent can read/write
// files, kill processes, install packages, etc. This is by design: the
// Quaesitor desktop agent runs as the user's own account, so the
// capabilities mirror what the user could type into a terminal. The
// audit log + user consent gate (the UI must show "About to execute
// X — continue?") is the security boundary, not the library itself.

import { execSync } from "child_process";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

export type OSType = "windows" | "macos" | "linux";

export type DeviceAction =
  | "system_info"
  | "list_files"
  | "read_file"
  | "write_file"
  | "delete_file"
  | "create_directory"
  | "execute_command"
  | "install_package"
  | "list_processes"
  | "kill_process"
  | "network_status"
  | "disk_usage"
  | "env_vars"
  | "open_url"
  | "clipboard_read"
  | "clipboard_write";

export interface DeviceActionResult {
  success: boolean;
  output?: string;
  error?: string;
  action: DeviceAction;
  os: OSType;
  timestamp: string;
}

/** Canonical allow-list of supported actions. Used by the API route to
 * validate the request body before dispatching. */
export const DEVICE_ACTIONS: readonly DeviceAction[] = [
  "system_info",
  "list_files",
  "read_file",
  "write_file",
  "delete_file",
  "create_directory",
  "execute_command",
  "install_package",
  "list_processes",
  "kill_process",
  "network_status",
  "disk_usage",
  "env_vars",
  "open_url",
  "clipboard_read",
  "clipboard_write",
];

export function isDeviceAction(value: unknown): value is DeviceAction {
  return typeof value === "string" && (DEVICE_ACTIONS as readonly string[]).includes(value);
}

export function detectOS(): OSType {
  const platform = process.platform;
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  return "linux";
}

export function getSystemInfo(): Record<string, unknown> {
  return {
    os: detectOS(),
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    userInfo: os.userInfo().username,
    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
    nodeVersion: process.version,
  };
}

// Execute a shell command with timeout
export function executeCommand(
  command: string,
  options: { cwd?: string; timeout?: number; maxBuffer?: number } = {}
): DeviceActionResult {
  const osType = detectOS();
  const timeout = options.timeout || 30000; // 30s default
  const maxBuffer = options.maxBuffer || 1024 * 1024; // 1MB

  try {
    const output = execSync(command, {
      cwd: options.cwd || process.cwd(),
      timeout,
      maxBuffer,
      encoding: "utf-8",
      shell: osType === "windows" ? "powershell.exe" : "/bin/bash",
    });
    return {
      success: true,
      output: output.slice(0, 10000), // cap at 10k chars
      action: "execute_command",
      os: osType,
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string; killed?: boolean };
    return {
      success: false,
      error: error.killed
        ? `Command timed out after ${timeout}ms`
        : (error.stderr || error.message || String(err)).slice(0, 1000),
      action: "execute_command",
      os: osType,
      timestamp: new Date().toISOString(),
    };
  }
}

// List files in a directory
export function listFiles(dirPath: string): DeviceActionResult {
  try {
    const resolved = path.resolve(dirPath);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const items = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      size: entry.isFile() ? fs.statSync(path.join(resolved, entry.name)).size : 0,
    }));
    return {
      success: true,
      output: JSON.stringify(items, null, 2),
      action: "list_files",
      os: detectOS(),
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message,
      action: "list_files",
      os: detectOS(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Read file content
export function readFile(filePath: string, maxBytes = 100000): DeviceActionResult {
  try {
    const resolved = path.resolve(filePath);
    const content = fs.readFileSync(resolved, { encoding: "utf-8" });
    return {
      success: true,
      output: content.slice(0, maxBytes),
      action: "read_file",
      os: detectOS(),
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message,
      action: "read_file",
      os: detectOS(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Write file content
export function writeFile(filePath: string, content: string): DeviceActionResult {
  try {
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, { encoding: "utf-8" });
    return {
      success: true,
      output: `Written ${content.length} bytes to ${resolved}`,
      action: "write_file",
      os: detectOS(),
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message,
      action: "write_file",
      os: detectOS(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Install package (OS-specific)
export function installPackage(packageName: string): DeviceActionResult {
  const osType = detectOS();
  let command: string;

  if (osType === "windows") {
    command = `winget install ${packageName} --accept-package-agreements --accept-source-agreements`;
  } else if (osType === "macos") {
    command = `brew install ${packageName}`;
  } else {
    // Linux — try apt first, then dnf, then pacman
    command = `which apt-get >/dev/null 2>&1 && sudo apt-get install -y ${packageName} || which dnf >/dev/null 2>&1 && sudo dnf install -y ${packageName} || which pacman >/dev/null 2>&1 && sudo pacman -S --noconfirm ${packageName}`;
  }

  return executeCommand(command, { timeout: 120000 }); // 2min for installs
}

// List running processes
export function listProcesses(): DeviceActionResult {
  const osType = detectOS();
  const command =
    osType === "windows"
      ? "tasklist /FO CSV /NH"
      : osType === "macos"
      ? "ps aux"
      : "ps aux --sort=-%mem | head -50";

  return executeCommand(command);
}

// Kill process by PID
export function killProcess(pid: number): DeviceActionResult {
  const osType = detectOS();
  const command =
    osType === "windows"
      ? `taskkill /PID ${pid} /F`
      : `kill ${pid}`;

  return executeCommand(command);
}

// Network status
export function networkStatus(): DeviceActionResult {
  const osType = detectOS();
  const command =
    osType === "windows"
      ? "ipconfig /all"
      : "ifconfig 2>/dev/null || ip addr show";

  return executeCommand(command);
}

// Disk usage
export function diskUsage(): DeviceActionResult {
  const osType = detectOS();
  const command =
    osType === "windows"
      ? "wmic logicaldisk get size,freespace,caption"
      : "df -h";

  return executeCommand(command);
}

// Open URL in default browser
export function openUrl(url: string): DeviceActionResult {
  const osType = detectOS();
  const command =
    osType === "windows"
      ? `start ${url}`
      : osType === "macos"
      ? `open ${url}`
      : `xdg-open ${url}`;

  return executeCommand(command);
}

// Clipboard read
export function clipboardRead(): DeviceActionResult {
  const osType = detectOS();
  const command =
    osType === "windows"
      ? "powershell -command Get-Clipboard"
      : osType === "macos"
      ? "pbpaste"
      : "xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null";

  return executeCommand(command);
}

// Clipboard write
export function clipboardWrite(text: string): DeviceActionResult {
  const osType = detectOS();
  // Escape the text for shell
  const escaped = text.replace(/'/g, "'\\''");
  const command =
    osType === "windows"
      ? `powershell -command "Set-Clipboard -Value '${escaped}'"`
      : osType === "macos"
      ? `echo '${escaped}' | pbcopy`
      : `echo '${escaped}' | xclip -selection clipboard 2>/dev/null || echo '${escaped}' | xsel --clipboard --input 2>/dev/null`;

  return executeCommand(command);
}

// Main dispatcher
export function executeDeviceAction(
  action: DeviceAction,
  params: Record<string, unknown>
): DeviceActionResult {
  switch (action) {
    case "system_info":
      return { success: true, output: JSON.stringify(getSystemInfo(), null, 2), action, os: detectOS(), timestamp: new Date().toISOString() };
    case "list_files":
      return listFiles(String(params.path || "."));
    case "read_file":
      return readFile(String(params.path || ""));
    case "write_file":
      return writeFile(String(params.path || ""), String(params.content || ""));
    case "delete_file": {
      try {
        fs.unlinkSync(path.resolve(String(params.path || "")));
        return { success: true, output: "File deleted", action, os: detectOS(), timestamp: new Date().toISOString() };
      } catch (err) {
        return { success: false, error: (err as Error).message, action, os: detectOS(), timestamp: new Date().toISOString() };
      }
    }
    case "create_directory":
      try {
        fs.mkdirSync(path.resolve(String(params.path || "")), { recursive: true });
        return { success: true, output: "Directory created", action, os: detectOS(), timestamp: new Date().toISOString() };
      } catch (err) {
        return { success: false, error: (err as Error).message, action, os: detectOS(), timestamp: new Date().toISOString() };
      }
    case "execute_command":
      return executeCommand(String(params.command || ""), { cwd: params.cwd ? String(params.cwd) : undefined, timeout: params.timeout ? Number(params.timeout) : undefined });
    case "install_package":
      return installPackage(String(params.package || ""));
    case "list_processes":
      return listProcesses();
    case "kill_process":
      return killProcess(Number(params.pid || 0));
    case "network_status":
      return networkStatus();
    case "disk_usage":
      return diskUsage();
    case "env_vars":
      return executeCommand(detectOS() === "windows" ? "set" : "env");
    case "open_url":
      return openUrl(String(params.url || ""));
    case "clipboard_read":
      return clipboardRead();
    case "clipboard_write":
      return clipboardWrite(String(params.text || ""));
    default:
      return { success: false, error: `Unknown action: ${action}`, action, os: detectOS(), timestamp: new Date().toISOString() };
  }
}
