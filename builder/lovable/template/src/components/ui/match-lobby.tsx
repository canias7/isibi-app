import { cn } from "@/lib/utils";
/**
 * People waiting to start — with the reason it has not started yet.
 *
 * THE BLOCKER IS NAMED. A lobby that says "waiting" while one player has not
 * readied and another is still downloading a patch produces five people
 * blaming each other, and every one of those states is knowable.
 *
 * CONNECTION QUALITY IS SHOWN BEFORE THE MATCH, not after somebody has been
 * blamed for it. A player on a bad line is a fact everybody would rather have
 * up front, and hiding it just means the game is ruined instead.
 *
 * READY IS CARRIED BY A WORD, not a green dot. This gets streamed, screenshotted
 * and read by people who cannot distinguish red from green — and "ready" is one
 * character longer than a coloured circle.
 *
 * NO PLAYER-VISIBLE SKILL RATING IN THE LOBBY. Showing ratings before a match
 * produces dodging and abuse, both aimed at the lowest number in the room.
 */
export type LobbyPlayer = {
  id: string;
  name: string;
  ready?: boolean;
  /** "good", "poor" — the caller measures it. */
  connection?: string;
  /** True while they are still downloading or loading. */
  loading?: boolean;
  host?: boolean;
};

export function MatchLobby({ mode, players, needed, className }: {
  mode?: string;
  players: LobbyPlayer[];
  /** How many the mode requires. */
  needed?: number;
  className?: string;
}) {
  const notReady = players.filter((p) => !p.ready && !p.loading);
  const loading = players.filter((p) => p.loading);
  const short = needed !== undefined ? needed - players.length : undefined;
  // EVERY blocker, not the first. Reported one at a time, the message changes
  // to a new problem each time one is solved, and nobody can see how far off
  // starting actually is.
  const blockers = [
    short !== undefined && short > 0
      ? `Waiting for ${short} more ${short === 1 ? "player" : "players"}.`
      : null,
    // Sentences are built already capitalised. Upper-casing the first letter of
    // the finished line would rewrite a player's name, and a username is
    // case-sensitive identity rather than prose.
    loading.length > 0 ? `Still loading: ${loading.map((p) => p.name).join(", ")}.` : null,
    notReady.length > 0 ? `Not ready: ${notReady.map((p) => p.name).join(", ")}.` : null,
  ].filter(Boolean) as string[];
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {mode && <span className="font-medium">{mode}</span>}
        {needed !== undefined && (
          <span className="tabular-nums text-muted-foreground"> · {players.length} of {needed}</span>
        )}
      </p>
      {blockers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Everyone is ready.</p>
      ) : (
        <ul className="space-y-0.5 text-sm font-medium">
          {blockers.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {players.map((p) => (
          <li key={p.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {p.name}
              {p.host && <span className="text-xs text-muted-foreground"> · host</span>}
            </span>
            {p.connection && (
              <span className="shrink-0 text-xs text-muted-foreground">{p.connection} connection</span>
            )}
            <span className={cn("shrink-0 text-xs", p.ready ? "text-muted-foreground" : "font-medium")}>
              {p.loading ? "Loading" : p.ready ? "Ready" : "Not ready"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
