/**
 * POWERSHELL, READ BY POWERSHELL ITSELF (Bash docs pass 7; Claude Code 2.1.322's PowerShell checks, copied).
 *
 * Claude Code never judges a PowerShell command by its text: PowerShell's own parser reads it first and says what it
 * holds (its statements, every command in them at any depth, sub-expressions, script blocks, .NET calls, variables, type
 * names, redirections), and Claude Code's checks read that. This file is that: Claude Code's parse script word for word,
 * run with pwsh the way Claude Code runs it ("-NoProfile -NonInteractive -NoLogo -EncodedCommand <script>", the command in
 * base64 on stdin), its step that turns the parser's answer into commands, and its safety checks with their own words.
 * A command PowerShell cannot parse is never run unasked (Claude Code: "Could not parse command for security analysis").
 * No node imports: Coder's machine (coder-tools.mjs runs pwsh) and its loop (coder-perms.mjs decides) both use it.
 */

/** Claude Code's parse script (2.1.322), word for word. */
export const PS_PARSE_SCRIPT = "function Write-Result($Json) {\n    [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Json))\n}\n$EncodedCommand = [Console]::In.ReadToEnd()\nif (-not $EncodedCommand) {\n    Write-Result '{\"valid\":false,\"errors\":[{\"message\":\"No command provided\",\"errorId\":\"NoInput\"}],\"statements\":[],\"variables\":[],\"hasStopParsing\":false,\"originalCommand\":\"\"}'\n    exit 0\n}\n\n$Command = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($EncodedCommand))\n\n$tokens = $null\n$parseErrors = $null\n$ast = [System.Management.Automation.Language.Parser]::ParseInput(\n    $Command,\n    [ref]$tokens,\n    [ref]$parseErrors\n)\n\n$allVariables = [System.Collections.ArrayList]::new()\n\nfunction Get-RawCommandElements {\n    param([System.Management.Automation.Language.CommandAst]$CmdAst)\n    $elems = [System.Collections.ArrayList]::new()\n    foreach ($ce in $CmdAst.CommandElements) {\n        $ceData = @{ type = $ce.GetType().Name; text = $ce.Extent.Text }\n        if ($ce.PSObject.Properties['Value'] -and $null -ne $ce.Value -and $ce.Value -is [string]) {\n            $ceData.value = $ce.Value\n        }\n        if ($ce -is [System.Management.Automation.Language.CommandExpressionAst]) {\n            $ceData.expressionType = $ce.Expression.GetType().Name\n        }\n        $a=$ce.Argument;if($a){$ceData.children=@(@{type=$a.GetType().Name;text=$a.Extent.Text})}\n        [void]$elems.Add($ceData)\n    }\n    return $elems\n}\n\nfunction Get-RawRedirections {\n    param($Redirections)\n    $result = [System.Collections.ArrayList]::new()\n    foreach ($redir in $Redirections) {\n        $redirData = @{ type = $redir.GetType().Name }\n        if ($redir -is [System.Management.Automation.Language.FileRedirectionAst]) {\n            $redirData.append = [bool]$redir.Append\n            $redirData.fromStream = $redir.FromStream.ToString()\n            $redirData.locationText = $redir.Location.Extent.Text\n        }\n        [void]$result.Add($redirData)\n    }\n    return $result\n}\n\nfunction Get-SecurityPatterns($A) {\n    $p = @{}\n    foreach ($n in $A.FindAll({ param($x)\n        $x -is [System.Management.Automation.Language.MemberExpressionAst] -or\n        $x -is [System.Management.Automation.Language.SubExpressionAst] -or\n        $x -is [System.Management.Automation.Language.ArrayExpressionAst] -or\n        $x -is [System.Management.Automation.Language.ExpandableStringExpressionAst] -or\n        $x -is [System.Management.Automation.Language.ScriptBlockExpressionAst] -or\n        $x -is [System.Management.Automation.Language.ParenExpressionAst]\n    }, $true)) { switch ($n.GetType().Name) {\n        'InvokeMemberExpressionAst' { $p.hasMemberInvocations = $true }\n        'MemberExpressionAst' { $p.hasMemberInvocations = $true }\n        'SubExpressionAst' { $p.hasSubExpressions = $true }\n        'ArrayExpressionAst' { $p.hasSubExpressions = $true }\n        'ParenExpressionAst' { $p.hasSubExpressions = $true }\n        'ExpandableStringExpressionAst' { $p.hasExpandableStrings = $true }\n        'ScriptBlockExpressionAst' { $p.hasScriptBlocks = $true }\n    }}\n    if ($p.Count -gt 0) { return $p }\n    return $null\n}\n\n$varExprs = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.VariableExpressionAst] }, $true)\nforeach ($v in $varExprs) {\n    [void]$allVariables.Add(@{\n        path = $v.VariablePath.ToString()\n        isSplatted = [bool]$v.Splatted\n    })\n}\n\n$typeLiterals = [System.Collections.ArrayList]::new()\nforeach ($t in $ast.FindAll({ param($n)\n    $n -is [System.Management.Automation.Language.TypeExpressionAst] -or\n    $n -is [System.Management.Automation.Language.TypeConstraintAst]\n}, $true)) { [void]$typeLiterals.Add($t.TypeName.FullName) }\n\n$hasStopParsing = $false\nforeach ($tok in $tokens) {\n    $norm = $tok.Text -replace '[\\u2013\\u2014\\u2015]','-' -replace '[`''\"\"\\u2018-\\u201f]',''\n    if ($norm -eq '--%') {\n        $hasStopParsing = $true; break\n    }\n}\n\n$statements = [System.Collections.ArrayList]::new()\n$script:hasBg = $false\nforeach ($p in $ast.FindAll({param($n) $n -is [System.Management.Automation.Language.PipelineBaseAst]}, $true)) {\n    if ($p.PSObject.Properties['Background'] -and $p.Background) { $script:hasBg = $true; break }\n}\n\nfunction Process-BlockStatements {\n    param($Block)\n    if (-not $Block) { return }\n\n    foreach ($stmt in $Block.Statements) {\n        $statement = @{\n            type = $stmt.GetType().Name\n            text = $stmt.Extent.Text\n        }\n\n        if ($stmt -is [System.Management.Automation.Language.PipelineAst]) {\n            $elements = [System.Collections.ArrayList]::new()\n            foreach ($element in $stmt.PipelineElements) {\n                $elemData = @{\n                    type = $element.GetType().Name\n                    text = $element.Extent.Text\n                }\n\n                if ($element -is [System.Management.Automation.Language.CommandAst]) {\n                    $elemData.commandElements = @(Get-RawCommandElements -CmdAst $element)\n                    $elemData.redirections = @(Get-RawRedirections -Redirections $element.Redirections)\n                } elseif ($element -is [System.Management.Automation.Language.CommandExpressionAst]) {\n                    $elemData.expressionType = $element.Expression.GetType().Name\n                    $elemData.redirections = @(Get-RawRedirections -Redirections $element.Redirections)\n                }\n\n                [void]$elements.Add($elemData)\n            }\n            $statement.elements = @($elements)\n\n            $allNestedCmds = $stmt.FindAll(\n                { param($node) $node -is [System.Management.Automation.Language.CommandAst] },\n                $true\n            )\n            $nestedCmds = [System.Collections.ArrayList]::new()\n            foreach ($cmd in $allNestedCmds) {\n                if ($cmd.Parent -eq $stmt) { continue }\n                $nested = @{\n                    type = $cmd.GetType().Name\n                    text = $cmd.Extent.Text\n                    commandElements = @(Get-RawCommandElements -CmdAst $cmd)\n                    redirections = @(Get-RawRedirections -Redirections $cmd.Redirections)\n                }\n                [void]$nestedCmds.Add($nested)\n            }\n            if ($nestedCmds.Count -gt 0) {\n                $statement.nestedCommands = @($nestedCmds)\n            }\n            $r = $stmt.FindAll({param($n) $n -is [System.Management.Automation.Language.FileRedirectionAst]}, $true)\n            if ($r.Count -gt 0) {\n                $rr = @(Get-RawRedirections -Redirections $r)\n                $statement.redirections = if ($statement.redirections) { @($statement.redirections) + $rr } else { $rr }\n            }\n        } else {\n            $nestedCmdAsts = $stmt.FindAll(\n                { param($node) $node -is [System.Management.Automation.Language.CommandAst] },\n                $true\n            )\n            $nested = [System.Collections.ArrayList]::new()\n            foreach ($cmd in $nestedCmdAsts) {\n                [void]$nested.Add(@{\n                    type = 'CommandAst'\n                    text = $cmd.Extent.Text\n                    commandElements = @(Get-RawCommandElements -CmdAst $cmd)\n                    redirections = @(Get-RawRedirections -Redirections $cmd.Redirections)\n                })\n            }\n            if ($nested.Count -gt 0) {\n                $statement.nestedCommands = @($nested)\n            }\n            $r = $stmt.FindAll({param($n) $n -is [System.Management.Automation.Language.FileRedirectionAst]}, $true)\n            if ($r.Count -gt 0) { $statement.redirections = @(Get-RawRedirections -Redirections $r) }\n        }\n\n        $sp = Get-SecurityPatterns $stmt\n        if ($sp) { $statement.securityPatterns = $sp }\n\n        [void]$statements.Add($statement)\n    }\n\n    if ($Block.Traps) {\n        foreach ($trap in $Block.Traps) {\n            $statement = @{\n                type = 'TrapStatementAst'\n                text = $trap.Extent.Text\n            }\n            $nestedCmdAsts = $trap.FindAll(\n                { param($node) $node -is [System.Management.Automation.Language.CommandAst] },\n                $true\n            )\n            $nestedCmds = [System.Collections.ArrayList]::new()\n            foreach ($cmd in $nestedCmdAsts) {\n                $nested = @{\n                    type = $cmd.GetType().Name\n                    text = $cmd.Extent.Text\n                    commandElements = @(Get-RawCommandElements -CmdAst $cmd)\n                    redirections = @(Get-RawRedirections -Redirections $cmd.Redirections)\n                }\n                [void]$nestedCmds.Add($nested)\n            }\n            if ($nestedCmds.Count -gt 0) {\n                $statement.nestedCommands = @($nestedCmds)\n            }\n            $r = $trap.FindAll({param($n) $n -is [System.Management.Automation.Language.FileRedirectionAst]}, $true)\n            if ($r.Count -gt 0) { $statement.redirections = @(Get-RawRedirections -Redirections $r) }\n            $sp = Get-SecurityPatterns $trap\n            if ($sp) { $statement.securityPatterns = $sp }\n            [void]$statements.Add($statement)\n        }\n    }\n}\n\nProcess-BlockStatements -Block $ast.BeginBlock\nProcess-BlockStatements -Block $ast.ProcessBlock\nProcess-BlockStatements -Block $ast.EndBlock\nProcess-BlockStatements -Block $ast.CleanBlock\nProcess-BlockStatements -Block $ast.DynamicParamBlock\n\nif ($ast.ParamBlock) {\n  $pb = $ast.ParamBlock\n  $pn = [System.Collections.ArrayList]::new()\n  foreach ($c in $pb.FindAll({param($n) $n -is [System.Management.Automation.Language.CommandAst]}, $true)) {\n    [void]$pn.Add(@{type='CommandAst';text=$c.Extent.Text;commandElements=@(Get-RawCommandElements -CmdAst $c);redirections=@(Get-RawRedirections -Redirections $c.Redirections)})\n  }\n  $pr = $pb.FindAll({param($n) $n -is [System.Management.Automation.Language.FileRedirectionAst]}, $true)\n  $ps = Get-SecurityPatterns $pb\n  $st = @{type='ParamBlockAst';text=$pb.Extent.Text}\n  if ($pn.Count -gt 0) { $st.nestedCommands = @($pn) }\n  if ($pr.Count -gt 0) { $st.redirections = @(Get-RawRedirections -Redirections $pr) }\n  if ($ps) { $st.securityPatterns = $ps }\n  [void]$statements.Add($st)\n}\n\n$hasUsingStatements = $ast.UsingStatements -and $ast.UsingStatements.Count -gt 0\n$hasScriptRequirements = $ast.ScriptRequirements -ne $null\n\n$output = @{\n    valid = ($parseErrors.Count -eq 0)\n    errors = @($parseErrors | ForEach-Object {\n        @{\n            message = $_.Message\n            errorId = $_.ErrorId\n        }\n    })\n    statements = @($statements)\n    variables = @($allVariables)\n    hasStopParsing = $hasStopParsing\n    originalCommand = $Command\n    typeLiterals = @($typeLiterals)\n    hasUsingStatements = [bool]$hasUsingStatements\n    hasScriptRequirements = [bool]$hasScriptRequirements\n    hasBackgroundJob = [bool]$script:hasBg\n}\n\nWrite-Result ($output | ConvertTo-Json -Depth 10 -Compress)\n";

