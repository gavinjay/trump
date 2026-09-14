# Firebase Multiplayer Testing Guide

## Pre-Testing Checklist

Before running tests, ensure:

- [ ] Firebase project created
- [ ] Realtime Database enabled
- [ ] Anonymous Authentication enabled
- [ ] Database rules published
- [ ] Firebase config updated in index.html
- [ ] All code snippets inserted correctly
- [ ] No JavaScript errors in console

## Test Environment Setup

### Required Tools
- 2-4 browser windows/tabs (or different browsers)
- Firebase Console open
- Browser DevTools console open
- Network connection

### Recommended Setup
```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Browser 1 │  │  Browser 2 │  │  Firebase  │
│  (Player A)│  │  (Player B)│  │  Console   │
│            │  │            │  │            │
│  DevTools  │  │  DevTools  │  │  Database  │
│  Open      │  │  Open      │  │  Tab Open  │
└────────────┘  └────────────┘  └────────────┘
```

## Test Suite

### 1. Basic Firebase Connection Test

**Objective**: Verify Firebase initializes correctly

**Steps**:
1. Open game in browser
2. Open DevTools Console
3. Look for: "Signed in as: {uid}"

**Expected Results**:
- ✅ No Firebase errors in console
- ✅ User UID displayed
- ✅ Firebase authenticated message

**Troubleshooting**:
- ❌ "Firebase not defined" → Check script tags loaded
- ❌ "Auth error" → Check Firebase config
- ❌ "Permission denied" → Check database rules

### 2. Quick Match Test (Single Player)

**Objective**: Test matchmaking with AI fill

**Steps**:
1. Enter name "Player 1"
2. Click "Quick Match"
3. Wait up to 10 seconds

**Expected Results**:
- ✅ Status changes to "Finding opponent..."
- ✅ Game starts with AI players in empty slots
- ✅ myPosition assigned (south/north/east/west)
- ✅ Game board renders correctly

**Firebase Console Check**:
```
/matchmaking/queue/4-player/
  {randomId}/
    userId: {uid}
    playerName: "Player 1"
    status: "matched"
    gameId: "game_..."
```

**Troubleshooting**:
- ❌ Timeout after 60s → Check matchmaking logic
- ❌ No AI players → Check createGameRoom function
- ❌ Wrong position → Check joinGameRoom logic

### 3. Quick Match Test (Two Players)

**Objective**: Test actual player matchmaking

**Steps**:
1. **Browser 1**: Enter "Player A", click "Quick Match"
2. **Browser 2**: Enter "Player B", click "Quick Match"
3. Both should be matched within 2 seconds

**Expected Results**:
- ✅ Both players in same game
- ✅ gameId matches in both browsers
- ✅ Players assigned different positions
- ✅ Game starts for both players
- ✅ Remaining 2 slots filled with AI

**Firebase Console Check**:
```
/games/{gameId}/
  players/
    south: { userId: {uid1}, playerName: "Player A" }
    north: { userId: "ai_north", playerName: "North (AI)", isAI: true }
    east: { userId: {uid2}, playerName: "Player B" }
    west: { userId: "ai_west", playerName: "West (AI)", isAI: true }
```

**Troubleshooting**:
- ❌ Players not matched → Check checkForMatches function
- ❌ Same position assigned → Check position assignment logic
- ❌ Game not starting → Check initMatch calls

### 4. Friend Invite Test

**Objective**: Test friend invitation system

**Steps**:
1. **Browser 1** (Player A):
   - Enter name "Player A"
   - Click "Play with Friends"
   - Copy Friend ID (Firebase UID)
   
2. **Browser 2** (Player B):
   - Enter name "Player B"
   - Click "Play with Friends"
   - Paste Player A's Friend ID
   - Click "Send Invite"
   
3. **Browser 1**:
   - Should see invite notification
   - Click "Accept"

**Expected Results**:
- ✅ Friend ID displayed correctly
- ✅ Invite sent successfully
- ✅ Browser 1 receives notification
- ✅ Both players join same game
- ✅ Private game created (isPrivate: true)

**Firebase Console Check**:
```
/invites/{Player A UID}/
  {inviteId}/
    gameId: "private_..."
    fromUserId: {Player B UID}
    fromPlayerName: "Player B"
    status: "accepted"
```

**Troubleshooting**:
- ❌ No invite received → Check listenToInvites setup
- ❌ Wrong Friend ID → Verify UID copied correctly
- ❌ Can't accept → Check acceptInvite function

### 5. Game State Sync Test

**Objective**: Verify game state synchronizes across players

