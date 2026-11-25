# Build prompt — "Trump" (Court Piece variant)

Copy everything below the line into your coding tool.

---

Build a complete, playable implementation of the trick-taking card game **Trump**, a
variant of Court Piece / Rang. Target a single-page web app (one HTML file with embedded
CSS and JS is fine), playable solo against three AI opponents.

**Prioritise correct rules and game logic over visual polish.** The rules below are the
specification — several deliberately depart from standard Court Piece. Implement them
exactly as written; do not "correct" them toward the published rules of Court Piece.

## 1. Cards, players, teams

- Standard 52-card deck. Ranks low to high: 2,3,4,5,6,7,8,9,10,J,Q,K,A. Ace is high (14).
- Four players at fixed seats: **south, east, north, west**.
- **Play order is south → east → north → west**, wrapping. (Rendered counter-clockwise.)
- Fixed partnerships: **south + north = Team Red**, **east + west = Team Blue**.
- South is the human player. The other three are AI.

## 2. The deal and choosing trump

1. Shuffle. Deal **5 cards to each player** first.
2. The **trump caller** looks only at those 5 cards and names the trump suit.
   - First hand of a match: the caller is **south** (the human).
   - Afterwards the caller rotates (see §6).
3. Deal the **remaining 8 cards** to each player, so everyone holds 13.
4. **Mandatory redeal:** after trump is chosen and all 13 are dealt, if **any one of the
   four players holds no card of the trump suit**, the whole hand is thrown in and redealt
   by the same caller, who chooses trump again. This is automatic — no player requests it.
   (This fires on roughly 5% of deals. It is a house rule, not standard Court Piece.)
5. The trump caller leads the first trick.

## 3. Playing a trick

- The leader plays any legal card; everyone else follows in seat order.
- **Follow suit if you can.** If you hold the led suit you must play it.
- If you cannot follow suit, you may play anything, including trump.
- **Trump may not be LED until it is "broken".** Trump starts closed at the beginning of
  every hand and opens the moment any trump is played (whether as a ruff or legally led).
  While trump is closed, a player on lead may not lead a trump — unless their hand contains
  nothing but trumps, in which case leading one is forced and legal.
  (Also a house rule: standard Court Piece has no trump-broken restriction.)
- **Winning the trick:**
  - If any trump was played, the highest trump wins.
  - Otherwise the highest card **of the led suit** wins.
  - A card of any other suit can never win — it is a discard.
  - Note this means the Ace of a side suit does NOT beat the 2 of trump. Compare suits
    first, values second; never compare raw values across suits.
- The winner of a trick leads the next.
- A hand is **13 tricks**.

Implement a single `getPlayableCards(hand, ledSuit)` function that returns the legal
subset, and route the human's card highlighting, the AI, and any multiplayer move
validation through it. That keeps the follow-suit and trump-broken rules in one place.

## 4. Winning a hand

- A hand ends **immediately** when a team reaches **7 tricks** (majority of 13). The
  loser's remaining cards are never played.
- Winning a hand scores **1 point** for that team.
- Keep a "if all 13 are played, most tricks wins" fallback as defensive code, but note it
  is mathematically unreachable: 6 + 6 = 12 < 13, so some team always reaches 7 first.
  There is no "going" and no trick-difference scoring — one hand is worth exactly 1 point
  whether it was won 7–0 or 7–6.

## 5. Winning the match

- **First team to 7 hand-wins takes the match.**
- A **COAT** is a 7–0 match win. Track and celebrate it; it has no extra scoring effect.
- **Ace Catches King (instant win):** if the **Ace of trump and the King of trump are
  played in the same trick by opposing teams**, the Ace holder's team **wins the entire
  match immediately** — regardless of who played first, and regardless of the score. Check
  this after every card. Same-team Ace+King does nothing. (House rule; it is the single
  most dramatic thing in the game, so make sure it is unmissable when it fires.)

⚠️ **Terminology warning.** Keep your labels unambiguous. There are exactly two levels:
**tricks** (13 per hand) and **hands** (first to 7 wins the match). Do not label hand
counts "games" — that confusion makes a 4–1 score look like a finished best-of-7.

## 6. Trump caller rotation

- Hand 1 of a match: **south**. (Every new match restarts at south.)
- After each hand the call goes to the **team that won that hand**. Which member of that
  team calls is decided by flipping against the *current* caller — the teams do **not**
  each remember their own last caller:
  - Winner is Team Red → caller becomes `north` if the current caller is `south`,
    otherwise `south`.
  - Winner is Team Blue → caller becomes `west` if the current caller is `east`,
    otherwise `east`.

  The full table, which is easier to implement from than prose:

  | current caller | Red wins → | Blue wins → |
  |---|---|---|
  | south | north | east |
  | north | south | east |
  | east  | south | west |
  | west  | south | east |

  So a team that keeps winning alternates between its two players, but whenever the call
  **crosses to the other team it always lands on that team's default member** — south for
  Red, east for Blue — regardless of which of the two called last time that team held it.