/** Claude Code's limits: the longest command it parses, each try's time (CLAUDE_CODE_PWSH_PARSE_TIMEOUT_MS, here CODER_), and tries. */
export const PS_PARSE_MAX = 32767, PS_PARSE_TIMEOUT_MS = 5000, PS_PARSE_TRIES = 2;
/** Failures worth parsing again later (Claude Code drops these from its cache). */
export const PS_PARSE_RETRYABLE = new Set(["PwshSpawnError", "PwshError", "PwshTimeout", "EmptyOutput", "InvalidJson", "InputMismatch", "EncodeError", "UnexpectedError"]);

const utf16b64 = (s) => Buffer.from(String(s), "utf16le").toString("base64");
/** A command that could not be parsed, as Claude Code records one. */
export const psParseFail = (command, message, errorId) => ({ valid: false, statements: [], variables: [], hasStopParsing: false, errors: [{ message, errorId }], originalCommand: command });

/** How to run the parser for a command: pwsh's arguments and what goes on its stdin; or why it is not parsed at all. */
export function psParseRequest(command) {
  const c = String(command ?? "");
  const n = Buffer.byteLength(c, "utf8");
  if (n > PS_PARSE_MAX) return { fail: psParseFail(c, `Command too long for parsing (${n} bytes). Maximum supported length is ${PS_PARSE_MAX} bytes.`, "CommandTooLong") };
  if (/`u\{[0-9A-Fa-f]/.test(c)) return { fail: psParseFail(c, "PowerShell `u{HEX} codepoint escape is runtime-resolved and cannot be statically validated.", "UnicodeCodepointEscape") };
  return { args: ["-NoProfile", "-NonInteractive", "-NoLogo", "-EncodedCommand", utf16b64(PS_PARSE_SCRIPT)], input: Buffer.from(c, "utf8").toString("base64") };
}

/**
 * THE PARSER'S ANSWER, read as Claude Code reads it: `run` is what pwsh did ({ noPwsh, spawnError, timedOut, timeoutMs,
 * code, stdout, stderr }); its stdout is the parse in base64 JSON, which must be of this very command.
 */
export function psParseResult(command, run) {
  const c = String(command ?? "");
  if (!run || run.noPwsh) return psParseFail(c, "PowerShell is not available", "NoPowerShell");
  if (run.spawnError) return psParseFail(c, `Failed to spawn PowerShell: ${run.spawnError}`, "PwshSpawnError");
  if (run.timedOut) return psParseFail(c, `pwsh timed out after ${run.timeoutMs || PS_PARSE_TIMEOUT_MS}ms (2 attempts)`, "PwshTimeout");
  if (run.code !== 0) return psParseFail(c, `pwsh exited with code ${run.code}: ${String(run.stderr || "").slice(0, 2000)}`, "PwshError");
  const out = String(run.stdout || "").trim();
  if (!out) return psParseFail(c, "No output from PowerShell parser", "EmptyOutput");
  try {
    const raw = JSON.parse(Buffer.from(out, "base64").toString("utf8"));
    if (!raw || raw.originalCommand !== c) return psParseFail(c, "PowerShell parser did not receive the command intact", "InputMismatch");
    return psTransform(raw);
  } catch { return psParseFail(c, "Invalid JSON from PowerShell parser", "InvalidJson"); }
}

// ── THE PARSE, AS COMMANDS (Claude Code's own steps) ─────────────────────────────────────────────────────────────────
const VE = (e) => (e === undefined || e === null ? [] : Array.isArray(e) ? e : [e]);
const STATEMENTS = new Set(["PipelineAst", "PipelineChainAst", "AssignmentStatementAst", "IfStatementAst", "ForStatementAst", "ForEachStatementAst", "WhileStatementAst", "DoWhileStatementAst", "DoUntilStatementAst", "SwitchStatementAst", "TryStatementAst", "TrapStatementAst", "FunctionDefinitionAst", "DataStatementAst"]);
const statementType = (t) => (STATEMENTS.has(t) ? t : "UnknownStatementAst");
/** What an element is, in Claude Code's words (ScriptBlock, SubExpression, ExpandableString, MemberInvocation, …). */
function elementKind(t, inner) {
  switch (t) {
    case "ScriptBlockExpressionAst": return "ScriptBlock";
    case "SubExpressionAst": case "ArrayExpressionAst": case "ParenExpressionAst": return "SubExpression";
    case "ExpandableStringExpressionAst": return "ExpandableString";
    case "InvokeMemberExpressionAst": case "MemberExpressionAst": return "MemberInvocation";
    case "VariableExpressionAst": return "Variable";
    case "StringConstantExpressionAst": case "ConstantExpressionAst": return "StringConstant";
    case "CommandParameterAst": return "Parameter";
    case "CommandExpressionAst": return inner ? elementKind(inner) : "Other";
    default: return "Other";
  }
}
/** A command's name kind: a cmdlet (Verb-Noun), an application (a path or a name with a dot), or unknown. */
export function psNameType(e) {
  if (/^[A-Za-z]+-[A-Za-z][A-Za-z0-9_]*$/.test(e)) return "cmdlet";
  if (/[.\\/]/.test(e)) return "application";
  return "unknown";
}
function baseName(e) {
  const n = e.lastIndexOf("\\");
  if (n < 0) return e;
  if (/^[A-Za-z]:/.test(e) || e.startsWith("\\\\") || e.startsWith(".\\") || e.startsWith("..\\")) return e;
  const r = e.substring(n + 1);
  return r === "" ? e : r;
}
const dashes = (s) => String(s ?? "").replace(/[–—―]/g, "-");
function commandOf(e) {
  const n = VE(e.commandElements);
  let name = "", nameType = "unknown", kids = false;
  const args = [], kinds = [], children = [];
  if (n.length > 0) {
    const first = n[0];
    const raw = ((first.type === "StringConstantExpressionAst" || first.type === "ExpandableStringExpressionAst") && typeof first.value === "string" ? first.value : String(first.text ?? "")).replace(/^['"]|['"]$/g, "");
    nameType = /[\u0080-￿]/.test(raw) ? "application" : psNameType(raw);
    name = dashes(baseName(raw));
    kinds.push(elementKind(first.type, first.expressionType));
    for (let i = 1; i < n.length; i++) {
      const x = n[i];
      const str = x.type === "StringConstantExpressionAst" || x.type === "ExpandableStringExpressionAst";
      args.push(dashes(str && x.value != null ? x.value : x.text));
      kinds.push(elementKind(x.type, x.expressionType));
      const ch = VE(x.children);
      if (ch.length > 0) { kids = true; children.push(ch.map((v) => ({ type: elementKind(v.type), text: dashes(v.text) }))); }
      else children.push(undefined);
    }
  }
  const text = dashes(e.text);
  const out = { name, nameType, elementType: "CommandAst", args, text, elementTypes: kinds, ...(kids ? { children } : {}), ...(text !== e.text ? { dashFolded: true } : {}) };
  const red = VE(e.redirections);
  if (red.length > 0) out.redirections = red.map(redirectionOf);
  return out;
}
function exprOf(e) {
  return { name: dashes(e.text), nameType: "unknown", elementType: e.type === "ParenExpressionAst" ? "ParenExpressionAst" : "CommandExpressionAst", args: [], text: dashes(e.text), elementTypes: [elementKind(e.type, e.expressionType)] };
}
function redirectionOf(e) {
  if (e.type === "MergingRedirectionAst") return { operator: "2>&1", target: "", isMerging: true };
  const app = e.append ?? false, from = e.fromStream ?? "Output";
  const op = app ? (from === "Error" ? "2>>" : from === "All" ? "*>>" : ">>") : (from === "Error" ? "2>" : from === "All" ? "*>" : ">");
  return { operator: op, target: e.locationText ?? "", isMerging: false };
}
function statementOf(e) {
  const commands = [], redirections = [];
  if (e.elements) {
    for (const h of VE(e.elements)) {
      commands.push(h.type === "CommandAst" ? commandOf(h) : exprOf(h));
      for (const k of VE(h.redirections)) redirections.push(redirectionOf(k));
    }
    const seen = new Set(redirections.map((h) => h.operator + "\x00" + h.target));
    for (const h of VE(e.redirections)) { const k = redirectionOf(h), key = k.operator + "\x00" + k.target; if (!seen.has(key)) { seen.add(key); redirections.push(k); } }
  } else {
    commands.push({ name: dashes(e.text), nameType: "unknown", elementType: "CommandExpressionAst", args: [], text: dashes(e.text) });
    for (const w of VE(e.redirections)) redirections.push(redirectionOf(w));
  }
  const nested = VE(e.nestedCommands);
  const out = { statementType: statementType(e.type), commands, redirections, text: dashes(e.text), nestedCommands: nested.length > 0 ? nested.map(commandOf) : undefined };
  if (e.securityPatterns) out.securityPatterns = e.securityPatterns;
  return out;
}
/** The parser's JSON as Claude Code keeps it. */
export function psTransform(e) {
  const n = { valid: e.valid === true, errors: VE(e.errors), statements: VE(e.statements).map(statementOf), variables: VE(e.variables), hasStopParsing: e.hasStopParsing === true, originalCommand: e.originalCommand };
  const types = VE(e.typeLiterals);
  if (types.length > 0) n.typeLiterals = types;
  if (e.hasUsingStatements) n.hasUsingStatements = true;
  if (e.hasScriptRequirements) n.hasScriptRequirements = true;
  if (e.hasBackgroundJob) n.hasBackgroundJob = true;
  return n;
}

/** Every command, at every depth (Claude Code's own list: each statement's, then the ones nested in it). */
export function psCommands(p) {
  const out = [];
  for (const s of (p && p.statements) || []) { for (const c of s.commands) out.push(c); if (s.nestedCommands) for (const c of s.nestedCommands) out.push(c); }
  return out;
}
/** Every redirection, at every depth. */
export function psRedirections(p) {
  const out = [];
  for (const s of (p && p.statements) || []) { for (const r of s.redirections) out.push(r); if (s.nestedCommands) for (const c of s.nestedCommands) if (c.redirections) for (const r of c.redirections) out.push(r); }
  return out;
}
const nullTarget = (t) => { const n = String(t).trim().toLowerCase(); return n === "$null" || n === "${null}"; };
/** The redirections that write a file (not a stream merge, not $null). */
export const psFileRedirections = (p) => psRedirections(p).filter((r) => !r.isMerging && !nullTarget(r.target));
/** What the command holds that cannot be checked by reading it (Claude Code's own flags). */
export function psPatterns(p) {
  const n = { hasSubExpressions: false, hasScriptBlocks: false, hasSplatting: false, hasExpandableStrings: false, hasMemberInvocations: false, hasAssignments: false, hasStopParsing: !!(p && p.hasStopParsing) };
  const look = (c) => { for (const k of c.elementTypes || []) { if (k === "ScriptBlock") n.hasScriptBlocks = true; else if (k === "SubExpression") n.hasSubExpressions = true; else if (k === "ExpandableString") n.hasExpandableStrings = true; else if (k === "MemberInvocation") n.hasMemberInvocations = true; } };
  for (const s of (p && p.statements) || []) {
    if (s.statementType === "AssignmentStatementAst") n.hasAssignments = true;
    for (const c of s.commands) look(c);
    if (s.nestedCommands) for (const c of s.nestedCommands) look(c);
    const sp = s.securityPatterns;
    if (sp) { if (sp.hasMemberInvocations) n.hasMemberInvocations = true; if (sp.hasSubExpressions) n.hasSubExpressions = true; if (sp.hasExpandableStrings) n.hasExpandableStrings = true; if (sp.hasScriptBlocks) n.hasScriptBlocks = true; }
  }
  for (const v of (p && p.variables) || []) if (v && v.isSplatted) { n.hasSplatting = true; break; }
  return n;
}

/** PowerShell's aliases, as Claude Code resolves them. */
export const PS_CC_ALIASES = Object.freeze(Object.assign(Object.create(null), { ls: "Get-ChildItem", dir: "Get-ChildItem", gci: "Get-ChildItem", cat: "Get-Content", type: "Get-Content", gc: "Get-Content", cd: "Set-Location", sl: "Set-Location", chdir: "Set-Location", pushd: "Push-Location", popd: "Pop-Location", pwd: "Get-Location", gl: "Get-Location", gi: "Get-Item", gp: "Get-ItemProperty", ni: "New-Item", mkdir: "New-Item", md: "New-Item", ri: "Remove-Item", del: "Remove-Item", rd: "Remove-Item", rmdir: "Remove-Item", rm: "Remove-Item", erase: "Remove-Item", mi: "Move-Item", mv: "Move-Item", move: "Move-Item", ci: "Copy-Item", cp: "Copy-Item", copy: "Copy-Item", cpi: "Copy-Item", si: "Set-Item", rni: "Rename-Item", ren: "Rename-Item", ps: "Get-Process", gps: "Get-Process", kill: "Stop-Process", spps: "Stop-Process", start: "Start-Process", saps: "Start-Process", sajb: "Start-Job", ipmo: "Import-Module", echo: "Write-Output", write: "Write-Output", sleep: "Start-Sleep", help: "Get-Help", man: "Get-Help", gcm: "Get-Command", gsv: "Get-Service", gv: "Get-Variable", sv: "Set-Variable", h: "Get-History", history: "Get-History", iex: "Invoke-Expression", iwr: "Invoke-WebRequest", irm: "Invoke-RestMethod", icm: "Invoke-Command", ii: "Invoke-Item", iwmi: "Invoke-WmiMethod", icim: "Invoke-CimMethod", nsn: "New-PSSession", etsn: "Enter-PSSession", exsn: "Exit-PSSession", gsn: "Get-PSSession", rsn: "Remove-PSSession", cls: "Clear-Host", clear: "Clear-Host", select: "Select-Object", where: "Where-Object", foreach: "ForEach-Object", "%": "ForEach-Object", "?": "Where-Object", measure: "Measure-Object", ft: "Format-Table", fl: "Format-List", fw: "Format-Wide", oh: "Out-Host", ogv: "Out-GridView", ac: "Add-Content", clc: "Clear-Content", tee: "Tee-Object", epcsv: "Export-Csv", sp: "Set-ItemProperty", rp: "Remove-ItemProperty", cli: "Clear-Item", epal: "Export-Alias", sls: "Select-String" }));
/** A command's cmdlet name, lower case: an alias as its cmdlet, a program without .exe/.cmd/.bat/.com. */
export function psCmdlet(e) {
  let n = String(e ?? "").toLowerCase();
  if (!n.includes("\\") && !n.includes("/")) n = n.replace(/\.(exe|cmd|bat|com)$/, "");
  const r = PS_CC_ALIASES[n];
  return r ? r.toLowerCase() : n;
}
function hasCmdlet(p, name) {
  const r = name.toLowerCase(), s = PS_CC_ALIASES[r] && PS_CC_ALIASES[r].toLowerCase();
  for (const c of psCommands(p)) {
    const h = String(c.name).toLowerCase(), y = PS_CC_ALIASES[h] && PS_CC_ALIASES[h].toLowerCase();
    if (h === r || y === r || (s && h === s) || (y && s && y === s)) return true;
  }
  return false;
}
const DASHES = new Set(["/", "–", "—", "―"]);
const paramIn = (c, full, short) => { const s = full.toLowerCase(), h = short.toLowerCase(); return c.args.some((y) => { const i = y.indexOf(":", 1), t = (i > 0 ? y.slice(0, i) : y).replace(/`[\r\n]+\s*/g, "").replaceAll("`", "").toLowerCase(); return t.startsWith(h) && s.startsWith(t) && t.length <= s.length; }); };
/** Whether a command has a parameter (PowerShell's way: any unique start of its name, from the short form on). */
export function psHasParam(c, full, short) {
  if (paramIn(c, full, short)) return true;
  return paramIn({ ...c, args: c.args.map((m) => (m.length > 0 && DASHES.has(m[0]) ? "-" + m.slice(1) : m)) }, full, short);
}
const PWSH = new Set(["pwsh", "pwsh.exe", "powershell", "powershell.exe"]);
const isPwsh = (e) => { const n = String(e).toLowerCase(); if (PWSH.has(n)) return true; const r = Math.max(n.lastIndexOf("/"), n.lastIndexOf("\\")); return r >= 0 && PWSH.has(n.slice(r + 1)); };
const unquote = (s) => String(s).replace(/^['"‘-‟]+|['"‘-‟]+$/g, "");
const unescape = (s) => String(s).replaceAll("`", "");
/** The .NET types PowerShell's ConstrainedLanguage allows (Claude Code's list). */
const TYPES_OK = new Set(["alias", "allowemptycollection", "allowemptystring", "allownull", "argumentcompleter", "argumentcompletions", "array", "bigint", "bool", "byte", "char", "cimclass", "cimconverter", "ciminstance", "cimtype", "cmdletbinding", "cultureinfo", "datetime", "decimal", "double", "dsclocalconfigurationmanager", "dscproperty", "dscresource", "experimentaction", "experimental", "experimentalfeature", "float", "guid", "hashtable", "int", "int16", "int32", "int64", "ipaddress", "ipendpoint", "long", "mailaddress", "norunspaceaffinity", "nullstring", "objectsecurity", "ordered", "outputtype", "parameter", "physicaladdress", "pscredential", "pscustomobject", "psdefaultvalue", "pslistmodifier", "psobject", "psprimitivedictionary", "pstypenameattribute", "ref", "regex", "sbyte", "securestring", "semver", "short", "single", "string", "supportswildcards", "switch", "timespan", "uint", "uint16", "uint32", "uint64", "ulong", "uri", "ushort", "validatecount", "validatedrive", "validatelength", "validatenotnull", "validatenotnullorempty", "validatenotnullorwhitespace", "validatepattern", "validaterange", "validatescript", "validateset", "validatetrusteddata", "validateuserdrive", "version", "void", "wildcardpattern", "x500distinguishedname", "x509certificate", "xml", "system.array", "system.boolean", "system.byte", "system.char", "system.datetime", "system.decimal", "system.double", "system.guid", "system.int16", "system.int32", "system.int64", "system.numerics.biginteger", "system.sbyte", "system.single", "system.string", "system.timespan", "system.uint16", "system.uint32", "system.uint64", "system.uri", "system.version", "system.void", "system.collections.hashtable", "system.text.regularexpressions.regex", "system.globalization.cultureinfo", "system.net.ipaddress", "system.net.ipendpoint", "system.net.mail.mailaddress", "system.net.networkinformation.physicaladdress", "system.security.securestring", "system.security.cryptography.x509certificates.x509certificate", "system.security.cryptography.x509certificates.x500distinguishedname", "system.xml.xmldocument", "system.management.automation.pscredential", "system.management.automation.pscustomobject", "system.management.automation.pslistmodifier", "system.management.automation.psobject", "system.management.automation.psprimitivedictionary", "system.management.automation.psreference", "system.management.automation.semanticversion", "system.management.automation.switchparameter", "system.management.automation.wildcardpattern", "system.management.automation.language.nullstring", "microsoft.management.infrastructure.cimclass", "microsoft.management.infrastructure.cimconverter", "microsoft.management.infrastructure.ciminstance", "microsoft.management.infrastructure.cimtype", "system.collections.specialized.ordereddictionary", "system.security.accesscontrol.objectsecurity", "object", "system.object", "microsoft.powershell.commands.modulespecification"]);
const typeOk = (t) => TYPES_OK.has(String(t).toLowerCase().replace(/\[\]$/, "").replace(/\[.*\]$/, "").trim());

// ── CLAUDE CODE'S SAFETY CHECKS, in its order and words ──────────────────────────────────────────────────────────────
const DOWNLOADERS = new Set(["invoke-webrequest", "iwr", "invoke-restmethod", "irm", "new-object", "start-bitstransfer"]);
const RUNS_CODE = new Set(["invoke-command", "invoke-expression", "start-job", "start-threadjob", "register-scheduledjob", "register-engineevent", "register-objectevent", "register-wmievent", "new-pssession", "enter-pssession"]);
const LOADS_MODULES = new Set(["import-module", "ipmo", "install-module", "save-module", "update-module", "install-script", "save-script"]);
const RUNS_FILES = new Set(["invoke-command", "start-job", "start-threadjob", "register-scheduledjob"]);
const TASKS = new Set(["register-scheduledtask", "new-scheduledtask", "new-scheduledtaskaction", "set-scheduledtask"]);
const ENV_WRITERS = new Set(["set-item", "si", "new-item", "ni", "remove-item", "ri", "del", "rm", "rd", "rmdir", "erase", "clear-item", "cli", "set-content", "add-content", "ac"]);
const NAME_SETTERS = new Set(["set-alias", "sal", "new-alias", "nal", "set-variable", "sv", "new-variable", "nv"]);
const WMI = new Set(["invoke-wmimethod", "iwmi", "invoke-cimmethod", "icim"]);
/** The cmdlets that only shape what they are given, the only ones a script block may go to without a question. */
export const PS_FORMATTERS = new Set(["where-object", "sort-object", "select-object", "group-object", "format-table", "format-list", "format-wide", "format-custom"]);
const ask = (message) => ({ behavior: "ask", message });
const CHECKS = [
  (e) => (hasCmdlet(e, "Invoke-Expression") ? ask("Command uses Invoke-Expression which can execute arbitrary code") : null),
  (e) => { for (const n of psCommands(e)) { if (n.elementType !== "CommandAst") continue; const r = n.elementTypes && n.elementTypes[0]; if (r !== undefined && r !== "StringConstant") return ask("Command name is a dynamic expression which cannot be statically validated"); } return null; },
  (e) => { for (const n of psCommands(e)) if (isPwsh(n.name) && psHasParam(n, "-encodedcommand", "-e")) return ask("Command uses encoded parameters which obscure intent"); return null; },
  (e) => { for (const n of psCommands(e)) if (isPwsh(n.name)) return ask("Command spawns a nested PowerShell process which cannot be validated"); return null; },
  (e) => {
    const dl = (w) => DOWNLOADERS.has(String(w.name).toLowerCase()), ex = (w) => { const n = String(w.name).toLowerCase(); return n === "invoke-expression" || n === "iex"; };
    for (const r of e.statements) { const s = r.commands; if (s.length < 2) continue; if (s.some(dl) && s.some(ex)) return ask("Command downloads and executes remote code"); }
    const all = psCommands(e);
    return all.some(dl) && all.some(ex) ? ask("Command downloads and executes remote code") : null;
  },
  (e) => {
    for (const n of psCommands(e)) {
      const r = String(n.name).toLowerCase();
      if (r === "start-bitstransfer") return ask("Command downloads files via BITS transfer");
      if ((r === "certutil" || r === "certutil.exe") && n.args.some((m) => { const g = m.toLowerCase(); return g === "-urlcache" || g === "/urlcache"; })) return ask("Command uses certutil to download from a URL");
      if ((r === "bitsadmin" || r === "bitsadmin.exe") && n.args.some((s) => s.toLowerCase() === "/transfer")) return ask("Command downloads files via BITS transfer");
    }
    return null;
  },
  (e) => (hasCmdlet(e, "Add-Type") ? ask("Command compiles and loads .NET code") : null),
  (e) => {
    for (const n of psCommands(e)) {
      if (String(n.name).toLowerCase() !== "new-object") continue;
      if (psHasParam(n, "-comobject", "-com")) return ask("Command instantiates a COM object which may have execution capabilities");
      let t;
      for (let s = 0; s < n.args.length; s++) {
        const m = n.args[s], g = m.toLowerCase();
        if (g.startsWith("-t") && g.includes(":")) { const w = m.indexOf(":"); if ("-typename".startsWith(g.slice(0, w))) { t = m.slice(w + 1); break; } }
        if (g.startsWith("-t") && "-typename".startsWith(g) && n.args[s + 1] !== undefined) { t = n.args[s + 1]; break; }
      }
      if (t === undefined) {
        const skipNext = new Set(["-argumentlist", "-comobject", "-property"]), lone = new Set(["-strict"]);
        for (let g = 0; g < n.args.length; g++) {
          const w = n.args[g];
          if (w.startsWith("-")) {
            const y = w.toLowerCase();
            if (y.startsWith("-t") && "-typename".startsWith(y)) { g++; continue; }
            const h = w.indexOf(":");
            if (h !== -1) { if (w.slice(h + 1).trim() === "") return ask(`New-Object argument '${w}' has nothing after its colon, so Claude Code cannot tell which .NET type this command would create`); continue; }
            if (lone.has(y)) continue;
            if (skipNext.has(y)) { g++; continue; }
            continue;
          }
          t = w; break;
        }
      }
      if (t !== undefined && !typeOk(t)) return ask(`New-Object instantiates .NET type '${t}' outside the ConstrainedLanguage allowlist`);
    }
    return null;
  },
  (e) => {
    for (const n of psCommands(e)) {
      const r = String(n.name).toLowerCase(), s = (PS_CC_ALIASES[r] && PS_CC_ALIASES[r].toLowerCase()) || r;
      if (!RUNS_FILES.has(s)) continue;
      if (psHasParam(n, "-filepath", "-f") || psHasParam(n, "-literalpath", "-l")) return ask(`${n.name} -FilePath executes an arbitrary script file`);
      for (let m = 0; m < n.args.length; m++) { const g = n.elementTypes && n.elementTypes[m + 1], w = n.args[m]; if (g === "StringConstant" && w && !w.startsWith("-")) return ask(`${n.name} with positional string argument binds to -FilePath and executes a script file`); }
    }
    return null;
  },
  (e) => { for (const n of psCommands(e)) { const r = String(n.name).toLowerCase(); if (r === "invoke-item" || r === "ii") return ask("Invoke-Item opens files with the default handler (ShellExecute). On executable files this runs arbitrary code."); } return null; },
  (e) => {
    for (const n of psCommands(e)) {
      const r = String(n.name).toLowerCase();
      if (TASKS.has(r)) return ask(`${n.name} creates or modifies a scheduled task (persistence primitive)`);
      if ((r === "schtasks" || r === "schtasks.exe") && n.args.some((s) => { const m = s.toLowerCase(); return m === "/create" || m === "/change" || m === "-create" || m === "-change"; })) return ask("schtasks with create/change modifies scheduled tasks (persistence primitive)");
    }
    return null;
  },
  (e) => {
    for (const n of psCommands(e)) {
      const r = String(n.name).toLowerCase();
      if (((PS_CC_ALIASES[r] && PS_CC_ALIASES[r].toLowerCase()) || r) !== "foreach-object") continue;
      if (psHasParam(n, "-membername", "-m")) return ask("ForEach-Object -MemberName invokes methods by string name which cannot be validated");
      for (let m = 0; m < n.args.length; m++) { const g = n.elementTypes && n.elementTypes[m + 1], w = n.args[m]; if (g === "StringConstant" && w && !w.startsWith("-")) return ask("ForEach-Object with positional string argument binds to -MemberName and invokes methods by name"); }
    }
    return null;
  },
  (e) => {
    for (const n of psCommands(e)) {
      const r = String(n.name).toLowerCase();
      if (r !== "start-process" && r !== "saps" && r !== "start") continue;
      if (psHasParam(n, "-Verb", "-v") && n.args.some((s) => s.toLowerCase() === "runas")) return ask("Command requests elevated privileges");
      if (n.children) for (let s = 0; s < n.args.length; s++) {
        const m = unescape(n.args[s].replace(/`[\r\n]+\s*/g, ""));
        if (!/^[-–—―/]v[a-z]*:/i.test(m)) continue;
        for (const w of n.children[s] || []) if (unescape(w.text).replace(/['"‘-‟\s]/g, "").toLowerCase() === "runas") return ask("Command requests elevated privileges");
      }
      if (n.args.some((s) => /^[-–—―/]v[a-z]*:['"` ‘-‟]*runas['"` ‘-‟]*$/i.test(unescape(s.replace(/`[\r\n]+\s*/g, ""))))) return ask("Command requests elevated privileges");
      for (const s of n.args) if (isPwsh(unquote(s))) return ask("Start-Process launches a nested PowerShell process which cannot be validated");
    }
    return null;
  },
  (e) => {
    if (!psPatterns(e).hasScriptBlocks) return null;
    for (const s of psCommands(e)) if (RUNS_CODE.has(String(s.name).toLowerCase())) return ask("Command contains script block with dangerous cmdlet that may execute arbitrary code");
    const fmt = (s) => { const m = String(s.name).toLowerCase(); if (PS_FORMATTERS.has(m)) return true; const g = PS_CC_ALIASES[m]; return !!(g && PS_FORMATTERS.has(g.toLowerCase())); };
    return psCommands(e).every(fmt) ? null : ask("Command contains script block that may execute arbitrary code");
  },
  (e) => (psPatterns(e).hasSubExpressions ? ask("Command contains subexpressions $()") : null),
  (e) => (psPatterns(e).hasExpandableStrings ? ask("Command contains expandable strings with embedded expressions") : null),
  (e) => (psPatterns(e).hasSplatting ? ask("Command uses splatting (@variable)") : null),
  (e) => (psPatterns(e).hasStopParsing ? ask("Command uses stop-parsing token (--%)") : null),
  (e) => (psPatterns(e).hasMemberInvocations ? ask("Command invokes .NET methods") : null),
  (e) => { for (const t of e.typeLiterals || []) if (!typeOk(t)) return ask(`Command uses .NET type [${t}] outside the ConstrainedLanguage allowlist`); return null; },
  (e) => {
    const env = (e.variables || []).filter((s) => String(s.path).toLowerCase().startsWith("env:"));
    if (!env.length) return null;
    for (const r of psCommands(e)) if (ENV_WRITERS.has(String(r.name).toLowerCase())) return ask("Command modifies environment variables");
    return psPatterns(e).hasAssignments ? ask("Command modifies environment variables") : null;
  },
  (e) => { for (const n of psCommands(e)) if (LOADS_MODULES.has(String(n.name).toLowerCase())) return ask("Command loads, installs, or downloads a PowerShell module or script, which can execute arbitrary code"); return null; },
  (e) => { for (const n of psCommands(e)) { const r = String(n.name).toLowerCase(), s = r.includes("\\") ? r.slice(r.lastIndexOf("\\") + 1) : r; if (NAME_SETTERS.has(s)) return ask("Command creates or modifies an alias or variable that can affect future command resolution"); } return null; },
  (e) => {
    for (const n of psCommands(e)) {
      const r = String(n.name).toLowerCase();
      if (WMI.has(r)) return ask(`${n.name} can spawn arbitrary processes via WMI/CIM (Win32_Process Create)`);
      const s = Math.max(r.lastIndexOf("/"), r.lastIndexOf("\\")), m = s >= 0 ? r.slice(s + 1) : r;
      if (m === "wmic" || m === "wmic.exe") return ask("wmic can spawn arbitrary processes (process call create), execute scripts (/format, /translate XSL), or write arbitrary files (/output, /append, /record) via WMI");
    }
    return null;
  },
];
/**
 * CLAUDE CODE'S SAFETY CHECKS on a parsed command, in its order: the first that wants a question gives its reason (an
 * unparsed command: "Could not parse command for security analysis"); then a `using` statement, a `#Requires`, the
 * background operator. "" when none.
 */
export function psSafetyWhy(p) {
  if (!p || !p.valid) return "Could not parse command for security analysis";
  for (const check of CHECKS) { const r = check(p); if (r && r.behavior === "ask") return r.message; }
  if (p.hasUsingStatements) return "Command contains a `using` statement that may load external code (module or assembly)";
  if (p.hasScriptRequirements) return "Command contains a `#Requires` directive that may trigger module loading";
  if (p.hasBackgroundJob) return "Command uses the background job operator (`&`) which spawns a child PowerShell process";
  return "";
}
/** An argument that names a provider other than the file system, or a network (UNC) path, in Claude Code's words. */
export function psProviderWhy(p) {
  const PROVIDER = /^(?:[\w.]+\\)?(env|hklm|hkcu|function|alias|variable|cert|wsman|registry)::?/i;
  const look = (a) => {
    let m = String(a);
    if (m.length > 0 && (m[0] === "-" || DASHES.has(m[0]))) { const w = m.indexOf(":", 1); if (w > 0 && (m[0] !== "/" || /^\/[A-Za-z]{1,2}:/.test(m))) m = m.substring(w + 1); }
    m = unescape(m.replace(/`[\r\n]+\s*/g, ""));
    if (PROVIDER.test(m)) return `Command argument '${a}' uses a non-filesystem provider path and requires approval`;
    if (/^(\\\\|\/\/)[^\\/]/.test(m)) return `Command argument '${a}' contains a UNC path that could trigger network requests`;
    return "";
  };
  for (const s of (p && p.statements) || []) {
    for (const c of s.commands) { if (c.elementType !== "CommandAst") continue; for (const a of c.args) { const w = look(a); if (w) return w; } }
    if (s.nestedCommands) for (const c of s.nestedCommands) for (const a of c.args) { const w = look(a); if (w) return w; }
  }
  return "";
}

// ── WHAT ONLY READS (Claude Code's table: each cmdlet and the settings it may be given) ─────────────────────────────
const DYNAMIC = /[$(@{[]/;
/** Whether a command has an argument Claude Code cannot read ahead (a variable, a sub-expression, a script block …). */
export function psDynamicArgs(c) {
  const kinds = ((c && c.elementTypes) || []).slice(1), args = (c && c.args) || [], kids = c && c.children;
  for (let a = 0; a < kinds.length; a++) {
    if (kinds[a] !== "StringConstant" && kinds[a] !== "Parameter") { if (!DYNAMIC.test(args[a] || "")) continue; return true; }
    if (kinds[a] === "Parameter") {
      const l = kids && kids[a];
      if (l) { if (l.some((f) => f.type !== "StringConstant")) return true; }
      else { const f = args[a] || "", o = f.indexOf(":"); if (o > 0 && DYNAMIC.test(f.slice(o + 1))) return true; }
    }
  }
  return false;
}
const F = (...flags) => ({ flags }), ALL = { all: true };
export const PS_READ_TABLE = Object.freeze(Object.assign(Object.create(null), {
  "get-childitem": F("-Path", "-LiteralPath", "-Filter", "-Include", "-Exclude", "-Recurse", "-Depth", "-Name", "-Force", "-Attributes", "-Directory", "-File", "-Hidden", "-ReadOnly", "-System"),
  "get-content": F("-Path", "-LiteralPath", "-TotalCount", "-Head", "-Tail", "-Raw", "-Encoding", "-Delimiter", "-ReadCount"),
  "get-item": F("-Path", "-LiteralPath", "-Force", "-Stream"),
  "get-itemproperty": F("-Path", "-LiteralPath", "-Name"),
  "test-path": F("-Path", "-LiteralPath", "-PathType", "-Filter", "-Include", "-Exclude", "-IsValid", "-NewerThan", "-OlderThan"),
  "resolve-path": F("-Path", "-LiteralPath", "-Relative"),
  "get-filehash": F("-Path", "-LiteralPath", "-Algorithm", "-InputStream"),
  "get-acl": F("-Path", "-LiteralPath", "-Audit", "-Filter", "-Include", "-Exclude"),
  "set-location": F("-Path", "-LiteralPath", "-PassThru", "-StackName"),
  "push-location": F("-Path", "-LiteralPath", "-PassThru", "-StackName"),
  "pop-location": F("-PassThru", "-StackName"),
  "select-string": F("-Path", "-LiteralPath", "-Pattern", "-InputObject", "-SimpleMatch", "-CaseSensitive", "-Quiet", "-List", "-NotMatch", "-AllMatches", "-Encoding", "-Context", "-Raw", "-NoEmphasis"),
  "convertto-json": F("-InputObject", "-Depth", "-Compress", "-EnumsAsStrings", "-AsArray"),
  "convertfrom-json": F("-InputObject", "-Depth", "-AsHashtable", "-NoEnumerate"),
  "convertto-csv": F("-InputObject", "-Delimiter", "-NoTypeInformation", "-NoHeader", "-UseQuotes"),
  "convertfrom-csv": F("-InputObject", "-Delimiter", "-Header", "-UseCulture"),
  "convertto-xml": F("-InputObject", "-Depth", "-As", "-NoTypeInformation"),
  "convertto-html": F("-InputObject", "-Property", "-Head", "-Title", "-Body", "-Pre", "-Post", "-As", "-Fragment"),
  "format-hex": F("-Path", "-LiteralPath", "-InputObject", "-Encoding", "-Count", "-Offset"),
  "get-member": F("-InputObject", "-MemberType", "-Name", "-Static", "-View", "-Force"),
  "get-unique": F("-InputObject", "-AsString", "-CaseInsensitive", "-OnType"),
  "compare-object": F("-ReferenceObject", "-DifferenceObject", "-Property", "-SyncWindow", "-CaseSensitive", "-Culture", "-ExcludeDifferent", "-IncludeEqual", "-PassThru"),
  "join-string": F("-InputObject", "-Property", "-Separator", "-SingleQuote", "-DoubleQuote", "-FormatString"),
  "get-random": F("-InputObject", "-Minimum", "-Maximum", "-Count", "-SetSeed", "-Shuffle"),
  "convert-path": F("-Path", "-LiteralPath"),
  "join-path": F("-Path", "-ChildPath", "-AdditionalChildPath"),
  "split-path": F("-Path", "-LiteralPath", "-Qualifier", "-NoQualifier", "-Parent", "-Leaf", "-LeafBase", "-Extension", "-IsAbsolute"),
  "get-itempropertyvalue": F("-Path", "-LiteralPath", "-Name"),
  "get-psprovider": F("-PSProvider"),
  "get-computerinfo": ALL, "get-host": ALL,
  "get-date": F("-Date", "-Format", "-UFormat", "-DisplayHint", "-AsUTC"),
  "get-location": F("-PSProvider", "-PSDrive", "-Stack", "-StackName"),
  "get-psdrive": F("-Name", "-PSProvider", "-Scope"),
  "get-module": F("-Name", "-ListAvailable", "-All", "-FullyQualifiedName", "-PSEdition"),
  "get-alias": F("-Name", "-Definition", "-Scope", "-Exclude"),
  "get-history": F("-Id", "-Count"),
  "get-culture": ALL, "get-uiculture": ALL,
  "get-timezone": F("-Name", "-Id", "-ListAvailable"),
  "get-uptime": ALL,
  "write-output": { flags: ["-InputObject", "-NoEnumerate"], dynamic: true },
  "write-host": { flags: ["-Object", "-NoNewline", "-Separator", "-ForegroundColor", "-BackgroundColor"], dynamic: true },
  "start-sleep": { flags: ["-Seconds", "-Milliseconds", "-Duration"], dynamic: true },
  "format-table": { all: true, dynamic: true }, "format-list": { all: true, dynamic: true }, "format-wide": { all: true, dynamic: true }, "format-custom": { all: true, dynamic: true },
  "measure-object": { all: true, dynamic: true }, "select-object": { all: true, dynamic: true }, "sort-object": { all: true, dynamic: true }, "group-object": { all: true, dynamic: true },
  "where-object": { all: true, dynamic: true }, "out-string": { all: true, dynamic: true }, "out-host": { all: true, dynamic: true },
}));
/** Settings that write a variable (Claude Code: -OutVariable and the like can redirect later commands), and that pick an error mode. */
const VAR_PARAMS = new Set(["-outvariable", "-ov", "-errorvariable", "-ev", "-warningvariable", "-wv", "-informationvariable", "-iv", "-pipelinevariable", "-pv"]);
const ACTION_PARAMS = new Set(["-erroraction", "-ea", "-warningaction", "-wa", "-informationaction", "-infa", "-progressaction", "-proga"]);
const ACTION_OK = new Set(["silentlycontinue", "continue", "stop", "ignore"]);
const COMMON = new Set(["-verbose", "-vb", "-debug", "-db", ...ACTION_PARAMS]);
const isParam = (a, kind) => (kind === undefined ? /^[-–—―]/.test(a) : kind === "Parameter");
const paramName = (a) => { const t = "-" + String(a).slice(1), i = t.indexOf(":"); return (i > 0 ? t.slice(0, i) : t).toLowerCase(); };
/** A setting that writes a variable, or an error mode other than the plain ones (Break, Inquire, Suspend): not read-only. */
export function psWritesState(c) {
  const args = c.args || [], kinds = c.elementTypes;
  for (let a = 0; a < args.length; a++) {
    if (!isParam(args[a], kinds && kinds[a + 1])) continue;
    const n = paramName(args[a]);
    if (VAR_PARAMS.has(n) || (n.endsWith("variable") && n.length > 9)) return true;
    if (ACTION_PARAMS.has(n)) {
      const i = args[a].indexOf(":"), v = (i > 0 ? args[a].slice(i + 1) : args[a + 1] || "").toLowerCase().replace(/^['"]|['"]$/g, "").trim();
      if (v && !ACTION_OK.has(v)) return true;
    }
  }
  return false;
}
/**
 * WHETHER ONE COMMAND ONLY READS (Claude Code's read-only check): a cmdlet of its table, every argument plain text or a
 * setting it lists, none written by a variable or a sub-expression, no variable written, no unusual error mode. A program
 * (git, npm …) only reads when Coder's bash check calls it read-only (`nativeReadOnly`, given its text).
 */
export function psCommandReadOnly(c, { nativeReadOnly = () => false } = {}) {
  if (!c || c.elementType !== "CommandAst") return false;
  const canon = psCmdlet(c.name), entry = PS_READ_TABLE[canon];
  if (!entry) return c.nameType !== "cmdlet" && !canon.includes("-") && !psDynamicArgs(c) && nativeReadOnly(c.text) === true;
  if (!c.elementTypes) return false;
  if (psDynamicArgs(c)) return false;
  if (psWritesState(c)) return false;
  if (entry.all) return true;
  const ok = new Set((entry.flags || []).map((f) => f.toLowerCase()));
  for (let a = 0; a < c.args.length; a++) {
    if (!isParam(c.args[a], c.elementTypes[a + 1])) continue;
    const n = paramName(c.args[a]);
    if (COMMON.has(n)) continue;
    // (Its own spelling only: Claude Code reads a shortened setting, -Rec for -Recurse, as one it does not know.)
    if (!ok.has(n)) return false;
  }
  return true;
}
/** The paths a reading or removing cmdlet is given: its -Path/-LiteralPath values and its plain words (Select-String's first is its pattern). */
export function psPathArgs(c) {
  const canon = psCmdlet(c.name), out = [], args = c.args || [], kinds = c.elementTypes || [];
  let positional = 0;
  for (let a = 0; a < args.length; a++) {
    const t = args[a];
    if (isParam(t, kinds[a + 1])) {
      const n = paramName(t), i = t.indexOf(":");
      const pathish = ["-path", "-literalpath", "-pspath", "-lp", "-childpath", "-additionalchildpath"].some((f) => f.startsWith(n) && n.length >= 3) || n === "-p";
      const valueTaking = !["-recurse", "-force", "-raw", "-name", "-file", "-directory", "-hidden", "-readonly", "-system", "-relative", "-quiet", "-list", "-simplematch", "-casesensitive", "-notmatch", "-allmatches", "-noemphasis", "-passthru", "-parent", "-leaf", "-leafbase", "-extension", "-isabsolute", "-qualifier", "-noqualifier", "-isvalid", "-whatif", "-confirm", "-verbose", "-debug"].some((f) => f.startsWith(n) && n.length >= 2);
      if (i > 0) { if (pathish) out.push(t.slice(i + 1)); continue; }
      if (valueTaking && a + 1 < args.length && !isParam(args[a + 1], kinds[a + 2])) { if (pathish) out.push(args[a + 1]); a++; }
      continue;
    }
    positional++;
    if (canon === "select-string" && positional === 1) continue;
    out.push(t);
  }
  return out.filter((p) => p !== "");
}

// ── WHAT A WRITING CMDLET CHANGES ───────────────────────────────────────────────────────────────────────────────────
// (Claude Code 2.1.323's write cmdlets, its `Pt`, with Remove-Item and Clear-Content. For each: its settings by name and the
// slot each fills, the slots its unnamed words fill in order (PowerShell binds an unnamed word to the first slot not already
// named), and the slots that name what it changes. Copy-Item and Expand-Archive change only where they put things;
// Set-Content's and Add-Content's text is no path; New-Item's -Name and Rename-Item's new name go with their folder.)
const P_PATH = { "-path": "path", "-literalpath": "path", "-pspath": "path", "-lp": "path" };
const PS_WRITES = new Map([
  ["set-content", { params: { ...P_PATH, "-value": "value" }, pos: ["path", "value"], writes: ["path"] }],
  ["add-content", { params: { ...P_PATH, "-value": "value" }, pos: ["path", "value"], writes: ["path"] }],
  ["clear-content", { params: P_PATH, pos: ["path"], rest: "path", writes: ["path"] }],
  ["remove-item", { params: P_PATH, pos: ["path"], rest: "path", writes: ["path"] }],
  ["new-item", { params: { ...P_PATH, "-name": "name", "-itemtype": "type", "-value": "value" }, pos: ["path"], writes: ["path"], join: "name" }],
  ["out-file", { params: { "-filepath": "path", "-literalpath": "path", "-pspath": "path", "-lp": "path", "-path": "path", "-encoding": "enc" }, pos: ["path", "enc"], writes: ["path"] }],
  ["tee-object", { params: { "-filepath": "path", "-literalpath": "path", "-pspath": "path", "-lp": "path", "-path": "path", "-variable": "var" }, pos: ["path"], writes: ["path"] }],
  ["export-csv", { params: { ...P_PATH, "-delimiter": "delim" }, pos: ["path", "delim"], writes: ["path"] }],
  ["export-clixml", { params: P_PATH, pos: ["path"], writes: ["path"] }],
  ["copy-item", { params: { ...P_PATH, "-destination": "dest" }, pos: ["path", "dest"], writes: ["dest"] }],
  ["move-item", { params: { ...P_PATH, "-destination": "dest" }, pos: ["path", "dest"], writes: ["path", "dest"] }],
  ["rename-item", { params: { ...P_PATH, "-newname": "newname" }, pos: ["path", "newname"], writes: ["path"], join: "newname" }],
  ["expand-archive", { params: { ...P_PATH, "-destinationpath": "dest" }, pos: ["path", "dest"], writes: ["dest"] }],
  ["invoke-webrequest", { params: { "-uri": "uri", "-outfile": "out" }, pos: ["uri"], writes: ["out"] }],
  ["invoke-restmethod", { params: { "-uri": "uri", "-outfile": "out" }, pos: ["uri"], writes: ["out"] }],
]);
// (Settings that take no value, so the word after one is the next unnamed word.)
const PS_SWITCHES = new Set(["-force", "-recurse", "-passthru", "-whatif", "-confirm", "-nonewline", "-append", "-noclobber", "-notypeinformation", "-includetypeinformation", "-asbytestream", "-usebasicparsing", "-container", "-wait", "-verbose", "-debug", "-useculture", "-noheader", "-skipheadercheck", "-skipcertificatecheck", "-resume"]);
/** A typed setting's slot for one cmdlet: its name in full, or the only one of its names it starts (3 letters at least). */
function slotOf(n, params) {
  if (Object.hasOwn(params, n)) return params[n];
  if (n.length < 3) return undefined;
  const hits = [...new Set(Object.keys(params).filter((k) => k.startsWith(n)).map((k) => params[k]))];
  return hits.length === 1 ? hits[0] : undefined;
}
/**
 * THE PATHS A WRITING CMDLET CHANGES (fix 4 of the owner's "Yes all 7", 2026-11-13): as typed (a list split at its commas),
 * New-Item's -Name and Rename-Item's new name joined to their folder; [] for a command that writes nothing.
 */
export function psWriteTargets(c) {
  const spec = PS_WRITES.get(psCmdlet(c && c.name));
  if (!spec) return [];
  const args = c.args || [], kinds = c.elementTypes || [];
  const got = new Map(), loose = [];
  const put = (slot, v) => { if (!got.has(slot)) got.set(slot, []); got.get(slot).push(v); };
  for (let a = 0; a < args.length; a++) {
    const t = args[a];
    if (isParam(t, kinds[a + 1])) {
      const n = paramName(t), i = t.indexOf(":"), slot = slotOf(n, spec.params);
      let v;
      if (i > 0) v = t.slice(i + 1);
      else if (!PS_SWITCHES.has(n) && a + 1 < args.length && !isParam(args[a + 1], kinds[a + 2])) { v = args[a + 1]; a++; }
      if (v !== undefined && slot !== undefined) put(slot, v);
      continue;
    }
    loose.push(t);
  }
  const free = spec.pos.filter((slot) => !got.has(slot));
  loose.forEach((w, k) => { const slot = k < free.length ? free[k] : spec.rest; if (slot) put(slot, w); });
  const bare = (x) => String(x).replace(/^['"]|['"]$/g, "");
  const list = spec.writes.flatMap((slot) => got.get(slot) || []).flatMap((x) => String(x).split(",")).map((x) => x.trim()).filter(Boolean);
  if (spec.join && got.has(spec.join)) {
    const base = (got.get("path") || ["."])[0];
    const folder = spec.join === "name" ? bare(base) : (() => { const s = bare(base).replace(/\\/g, "/"); const k = s.lastIndexOf("/"); return k < 0 ? "." : s.slice(0, k) || "/"; })();
    list.push(folder + "/" + bare(got.get(spec.join)[0]));
  }
  return list;
}

// ── REMOVE-ITEM (Claude Code's "Remove-Item in PowerShell") ─────────────────────────────────────────────────────────
/** Claude Code's refusal of a removal it never allows. */
export const psRemovalDenied = (p) => `Remove-Item on system path '${p}' is blocked. This path is protected from removal.`;
/** Its question before a recursive removal of the working folder or a folder above it. */
export const psRemovalWorkdir = (p) => `Remove-Item -Recurse targeting '${p}' would delete the working directory including .git and .claude — requires manual approval`;
/** Whether a removal has -Recurse (any unique start of the name, from -r on, any dash). */
export const psRecurse = (c) => (c.args || []).some((h) => { const v = (h.length > 0 ? "-" + h.slice(1) : h).toLowerCase(), j = v.indexOf(":"), y = j > 0 ? v.slice(0, j) : v; return y.length >= 2 && "-recurse".startsWith(y); });

// ── EXIT CODES (Claude Code 2.1.322's own rules, Bash docs pass 8) ───────────────────────────────────────────────────
// Its docs: "The PowerShell tool can count exit code 1 as a normal result from grep, rg, egrep, fgrep, findstr, git grep, and
// git diff"; 2.1.302: not an error when "a search that finds nothing (rg, grep, findstr, git grep) is piped into Select-Object or
// another formatting cmdlet". Read from the command's text and what it printed, as Claude Code reads them, not from its parse.
const psFailed = (code) => ({ isError: code !== 0, message: code !== 0 ? "Command failed with exit code " + code : "" });
const psOneIsFine = (said) => (code) => ({ isError: code !== 0 && code !== 1, message: code === 1 ? said : "" });
const PS_NO_MATCH = psOneIsFine("No matches found"), PS_DIFFER = psOneIsFine("Files differ");
const PS_EXIT = new Map([["grep", PS_NO_MATCH], ["rg", PS_NO_MATCH], ["egrep", PS_NO_MATCH], ["fgrep", PS_NO_MATCH], ["findstr", PS_NO_MATCH],
  ["robocopy", (code) => ({ isError: code < 0 || code >= 8, message: code === 0 ? "No files copied (already in sync)" : code >= 1 && code < 8 ? (code & 1 ? "Files copied successfully" : "Robocopy completed (no errors)") : "" })]]);
/** Only for a program typed with .exe that printed something (`where` alone is Where-Object; `diff`, Compare-Object). */
const PS_EXIT_EXE = new Map([["where", psOneIsFine("No matching files found")], ["fc", PS_DIFFER], ["diff", PS_DIFFER]]);
/** The cmdlets a search's result may go through and still count as the search's. */
const PS_SHAPERS = new Set(["select-object", "sort-object", "group-object", "get-unique", "format-table", "format-list", "format-wide", "out-string", "out-host"]);
/** A command part's program, as Claude Code names it: `& `/`. ` dropped, quotes and folders dropped, lower case, no .exe/.cmd/.bat. */
export function psProgram(segment) {
  const n = String(segment ?? "").trim().replace(/^[&.]\s+/, "");
  const q = /^"([^"]*)"|^'([^']*)'/.exec(n);
  const s = q?.[1] ?? q?.[2] ?? (n.split(/\s+/)[0] || "").replace(/^["']|["']$/g, "");
  const y = (s.split(/[\\/]/).pop() || s).toLowerCase();
  const ext = ["exe", "cmd", "bat"].find((w) => y.endsWith("." + w)) ?? null;
  return { base: ext ? y.slice(0, -(ext.length + 1)) : y, hadNativeExt: ext !== null, nativeExt: ext };
}
/** git's subcommand in a part (its options skipped; -C and -c take a value). */
function psGitSub(segment) {
  let n = String(segment ?? "").trim().replace(/^[&.]\s+/, "");
  const s = /^"[^"]*"|^'[^']*'/.exec(n)?.[0] ?? n.split(/\s+/)[0] ?? "";
  if (psProgram(s).base !== "git") return undefined;
  n = n.slice(s.length);
  const h = ["git", ...n.trim().split(/\s+/).filter(Boolean)];
  for (let y = 1; y < h.length; y++) { const w = h[y]; if (w.startsWith("-")) { if (w === "-C" || w === "-c") y++; continue; } return w; }
  return undefined;
}
/**
 * THE PART WHOSE EXIT CODE IT IS: the command's last part (split at ;, |, new lines, &&, and an & after a space; a # after a
 * space ends a line's part), whether it ran only after a && (`andGated`), and, when the parts before it are a search piped
 * through formatting cmdlets only, that search (`feeder`). Any ( ) { }, a > that is not 2>&1, a && or a || leaves no feeder.
 */
export function psLastSegment(command) {
  const e = String(command ?? ""), n = [];
  let r = 0, gated = false, piped = false, simple = true, sq = false, dq = false;
  for (let i = 0; i < e.length; i++) {
    const ch = e[i];
    if (sq) { if (ch === "'") sq = false; continue; }
    if (dq) { if (ch === "`") i++; else if (ch === '"') dq = false; continue; }
    if (ch === "#" && (i === 0 || e[i - 1] === " " || e[i - 1] === "\t" || e[i - 1] === "\n" || e[i - 1] === "\r")) {
      n.push({ text: e.slice(r, i), andGated: gated, piped });
      while (i + 1 < e.length && e[i + 1] !== "\n" && e[i + 1] !== "\r") i++;
      r = i + 1; piped = false; continue;
    }
    if (ch === "'") { sq = true; continue; }
    if (ch === '"') { dq = true; continue; }
    if (ch === "(" || ch === ")" || ch === "{" || ch === "}" || (ch === ">" && e.slice(i - 1, i + 3) !== "2>&1")) simple = false;
    if (ch === ";" || ch === "|" || ch === "\n" || ch === "\r") {
      if (ch === "|" && e[i + 1] === "|") simple = false;
      n.push({ text: e.slice(r, i), andGated: gated, piped }); r = i + 1; piped = ch === "|"; if (!piped) gated = false;
      continue;
    }
    if (ch === "&") {
      if (e[i + 1] === "&") { n.push({ text: e.slice(r, i), andGated: gated, piped }); i++; r = i + 1; gated = true; piped = false; simple = false; continue; }
      const prev = e[i - 1];
      if ((prev === " " || prev === "\t") && e.slice(r, i).trim() !== "") { n.push({ text: e.slice(r, i), andGated: gated, piped }); r = i + 1; gated = false; piped = false; }
    }
  }
  n.push({ text: e.slice(r), andGated: gated, piped });
  const last = n.findLastIndex((x) => x.text.trim()), k = n[last];
  if (!k) return { segment: e, andGated: false, feeder: undefined };
  let y = last;
  while (simple && y > 0 && n[y].piped) {
    const w = /^\s*([\w-]+)(?=\s|$)/.exec(n[y].text)?.[1]?.toLowerCase() ?? "";
    if (!PS_SHAPERS.has(PS_CC_ALIASES[w]?.toLowerCase() ?? w)) break;
    y--;
  }
  const feeder = n[y].text;
  return { segment: k.text, andGated: k.andGated, feeder: y !== last && feeder.trim() ? feeder : undefined };
}
/**
 * WHAT A POWERSHELL COMMAND'S EXIT CODE MEANS, as Claude Code decides it: the last part's program (the search before its
 * formatting cmdlets when nothing was printed), then: never "normal" after a &&, or when the output says a command was not
 * found ("is not recognized as …", CommandNotFoundException) or findstr complained ("FINDSTR: "). The shape of exitMeaning's.
 */
export function psExitOf(command, code, stdout = "", stderr = "") {
  if (!Number.isInteger(code)) return { isError: true, message: "" };
  const out = String(stdout ?? ""), err = String(stderr ?? "");
  const seg = psLastSegment(command), said = out.trim() !== "" || err.trim() !== "";
  const part = (said ? undefined : seg.feeder) ?? seg.segment;
  const { base, nativeExt } = psProgram(part);
  let h = null;
  if (base === "git") { const sub = psGitSub(part); if (sub === "grep") h = PS_NO_MATCH(code); else if (sub === "diff") h = PS_DIFFER(code); }
  if (!h) h = ((nativeExt === "exe" && said ? PS_EXIT_EXE.get(base) : undefined) ?? PS_EXIT.get(base) ?? psFailed)(code);
  if (code === 0 || h.isError) return h;
  const both = out + "\n" + err;
  return seg.andGated || /is not recognized as (a name of a cmdlet|the name of a cmdlet|an? internal)/i.test(both) || /CommandNotFoundException/.test(both) || /^FINDSTR: /m.test(both) ? psFailed(code) : h;
}