**Setup**: Use Quick Match to get 2 players in game

**Steps**:
1. Player A's turn
2. Player A plays a card
3. Watch Player B's screen

**Expected Results**:
- ✅ Card appears in trick area on both screens
- ✅ Current player indicator updates
- ✅ Card counts update on both screens
- ✅ Turn passes correctly

**Firebase Console Check** (during play):
```
/games/{gameId}/
  gameState/
    currentPlayer: "east"  (updates after each play)
    handTrickCounts: { teamRed: 1, teamBlue: 0 }
  actions/
    {actionId}/
      type: "cardPlayed"
      player: "south"
      card: { suit: "H", rank: "A", ... }
      timestamp: 1234567890
```

**Troubleshooting**:
- ❌ Card not appearing → Check broadcastAction
- ❌ Wrong player's turn → Check currentPlayer sync
- ❌ Counts wrong → Check handTrickCounts update

### 6. Trump Selection Sync Test

**Objective**: Verify trump selection syncs

**Setup**: Start new game with 2 players

**Steps**:
1. Player who gets to select trump chooses a suit
2. Watch other player's screen

**Expected Results**:
- ✅ Trump suit displays on both screens
- ✅ Cards re-sort on both screens
- ✅ Game continues normally

**Firebase Console Check**:
```
/games/{gameId}/
  gameState/
    trumpSuit: "H"
    status: "playing"
  actions/
    {actionId}/
      type: "trumpSelected"
      suit: "H"
      player: "south"
```

**Troubleshooting**:
- ❌ Trump not showing → Check trumpSelected action
- ❌ Cards not sorted → Check setTrumpFromNetwork
- ❌ Game stuck → Check status update

### 7. Reconnection Test

**Objective**: Test player reconnection

**Steps**:
1. Start game with 2 players
2. Player A closes browser tab (or refreshes)
3. Player A reopens game
4. Player A should see option to rejoin

**Expected Results**:
- ✅ Firebase marks player as disconnected
- ✅ Game continues for connected players
- ✅ Player can rejoin same game
- ✅ Game state restored correctly
- ✅ Player position maintained

**Firebase Console Check**:
```
/games/{gameId}/
  players/
    south/
      connected: false  (when disconnected)
      connected: true   (when rejoined)
```

**Troubleshooting**:
- ❌ Can't rejoin → Check joinGameRoom logic
- ❌ Wrong game state → Check sync on rejoin
- ❌ Lost cards → Check hand restoration

### 8. Reaction System Test

**Objective**: Verify reactions work in Firebase mode

**Steps**:
1. In active game, click reaction button (😊)
2. Select an emoji
3. Watch other player's screen

**Expected Results**:
- ✅ Reaction appears above player area
- ✅ Other players see the reaction
- ✅ Reaction disappears after 8 seconds

**Firebase Console Check**:
```
/games/{gameId}/
  reactions/
    {reactionId}/
      position: "south"
      emoji: "👍"
      timestamp: 1234567890
```

**Troubleshooting**:
- ❌ Reaction not showing → Check broadcastAction for reactions
- ❌ Wrong player → Check position mapping
- ❌ Not disappearing → Check timeout logic

### 9. Presence System Test

**Objective**: Verify online/offline detection

**Steps**:
1. Start game with multiple players
2. Simulate disconnect (close tab, kill network)
3. Check Firebase Console
4. Reconnect

**Expected Results**:
- ✅ Player marked as disconnected immediately
- ✅ onDisconnect() triggers automatically
- ✅ Other players see disconnect status
- ✅ Reconnect restores presence

**Firebase Console Check**:
```
/games/{gameId}/
  players/
    south/
      connected: true/false  (real-time)
```

**Troubleshooting**:
- ❌ Not detecting disconnect → Check setupPresence
- ❌ Delayed detection → Firebase network issue
- ❌ Not reconnecting → Check .info/connected listener

### 10. Backward Compatibility Test

**Objective**: Ensure PeerJS mode still works

**Steps**:
1. Click "Host Game (P2P)"
2. Copy game code
3. In another browser, click "Join Game (P2P)"
4. Enter code
5. Play game

**Expected Results**:
- ✅ PeerJS connection established
- ✅ Game code generation works
- ✅ Joining via code works
- ✅ Game plays normally
- ✅ No Firebase involved

**Console Check**:
```
connectionMode: "peerjs"  (not "firebase")
```

**Troubleshooting**:
- ❌ PeerJS broken → Review code changes
- ❌ Code not working → Check peer initialization
- ❌ Can't connect → Network/firewall issue

