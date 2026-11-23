/**
 * The names of Claude Code's plugin, skill and onboarding tools in Coder (coder-plugins.mjs has the tools). No Node module
 * here: coder-toolsearch.mjs, which Coder's Worker loads too, takes the held-back ones and their hints from this file.
 */
export const PLUGIN_TOOL_NAMES = Object.freeze(["search_plugins", "suggest_plugin_install", "suggest_skills", "show_onboarding_role_picker", "list_plugins", "list_skills", "search_skills", "propose_skills", "share_onboarding_guide"]);
/** Held back until tool_search loads them (coder-toolsearch.mjs DEFERRED_TOOLS takes these). */
export const PLUGIN_DEFERRED = Object.freeze(["list_plugins", "list_skills", "search_skills", "propose_skills", "share_onboarding_guide"]);
/** Claude Code's names, for rules ("deny": ["SearchPlugins", "SuggestPluginInstall"]) and hooks. */
export const PLUGIN_CC_NAMES = Object.freeze({ list_plugins: "ListPlugins", search_plugins: "SearchPlugins", suggest_plugin_install: "SuggestPluginInstall", list_skills: "ListSkills", search_skills: "SearchSkills", suggest_skills: "SuggestSkills", propose_skills: "propose_skills", share_onboarding_guide: "ShareOnboardingGuide", show_onboarding_role_picker: "ShowOnboardingRolePicker" });
/** Their search hints (tool_search), Coder's words. */
export const PLUGIN_HINTS = Object.freeze({
  list_plugins: "list the plugins the owner has installed",
  list_skills: "list the skills available: the repository's, the owner's saved skills and their plugins'",
  search_skills: "search skills, including skills the owner can add",
  propose_skills: "propose new skills for the owner to review and save",
  share_onboarding_guide: "share ONBOARDING.md as a link teammates can open",
});
