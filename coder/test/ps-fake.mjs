// PowerShell parses for tests, in the shape of Claude Code's parse script's JSON (coder-psparse.mjs runs the real one with
// pwsh on Coder's machine). `fakeParse` reads plain commands: statements split at ";", a chain (&&, ||) as PowerShell's
// PipelineChainAst (its commands nested), pipelines at "|", words as strings and "-x" as parameters. The rest by hand.
import { psTransform } from "../container/coder-psparse.mjs";

export const str = (text, value = text.replace(/^['"]|['"]$/g, "")) => ({ type: "StringConstantExpressionAst", text, value });
export const param = (text) => ({ type: "CommandParameterAst", text });
export const el = (type, text, more = {}) => ({ type, text, ...more });
export const cmdAst = (text, ...els) => ({ type: "CommandAst", text, commandElements: els, redirections: [] });
export const pipeline = (text, elements, more = {}) => ({ type: "PipelineAst", text, elements, ...more });
export const rawParse = (command, statements, more = {}) => ({ valid: true, errors: [], statements, variables: [], hasStopParsing: false, originalCommand: command, typeLiterals: [], hasUsingStatements: false, hasScriptRequirements: false, hasBackgroundJob: false, ...more });

const words = (t) => t.match(/'[^']*'|"[^"]*"|\S+/g) || [];
const commandOf = (t) => cmdAst(t, ...words(t).map((w, i) => (i > 0 && /^-[A-Za-z]/.test(w) ? param(w) : str(w))));
/** A plain command, parsed as PowerShell would. */
export function fakeParse(command) {
  const statements = command.split(";").map((s) => s.trim()).filter(Boolean).map((st) => {
    const pipes = st.split(/&&|\|\|/).map((x) => x.trim()).filter(Boolean);
    const cmds = (p) => p.split("|").map((x) => x.trim()).filter(Boolean).map(commandOf);
    if (pipes.length > 1) return { type: "PipelineChainAst", text: st, nestedCommands: pipes.flatMap(cmds) };
    return pipeline(st, cmds(st));
  });
  return psTransform(rawParse(command, statements));
}
/** A hand-built parse. */
export const parseOf = (command, statements, more) => psTransform(rawParse(command, statements, more));
