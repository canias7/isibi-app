// Slowing down somebody guessing a password.
//
// There is already a throttle on login, and it is not enough on its own: it
// lives in `ttl-cache`, which is PER ISOLATE. Cloudflare runs many isolates per
// colo and evicts idle ones, so an attacker spreading attempts across
// connections gets a fresh allowance each time, and a patient one gets an
// unlimited number of guesses against a real account. Counting on the ROW
// survives eviction, survives the colo, and is the same number everywhere.
//
// `failed` and `locked_until` have been columns on `_users` since the D1 era,
// read by nothing.
//
// THE DESIGN CHOICE THAT MATTERS: this is an escalating DELAY, not a lock that
// needs an owner to clear. A hard lock is a denial of service anybody can aim at
// anybody — learn a customer's address, fail eight times, and they cannot get
// into their own account until a human intervenes. A delay that heals by itself
// costs an attacker everything (their guess rate collapses) and costs the real
// person a wait that ends without them asking for help.
//
// Pure. The clock is a parameter.

/** Failures allowed at full speed. Fat-fingering a password four times is normal. */
export const LOCKOUT_THRESHOLD = 5;

/**
 * How long each further failure costs, in seconds.
 *
 * The shape is the point: the first delay is short enough that a real person
 * barely notices, and by the sixth it is an hour. An attacker needs the whole
 * curve for every account; a person who remembers their password on the second
 * try never reaches it.
 */
export const LOCKOUT_STEPS_SEC = [30, 120, 600, 1800, 3600];

/** Nothing escalates past this, so a mistyped password can never cost a day. */
export const LOCKOUT_MAX_SEC = LOCKOUT_STEPS_SEC[LOCKOUT_STEPS_SEC.length - 1];

/**
 * A quiet spell forgets the failures.
 *
 * Without it the counter only ever goes up, so an account that fumbled five
 * times a year ago starts its next bad day already at the top of the curve.
 */
export const LOCKOUT_DECAY_SEC = 60 * 60 * 12;

/** Seconds of delay earned by the Nth consecutive failure. */
export function delayFor(failed) {
  const n = Number(failed);
  if (!Number.isFinite(n) || n <= LOCKOUT_THRESHOLD) return 0;
  const idx = Math.min(n - LOCKOUT_THRESHOLD - 1, LOCKOUT_STEPS_SEC.length - 1);
  return LOCKOUT_STEPS_SEC[idx];
}

/**
 * Is this account currently in a delay window?
 *
 * `locked_until` is stored as epoch SECONDS — an integer column, so it compares
 * and sorts without any of the TEXT-timestamp care the rest of the schema needs.
 */
export function lockState(user, nowMs = Date.now()) {
  const now = Math.floor(nowMs / 1000);
  const until = Number((user && user.locked_until) || 0);
  const locked = Number.isFinite(until) && until > now;
  return { locked, until: locked ? until : 0, retryAfter: locked ? until - now : 0 };
}

/**
 * The row after a failed attempt.
 *
 * Returns null when nothing should change — which is the case while a delay is
 * already running. Counting failures during a lock would let a person hammering
 * their own forgotten password push their own wait from thirty seconds to an
 * hour, and would let an attacker do the same to somebody else on purpose.
 */
export function afterFailure(user, nowMs = Date.now()) {
  if (lockState(user, nowMs).locked) return null;
  const now = Math.floor(nowMs / 1000);
  const last = Number((user && user.last_failed_at) || 0);
  // Decay: a long quiet spell means these are not consecutive any more.
  const prior = Number.isFinite(last) && last > 0 && now - last > LOCKOUT_DECAY_SEC
    ? 0
    : Math.max(0, Number((user && user.failed) || 0));
  const failed = prior + 1;
  const delay = delayFor(failed);
  return { failed, locked_until: delay ? now + delay : 0, last_failed_at: now };
}

/** The row after a success. Everything forgotten — they proved who they are. */
export function afterSuccess() {
  return { failed: 0, locked_until: 0, last_failed_at: 0 };
}
