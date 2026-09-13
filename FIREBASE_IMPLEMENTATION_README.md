# Firebase Multiplayer Implementation - Quick Start Guide

## Files Created

1. **FIREBASE_MULTIPLAYER_UPGRADE.md** - Complete implementation guide with detailed explanations
2. **firebase_code_snippets.js** - Copy-paste ready JavaScript code
3. **firebase-database-rules.json** - Firebase Realtime Database security rules
4. **This README** - Quick implementation steps

## Quick Implementation Steps

### Step 1: Firebase Project Setup

1. Go to https://console.firebase.google.com
2. Create a new project or use existing one
3. Enable **Realtime Database** (not Firestore)
4. Enable **Anonymous Authentication** under Authentication > Sign-in method
5. Get your Firebase config from Project Settings > General

### Step 2: Update Firebase Config

In `index.html`, find the Firebase config section (around line 1764) and update with your credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### Step 3: Add Firebase Realtime Database SDK

The Firebase Realtime Database scripts are already added in the HTML head. Verify these lines exist:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/firebase/9.22.0/firebase-app-compat.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/firebase/9.22.0/firebase-database-compat.js"></script>
```

### Step 4: Insert Firebase Manager Code

Open `firebase_code_snippets.js` and copy the code sections in order:

1. **Section 1**: Insert after `auth.onAuthStateChanged` (around line 1795)
   - This adds the Firebase Multiplayer Manager class
   
2. **Section 2**: Insert before `// --- EVENT LISTENERS ---` (around line 4100)
   - This adds helper functions

3. **Section 3**: Insert with other button event listeners (around line 4200)
   - This adds event handlers for new buttons

4. **Section 4 & 5**: Modify existing `playCard()` and `setTrump()` functions
   - Add Firebase broadcasting alongside existing PeerJS code

### Step 5: Configure Firebase Database Rules

1. Go to Firebase Console > Realtime Database > Rules
2. Copy the contents of `firebase-database-rules.json`
3. Paste into the Rules editor
4. Click "Publish"

### Step 6: Test the Implementation

1. Open the game in a browser
2. Enter your name
3. Try each multiplayer option:
   - **Quick Match** - Should find opponents or create AI game
   - **Play with Friends** - Should show your Friend ID
   - **Host Game (P2P)** - Original PeerJS system should still work
   - **Join Game (P2P)** - Original PeerJS system should still work

## New Features Overview

### Quick Match
- Automatic matchmaking
- Finds 2-4 players
- Fills empty slots with AI
- 60-second timeout if no match found

### Play with Friends
- Each user gets a unique Friend ID (their Firebase UID)
- Send invite by entering friend's ID
- Friend receives pop-up notification
- Can accept/reject invite
- Creates private game room

### Reconnection Support
- Players marked as "connected/disconnected" in Firebase
- Game state persists in database
- Disconnected players can rejoin same game
- Presence system using Firebase `.info/connected`

### Backward Compatibility
- All original PeerJS features remain
- "Host Game (P2P)" and "Join Game (P2P)" still work
- No changes to AI mode
- Existing saves and stats unaffected

## Database Structure

```
matchmaking/
  queue/
    4-player/
      {playerId}: { userId, playerName, timestamp, status, gameId }

games/
  {gameId}/
    players/
      south: { userId, playerName, connected, isAI? }
      north: { userId, playerName, connected, isAI? }
      east: { userId, playerName, connected, isAI? }
      west: { userId, playerName, connected, isAI? }
    gameState/
      status: "waiting" | "playing" | "finished"
      currentPlayer: "south" | "north" | "east" | "west"
      trumpSuit: "S" | "H" | "D" | "C" | null
      matchScores: { teamRed: 0, teamBlue: 0 }
      handTrickCounts: { teamRed: 0, teamBlue: 0 }
    actions/
      {actionId}: { type, player, card?, timestamp }
    reactions/
      {reactionId}: { position, emoji, timestamp }
    createdAt: timestamp
    lastActivity: timestamp
    isPrivate?: boolean
    host?: userId

invites/
  {userId}/
    {inviteId}/
      gameId: string
      fromUserId: string
      fromPlayerName: string
      timestamp: number
      status: "pending" | "accepted" | "rejected"
```

## Troubleshooting

### Matchmaking not working
- Check Firebase Realtime Database is enabled (not Firestore)
- Verify database rules are published
- Check browser console for errors
- Ensure anonymous auth is enabled

### Friend invites not received
- Both users must be signed in
- Friend ID must be exact (case-sensitive)
- Check Firebase console for invite in `/invites/{friendId}/`
- Verify database rules allow reads

### Game state not syncing
- Check all players are connected (presence indicators)
- Verify `lastActivity` timestamp updating in database
- Check `actions` node receiving new entries
- Look for errors in browser console

### PeerJS mode broken
- Ensure you didn't modify existing PeerJS code
- Check `connectionMode` variable is set correctly
- Verify original broadcast() function intact

## Testing Checklist

- [ ] Quick Match creates game with 2+ players
- [ ] AI fills empty slots in matchmaking
- [ ] Friend ID displayed correctly
- [ ] Friend invites sent successfully
- [ ] Friend invites received and show notification
- [ ] Game state syncs across players
- [ ] Card plays broadcast correctly
- [ ] Trump selection syncs
- [ ] Reactions work across Firebase
- [ ] Disconnection/reconnection works
- [ ] PeerJS mode still functional
- [ ] AI mode still functional

## Performance Considerations

- Matchmaking queue cleaned up automatically
- Old games (1+ hour inactive) should be cleaned periodically
- Consider adding cloud function for cleanup:

```javascript
// Cloud Function (optional)
exports.cleanupOldGames = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const snapshot = await admin.database().ref('games').once('value');
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const updates = {};
    
    snapshot.forEach((child) => {
      const game = child.val();
      if (game.lastActivity && (now - game.lastActivity > oneHour)) {
        updates[child.key] = null;
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await admin.database().ref('games').update(updates);
    }
  });
```

## Cost Estimates

Firebase Realtime Database free tier:
- 1 GB stored
- 10 GB/month downloaded
- 100 simultaneous connections

Typical usage per game:
- ~50 KB per game room
- ~10 KB per player action
- ~1 MB per 100 games

Should support thousands of concurrent games on free tier.

## Support & Resources

- Firebase Docs: https://firebase.google.com/docs/database
- PeerJS Docs: https://peerjs.com/docs
- Trump Game Repo: (your repo URL here)

## Next Steps

After implementing basic Firebase multiplayer:

1. Add friend lists (persistent friend connections)
2. Add game history/replays
3. Add leaderboards
4. Add chat system
5. Add tournaments
6. Add spectator mode
7. Add game recordings

## License

Same as main project

---

**Questions or Issues?**
Check the detailed guide in `FIREBASE_MULTIPLAYER_UPGRADE.md` or create an issue in the repository.