## Performance Tests

### Test 11: Multiple Concurrent Games

**Objective**: Test system under load

**Steps**:
1. Open 8 browser tabs
2. Start 4 Quick Match games (2 players each)
3. Play simultaneously

**Expected Results**:
- ✅ All games work independently
- ✅ No cross-game interference
- ✅ Firebase handles concurrent writes
- ✅ No lag or delays

### Test 12: Rapid Actions

**Objective**: Test rapid successive actions

**Steps**:
1. In a 2-player game
2. Play cards as fast as possible
3. Monitor sync

**Expected Results**:
- ✅ All actions processed in order
- ✅ No actions lost
- ✅ Game state remains consistent
- ✅ No race conditions

### Test 13: Database Size

**Objective**: Monitor database growth

**Steps**:
1. Play 10 complete games
2. Check Firebase usage

**Expected Results**:
- ✅ Old games eventually cleaned up
- ✅ Database stays under limits
- ✅ No memory leaks

## Edge Cases

### Test 14: Network Issues

**Scenarios to test**:
- Slow network (throttle in DevTools)
- Intermittent connection
- Complete network loss then recovery

### Test 15: Browser Compatibility

**Test on**:
- Chrome
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

### Test 16: Multiple Devices

**Test scenarios**:
- Desktop + Mobile
- Tablet + Desktop
- Different screen sizes

## Automation Script

Create this test script for quick validation:

```javascript
// firebase-test-suite.js
async function runFirebaseTests() {
    const tests = [
        testFirebaseConnection,
        testQuickMatch,
        testFriendInvite,
        testGameStateSync,
        testReconnection
    ];
    
    for (const test of tests) {
        try {
            await test();
            console.log(`✅ ${test.name} passed`);
        } catch (error) {
            console.error(`❌ ${test.name} failed:`, error);
        }
    }
}

async function testFirebaseConnection() {
    if (!currentUser) throw new Error("Not authenticated");
    if (!firebaseManager.userId) throw new Error("Manager not initialized");
}

async function testQuickMatch() {
    const gameId = await firebaseManager.joinMatchmakingQueue("Test Player");
    if (!gameId) throw new Error("No game created");
    await firebaseManager.leaveMatchmakingQueue();
}

// Add more test functions...

// Run in console
runFirebaseTests();
```

## Troubleshooting Common Issues

### Issue: "Firebase not defined"
**Solution**: Check script tag order in HTML head

### Issue: "Permission denied" 
**Solution**: Verify database rules published correctly

### Issue: "Matchmaking timeout"
**Solution**: 
1. Check Firebase console for queue entries
2. Verify checkForMatches() runs
3. Look for errors in console

### Issue: "Game state not syncing"
**Solution**:
1. Check listenToGameState() called
2. Verify updateGameState() executes
3. Check Firebase console for updates

### Issue: "Can't reconnect"
**Solution**:
1. Check game still exists in database
2. Verify userId matches
3. Check presence setup

## Success Criteria

All tests should pass with:
- ✅ No console errors
- ✅ Smooth gameplay
- ✅ Instant synchronization (< 500ms lag)
- ✅ Successful reconnections
- ✅ Data persists correctly
- ✅ PeerJS mode unaffected
- ✅ Mobile responsive

## Reporting Issues

When reporting issues, include:
1. Test number and name
2. Expected vs actual behavior
3. Browser and version
4. Console errors (screenshot)
5. Firebase Console screenshot
6. Network tab (if relevant)
7. Steps to reproduce

## Next Steps After Testing

Once all tests pass:
1. Test on production Firebase project
2. Enable Firebase monitoring
3. Set up analytics
4. Configure backup rules
5. Add error tracking (Sentry, etc.)
6. Performance monitoring
7. User feedback collection

## Test Results Template

```
Test Date: _______________
Tester: _______________
Browser: _______________

| Test # | Test Name | Result | Notes |
|--------|-----------|--------|-------|
| 1 | Firebase Connection | ✅/❌ | |
| 2 | Quick Match (AI) | ✅/❌ | |
| 3 | Quick Match (2P) | ✅/❌ | |
| 4 | Friend Invite | ✅/❌ | |
| 5 | Game State Sync | ✅/❌ | |
| 6 | Trump Selection | ✅/❌ | |
| 7 | Reconnection | ✅/❌ | |
| 8 | Reactions | ✅/❌ | |
| 9 | Presence | ✅/❌ | |
| 10 | PeerJS Mode | ✅/❌ | |

Overall Status: ✅ PASS / ❌ FAIL
```
