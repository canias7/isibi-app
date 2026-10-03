// THE QUESTION BLOCK OF public/chat.js, BY NAME (2026-10-02).
//
// The harnesses that run the browser's own handlers copy named functions out of
// chat.js, so whatever those functions call has to be copied too or the copy
// throws `ReferenceError` on the first reply that reaches it. A question on a
// site that exists (`builder/clarify.mjs`) added one block of helpers that the
// routing call, the send handler and the two reply readers now reach: the
// question readers, the card's state on the site, the message a question is
// drawn under, and the files kept beside it. ONE LIST for every harness, so a
// helper added to the block is added to all of them at once.
export const ASK_FNS = Object.freeze([
  "clarifyOf", "liveQuestion", "partialShown", "siteReplyMsg", "askReplyMsg", "askFromReply",
  "siteAskKeep", "siteAskClear", "siteAskSet", "askFilesDb", "askFilesStore", "askFilesFor",
  "askFilesDrop", "siteAskReply", "holdResume",
  // THE SIZE POLICY'S CHECK (2026-10-03): the send handler and the answer both
  // keep a message past one message's bound in the box and say the number.
  "siteTooLong",
  // THE COMBINED REQUEST FLOW (2026-10-03): every message is sent under its
  // own key (`siteMessageKey`), and every routing answer is asked whether the
  // server took the work on (`siteRequestOf`) — both on every send.
  "siteMessageKey", "siteRequestOf",
]);

// The block's three top-level lines, each one line of chat.js named by its opening.
export const ASK_LINES = Object.freeze([
  "const askFilesMem =", "const ASK_FILES_DB =", "const ASK_FILES_TTL =",
  // How many files one request carries (2026-10-03): an answer is held to the
  // request's files and its own together.
  "const SITE_MAX_FILES =",
  // AND THE KEYS OF MESSAGES HELD TO SEND AGAIN (2026-10-03, the combined
  // request flow), beside them in memory.
  "const siteHeldKeys =",
]);
