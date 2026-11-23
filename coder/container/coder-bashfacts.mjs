// WHAT A COMMAND DID WITH GIT, FOR THE POSTTOOLUSE HOOKS (the comparison sheet's "Bash: result object" and "Bash result:
// rawOutputPath, sandbox flag and git details" rows, 2026-11-23): Claude Code's Bash result carries gitOperation, with the
// commit (sha, kind committed/amended/cherry-picked, branch from git's summary line, left out on a detached HEAD), push,
// branch (merged or rebased) and pr (number, url, action). Also noOutputExpected, for a command that is silent when it
// works. Worked out from the command and what it printed; nothing is run.

const GH_PR_ACTIONS = { create: "created", edit: "edited", merge: "merged", comment: "commented", close: "closed", reopen: "reopened", ready: "ready" };

/** The gitOperation of a command that worked (code 0), or null. */
export function gitOperationOf(command, output, code) {
  if (code !== 0) return null;
  const cmd = String(command || ""), out = String(output || "");
  const op = {};
  // git's commit summary line: "[main 1a2b3c4] message", "[detached HEAD 1a2b3c4] message", "[main (root-commit) 1a2b3c4]".
  const sum = /^\[(.+?)(?: \(root-commit\))? ([0-9a-f]{7,40})\] /m.exec(out);
  const kind = /\bgit\s+(?:-[^\s]+\s+)*cherry-pick\b/.test(cmd) ? "cherry-picked" : /\bgit\s+(?:-[^\s]+\s+)*commit\b[^;&|]*--amend\b/.test(cmd) ? "amended" : /\bgit\s+(?:-[^\s]+\s+)*commit\b/.test(cmd) ? "committed" : "";
  if (kind && sum) op.commit = { sha: sum[2], kind, ...(/^detached HEAD$/.test(sum[1]) ? {} : { branch: sum[1] }) };
  if (/\bgit\s+(?:-[^\s]+\s+)*push\b/.test(cmd)) {
    const ref = /^\s*(?:\*|\+|-|=)?\s*(?:\[new branch\]|[0-9a-f]+\.\.\.?[0-9a-f]+)\s+(\S+)\s+->\s+(\S+)/m.exec(out);
    op.push = { ...(ref ? { branch: ref[2] } : {}) };
  }
  if (/\bgit\s+(?:-[^\s]+\s+)*merge\b/.test(cmd) && !/--abort\b/.test(cmd)) op.branch = { action: "merged" };
  else if (/\bgit\s+(?:-[^\s]+\s+)*rebase\b/.test(cmd) && !/--abort\b/.test(cmd)) op.branch = { action: "rebased" };
  const pr = /\bgh\s+pr\s+(create|edit|merge|comment|close|reopen|ready)\b([^;&|]*)/.exec(cmd);
  if (pr) {
    const rest = pr[2];
    const action = pr[1] === "merge" && /--auto\b/.test(rest) ? (/--disable-auto\b/.test(rest) ? "auto-merge-disabled" : "auto-merge-enabled")
      : pr[1] === "merge" && /--disable-auto\b/.test(rest) ? "auto-merge-disabled"
      : pr[1] === "ready" && /--undo\b/.test(rest) ? "draft" : GH_PR_ACTIONS[pr[1]];
    const url = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/(\d+)/.exec(out);
    const num = url ? Number(url[1]) : (/(?:^|\s)#?(\d+)(?=\s|$)/.exec(rest) || [])[1];
    op.pr = { ...(num ? { number: Number(num) } : {}), ...(url ? { url: url[0] } : {}), action };
  }
  return Object.keys(op).length ? op : null;
}

const SILENT = new Set(["mkdir", "mv", "cp", "rm", "rmdir", "touch", "chmod", "chown", "chgrp", "ln", "cd", "export", "unset", "true", "kill", "pkill"]);
/** Whether a command is one that prints nothing when it works (Claude Code's noOutputExpected): each part of a chain is. */
export function noOutputExpected(command) {
  const parts = String(command || "").split(/&&|\|\||;/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length || /[|>`$]/.test(String(command || "").replace(/\|\|/g, ""))) return false;
  return parts.every((p) => SILENT.has(p.split(/\s+/)[0]) && !/\s-[a-zA-Z]*v/.test(p));
}