- On a **redeal**, the caller does not change: the same player calls again.

## 7. The AI opponent

Deterministic, no difficulty levels, no search or lookahead. It thinks for ~1s before
playing. **It uses only public information** — the cards played so far this hand, the
cards on the table, and its own hand. It must never read another player's hidden hand.

Track for the AI:
- `playedCards` — every card played this hand.
- `playerVoids` — per seat, the set of suits that player has shown they're void in. Mark a
  player void in the led suit whenever they fail to follow it. Reset both every hand.

Helper it needs: `beats(card, currentWinner, ledSuit, trump)` implementing §3's rules, and
`outstanding(suit, myHand)` returning ranks of that suit not yet seen (not played, not on
the table, not in its own hand).

**Choosing trump** (from its 5 cards): pick the suit it holds most of; ties break
S, H, D, C. Ranks are ignored.

**Decision order each turn** — first match wins:

1. **Endgame:** if its own team is on 6 hand-wins (match point), play the **Ace of trump**
   at the first legal opportunity — unless its partner is currently winning the trick.
   (This is the Ace Catches King gambit.)

2. **Following suit, partner currently winning:**
   - Last to play, **or** partner won by ruffing → play lowest.
   - Partner winning with A or K → play lowest (conserve honours).
   - Partner winning with a card below 10, opponent still to come → overtake with its
     cheapest honour (value ≥ 10); none → lowest.
   - Otherwise (partner winning with 10/J/Q) → play lowest.

3. **Following suit, opponent winning:**
   - Cannot beat the winner → play lowest of the led suit. (Includes the case where an
     opponent has ruffed — don't waste an honour on a trick you cannot win.)
   - Last to play and can win → cheapest winning card.
   - Someone still to play after it → play the **cheapest winning card that nothing
     outstanding in that suit can beat**; if it holds no such card, play its **highest**
     winner ("third hand high"). *This matters: taking the trick with the cheapest winner
     when a player is still to come is how an AI loses a trick it held the Ace for.*

4. **Cannot follow suit, partner winning:** discard the lowest non-trump. Only ruff if its
   hand is nothing but trumps (forced).

5. **Cannot follow suit, opponent winning:**
   - Ruff only with a trump that **actually beats** the current winner — cheapest such.
   - **King protection:** while the trump Ace is unseen, avoid ruffing with the trump King.
     Prefer another winning trump; if the King is the only one, use it only when an
     opponent is known void in the led suit; otherwise discard a non-trump instead.
   - If no trump can beat the winner → **discard a non-trump** rather than burn a trump.
     Only throw a trump if it holds no non-trump.

6. **Leading:** lead the highest card from a "safe" suit, where a suit is safe only if
   **neither opponent is known void in it** (they would ruff). If no suit is safe, lead the
   highest non-trump. If it has no playable non-trump, lead its lowest trump.
   *Get the void test right: a suit is dangerous if ANY opponent is void, not only if all
   of them are.*

## 8. Game flow

A simple state machine: `INIT → TRUMP_SELECTION → PLAYING → (TRICK_OVER → PLAYING) ×13 →
HAND_OVER → (next hand | GAME_OVER)`.

- Pacing that makes it readable: ~1s before an AI plays, ~1.5s pause showing a completed
  trick before it is collected, ~2s between hands.
- Reset per hand: trick counts, trump-broken flag, played cards, void table.
- Reset per match: hand scores, trump caller back to south.
- Track every timer you schedule and cancel them all when the player leaves a game —
  otherwise an abandoned hand keeps advancing on top of the next one.

## 9. Interface essentials (keep it simple)

- Show each player's hand position, whose turn it is, the trump suit, trick count and hand
  score, and the cards played in the current trick.
- **Highlight which of the human's cards are legally playable** and disable the rest —
  derived from the same `getPlayableCards`, never a second implementation.
- Show the human's hand face-up; opponents' hands face-down (a count is enough).
- Announce trick wins, hand wins, redeals, COAT and Ace Catches King.

## 10. Optional: online multiplayer

If you add it, make the **host authoritative**. When a guest sends a move the host must
verify: the move came from the connection that owns that seat (never trust a seat named in
the message), it is that seat's turn, the card is genuinely in that hand, and the card is
legal under §3 — then play the host's own copy of the card, not the one on the wire. Never
broadcast the undealt deck or any hand but the recipient's. When a player drops mid-hand,
convert their seat to AI so play continues.

## Test these specifically

They are the cases a rules implementation most often gets wrong:

1. Ace of a side suit does **not** beat the 2 of trump.
2. A player cannot lead trump before it is broken — but can if their hand is all trumps.
3. A hand ends the instant a team reaches 7 tricks, not after all 13 are played.
4. Ace + King of trump on opposing teams in one trick ends the **match**, at any score.
5. Any player dealt zero trumps forces a full redeal by the same caller.
6. The AI never ruffs under a higher trump when it holds a discard.
7. The AI never leads a suit it has seen an opponent ruff.
8. Third hand plays a card that cannot be overtaken, not merely one that currently wins.
