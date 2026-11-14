/**
 * POTENTIAL SECRETS IN WHAT IS WRITTEN TO CODER'S MEMORY FILE (round 6's follow-up; the owner, 2026-11-14: "do what claude code
 * does"): Claude Code 2.1.325's own check before its Write and Edit write a memory file (its Lyt, in their validateInput): the
 * text written (Write's content, Edit's new_string) is scanned with its high-confidence secret rules and its private-key
 * check, as it is and without the invisible characters that could split one, and a hit refuses the call in its words.
 * Claude Code checks its memory folder (its personal memory, synced to the account, and its team memory); Coder's memory
 * file for a repository is kept for the owner's account by Coder's service, so it is checked as Claude Code's personal
 * memory is ("Memory is synced to your account").
 *
 * RULES: Claude Code 2.1.325's own (its secret scanner's rules marked "high", read from its raw program, each as its test
 * builds it: its regular expression and, for some, the quick test before it), in its order; LABELS: its words for each
 * part of a rule's name. No Node modules here (Coder's Worker and tests load it plainly).
 */
export const SECRET_RULES = Object.freeze([
  ["aws-access-token", "\\b((?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16})\\b", ""],
  ["gcp-api-key", "\\b(AIza[\\w-]{35})(?![\\w-])", ""],
  ["google-oauth-client-secret", "\\bGOCSPX-[\\w-]{28}(?![\\w-])", ""],
  ["azure-ad-client-secret", "(?:^|[\\\\'\"\\x60\\s>=:(,)])([a-zA-Z0-9_~.]{3}\\dQ~[a-zA-Z0-9_~.-]{31,34})(?:$|[\\\\'\"\\x60\\s<),])", ""],
  ["digitalocean-pat", "\\b(dop_v1_[a-f0-9]{64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["digitalocean-access-token", "\\b(doo_v1_[a-f0-9]{64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["anthropic-api-key", "\\b(sk[-]ant[-]api03-[a-zA-Z0-9_\\-]{93}AA)(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["anthropic-admin-api-key", "\\b(sk-ant-admin01-[a-zA-Z0-9_\\-]{93}AA)(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["anthropic-oauth-token", "(?:(?<![\\w-])|(?<=\\\\[nr]))(?=[\\w-]+(?:[\\x60'\"\\s;]|\\\\[nr]|$))[\\w-]*?\\b(sk-ant-(?:oat|ort)\\d{2}-[\\w-]{20,})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", "", "\\b(sk-ant-(?:oat|ort)\\d{2}-[\\w-]{20,})", ""],
  ["openai-api-key", "sk-[A-Za-z0-9_-]{8,200}T3BlbkFJ[A-Za-z0-9_-]{8,200}", ""],
  ["openai-legacy-api-key", "\\bsk-[a-zA-Z0-9]{48}(?![a-zA-Z0-9])", ""],
  ["huggingface-access-token", "\\b(hf_[a-zA-Z]{34})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["supabase-secret-key", "\\bsb_secret_[A-Za-z0-9_-]{20,}", ""],
  ["supabase-access-token", "\\bsbp_[a-z0-9]{40,}", ""],
  ["github-pat", "ghp_[0-9a-zA-Z]{36}", ""],
  ["github-fine-grained-pat", "github_pat_\\w{82}", ""],
  ["github-app-token", "(?:ghu|ghs)_[0-9a-zA-Z]{36}", ""],
  ["github-oauth", "gho_[0-9a-zA-Z]{36}", ""],
  ["github-refresh-token", "ghr_[0-9a-zA-Z]{36}", ""],
  ["gitlab-pat", "glpat-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-deploy-token", "gldt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-runner-authentication-token", "glrt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-oauth-app-secret", "gloas-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-pipeline-trigger-token", "glptt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-kubernetes-agent-token", "glagent-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-incoming-mail-token", "glimt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-scim-oauth-token", "glsoat-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-ci-build-token", "glcbt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-feed-token", "glft-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["gitlab-feature-flag-client-token", "glffct-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?", ""],
  ["slack-bot-token", "xoxb-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*", ""],
  ["slack-user-token", "xox[a-z](?:-[0-9]{10,13}){3}-[a-zA-Z0-9-]{28,34}", ""],
  ["slack-rotation-token", "xoxe(?:\\.xox[a-z])?-[0-9]-[A-Za-z0-9-]{28,}", ""],
  ["slack-app-token", "xapp-\\d-[A-Z0-9]+-\\d+-[a-z0-9]+", "i"],
  ["slack-workflow-token", "\\bxwfp-[a-zA-Z0-9-]{20,}", ""],
  ["slack-webhook-url", "(?:https?:\\/\\/)?hooks\\.slack\\.com\\/(?:services|workflows|triggers)\\/[A-Za-z0-9+/_-]{40,}", "i"],
  ["twilio-api-key", "SK[0-9a-fA-F]{32}", ""],
  ["sendgrid-api-token", "\\b(SG\\.[a-zA-Z0-9=_\\-.]{66})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["npm-access-token", "\\b(npm_[a-zA-Z0-9]{36})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["pypi-upload-token", "pypi-AgEIcHlwaS5vcmc[\\w-]{50,1000}", ""],
  ["databricks-api-token", "\\b(dapi[a-f0-9]{32}(?:-\\d)?)(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["hashicorp-tf-api-token", "[a-zA-Z0-9]{14}\\.atlasv1\\.[a-zA-Z0-9\\-_=]{60,70}", ""],
  ["pulumi-api-token", "\\b(pul-[a-f0-9]{40})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["postman-api-token", "\\b(PMAK-[a-fA-F0-9]{24}-[a-fA-F0-9]{34})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["grafana-api-key", "\\b(eyJrIjoi[A-Za-z0-9+/]{70,400}={0,3})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["grafana-cloud-api-token", "\\b(glc_[A-Za-z0-9+/]{32,400}={0,3})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["grafana-service-account-token", "\\b(glsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["sentry-user-token", "\\b(sntryu_[a-f0-9]{64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["sentry-org-token", "\\bsntrys_eyJpYXQiO[a-zA-Z0-9+/]{10,200}(?:LCJyZWdpb25fdXJs|InJlZ2lvbl91cmwi|cmVnaW9uX3VybCI6)[a-zA-Z0-9+/]{10,200}={0,2}_[a-zA-Z0-9+/]{43}", ""],
  ["stripe-access-token", "\\b((?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{10,99})(?:[\\x60'\"\\s;]|\\\\[nr]|$)", ""],
  ["shopify-access-token", "shpat_[a-fA-F0-9]{32}", ""],
  ["shopify-shared-secret", "shpss_[a-fA-F0-9]{32}", ""],
].map(([id, re, flags, pre, preFlags]) => Object.freeze({ id, re: new RegExp(re, flags), ...(pre !== undefined ? { pre: new RegExp(pre, preFlags) } : {}) })));
/** Its words for a rule name's parts (the others take a capital letter: "access-token" is "Access Token"). */
const LABELS = { aws: "AWS", gcp: "GCP", api: "API", pat: "PAT", ad: "AD", tf: "TF", oauth: "OAuth", npm: "NPM", pypi: "PyPI", jwt: "JWT", ci: "CI", scim: "SCIM", github: "GitHub", gitlab: "GitLab", openai: "OpenAI", digitalocean: "DigitalOcean", huggingface: "HuggingFace", hashicorp: "HashiCorp", sendgrid: "SendGrid" };
export const secretLabel = (id) => String(id).split("-").map((s) => LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
/**
 * A PRIVATE KEY'S BLOCK (its own check beside the rules): a BEGIN … PRIVATE KEY line, then, at least 64 characters on, its END
 * line (either one may be "[REDACTED]" already).
 */
const KEY_BEGIN = /(?:-----BEGIN[ A-Z0-9_-]{0,100}?|\[REDACTED(?:-[A-Z]{1,20})?\](?:-{1,4}BEGIN)?([ A-Z0-9_-]{0,100}?))PRIVATE KEY(?: BLOCK)?-----/gi;
const KEY_END = /(?:-----END[ A-Z0-9_-]{0,100}?|\[REDACTED(?:-[A-Z]{1,20})?\](?:-{1,4}END)?([ A-Z0-9_-]{0,100}?))PRIVATE KEY(?: BLOCK)?-----/gi;
const nextKeyLine = (re, s) => { let m = re.exec(s); while (m && m[1] !== undefined && /^-|--/.test(m[1])) { re.lastIndex = m.index + 1; m = re.exec(s); } return m; };
export function privateKeyIn(s) {
  const b = new RegExp(KEY_BEGIN.source, "gi"), e = new RegExp(KEY_END.source, "gi");
  const begin = nextKeyLine(b, s);
  if (!begin) return false;
  e.lastIndex = begin.index + begin[0].length + 64;
  return !!nextKeyLine(e, s);
}
/**
 * The characters its scan also drops, so a secret split by them is found (its Cqt): format, private-use, unassigned and
 * surrogate code points, default-ignorable ones, and controls, but not a tab, a line break, the zero-width (non-)joiners or
 * variation selectors 15 and 16, which a second pass drops (its eYs).
 */
const JOINERS = new Set([8204, 8205, 65038, 65039]);
const HIDDEN = /^[\p{Cf}\p{Co}\p{Cn}\p{Cs}\p{DI}]$/u;
export function hiddenChar(ch) {
  const c = ch.codePointAt(0);
  if (JOINERS.has(c) || c === 9 || c === 10 || c === 13) return false;
  return HIDDEN.test(ch) || c < 32 || (c >= 127 && c <= 159);
}
/** The labels of the potential secrets in a text, each once, in Claude Code's order (its APr). */
export function secretsIn(text) {
  const s = String(text ?? "");
  let plain = "", bare = "";
  for (const ch of s) { if (hiddenChar(ch)) continue; plain += ch; if (!JOINERS.has(ch.codePointAt(0))) bare += ch; }
  const found = [];
  for (const v of [...new Set([s, plain, bare])]) {
    for (const r of SECRET_RULES) { if (r.pre && !r.pre.test(v)) continue; if (r.re.test(v)) found.push(secretLabel(r.id)); }
    if (privateKeyIn(v)) found.push("Private Key");
  }
  return [...new Set(found)];
}
/** Its words, for a file synced to the owner's account (its personal memory's), with the labels found. */
export const memorySecretsRefused = (labels) => "Content contains potential secrets (" + labels.join(", ") + ") and cannot be written to memory. Memory is synced to your account. Remove the sensitive content and try again.";
