# Firebase Multiplayer System Upgrade Guide

This document outlines the complete upgrade to add Firebase Realtime Database support alongside the existing PeerJS system for the Trump card game.

## Overview

The upgrade adds:
1. **Dual Multiplayer System**: Keep PeerJS for P2P, add Firebase for server-based games
2. **Quick Match**: Automatic matchmaking with queue system
3. **Play with Friends**: Friend invites via user IDs
4. **Reconnection Support**: Players can rejoin if disconnected
5. **Game State Persistence**: Firebase stores game state for recovery
6. **Backward Compatibility**: All existing PeerJS features remain functional

## 1. Firebase Configuration

### Update Firebase Config (Already in place)
The Firebase SDK scripts and basic initialization are already added. We need to add Realtime Database support:

```javascript
// After existing Firebase initialization
const rtdb = firebase.database();
const firebaseEnabled = true;
```

## 2. Firebase Multiplayer Manager Class

Add this complete class after the Firebase initialization:

```javascript
// --- FIREBASE MULTIPLAYER MANAGER ---
class FirebaseMultiplayerManager {
    constructor() {
        this.currentGameRef = null;
        this.currentGameId = null;
        this.userId = null;
        this.gameStateListeners = [];
        this.matchmakingRef = null;
        this.connectionMode = 'firebase';
        this.myPosition = null;
    }

    setUserId(uid) {
        this.userId = uid;
    }

    // Quick Match: Join matchmaking queue
    async joinMatchmakingQueue(playerName, gameMode = '4-player') {
        if (!this.userId) throw new Error("User not authenticated");

        const queueRef = rtdb.ref(`matchmaking/queue/${gameMode}`);
        const playerRef = queueRef.push();
        
        await playerRef.set({
            userId: this.userId,
            playerName: playerName,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            status: 'waiting'
        });

        this.matchmakingRef = playerRef;
        
        // Listen for match found
        return new Promise((resolve, reject) => {
            playerRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data && data.gameId) {
                    this.currentGameId = data.gameId;
                    playerRef.off('value');
                    resolve(data.gameId);
                }
            });

            // Trigger matchmaking
            setTimeout(() => this.checkForMatches(gameMode), 1000);

            // Timeout after 60 seconds
            setTimeout(() => {
                if (!this.currentGameId) {
                    playerRef.off('value');
                    this.leaveMatchmakingQueue();
                    reject(new Error("Matchmaking timeout"));
                }
            }, 60000);
        });
    }

    async checkForMatches(gameMode) {
        const queueRef = rtdb.ref(`matchmaking/queue/${gameMode}`);
        const snapshot = await queueRef.orderByChild('status')
            .equalTo('waiting').limitToFirst(4).once('value');
        const waitingPlayers = [];

        snapshot.forEach((child) => {
            const data = child.val();
            if (data && !data.gameId) {
                waitingPlayers.push({ key: child.key, ...data });
            }
        });

        // Need at least 2 players for a match
        if (waitingPlayers.length >= 2) {
            const gameId = 'game_' + Date.now() + '_' + 
                Math.random().toString(36).substr(2, 9);
            const playersForGame = waitingPlayers.slice(0, 4);

            await this.createGameRoom(gameId, playersForGame);

            // Update queue with gameId
            const updates = {};
            playersForGame.forEach(player => {
                updates[`matchmaking/queue/${gameMode}/${player.key}/gameId`] = gameId;
                updates[`matchmaking/queue/${gameMode}/${player.key}/status`] = 'matched';
            });
            
            await rtdb.ref().update(updates);
        }
    }

    async leaveMatchmakingQueue() {
        if (this.matchmakingRef) {
            await this.matchmakingRef.remove();
            this.matchmakingRef = null;
        }
    }

    async createGameRoom(gameId, players) {
        const gameRef = rtdb.ref(`games/${gameId}`);
        const positions = ['south', 'north', 'east', 'west'];
        const playerMap = {};
        
        players.forEach((player, index) => {
            if (index < positions.length) {
                playerMap[positions[index]] = {
                    userId: player.userId,
                    playerName: player.playerName,
                    connected: false
                };
            }
        });

        // Fill empty slots with AI
        positions.forEach(pos => {
            if (!playerMap[pos]) {
                playerMap[pos] = {
                    userId: `ai_${pos}`,
                    playerName: `${pos.charAt(0).toUpperCase() + pos.slice(1)} (AI)`,
                    connected: true,
                    isAI: true
                };
            }
        });

        await gameRef.set({
            players: playerMap,
            gameState: {
                status: 'waiting',
                currentPlayer: 'south',
                trumpSuit: null,
                matchScores: { teamRed: 0, teamBlue: 0 },
                handTrickCounts: { teamRed: 0, teamBlue: 0 }
            },
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastActivity: firebase.database.ServerValue.TIMESTAMP
        });

        return gameId;
    }

    async joinGameRoom(gameId) {
        this.currentGameId = gameId;
        this.currentGameRef = rtdb.ref(`games/${gameId}`);

        // Find player's position
        const snapshot = await this.currentGameRef.child('players').once('value');
        const players = snapshot.val();
        let myPosition = null;

        for (const pos in players) {
            if (players[pos].userId === this.userId) {
                myPosition = pos;
                break;
            }
        }

        if (myPosition) {
            await this.currentGameRef.child(`players/${myPosition}/connected`).set(true);
            this.myPosition = myPosition;
            this.setupPresence(myPosition);
        }

        return { myPosition, players };
    }

    setupPresence(position) {
        if (!this.currentGameRef) return;

        const presenceRef = this.currentGameRef.child(`players/${position}/connected`);
        const connectedRef = rtdb.ref('.info/connected');

        connectedRef.on('value', (snapshot) => {
            if (snapshot.val() === true) {
                presenceRef.set(true);
                presenceRef.onDisconnect().set(false);
            }
        });
    }

    listenToGameState(callback) {
        if (!this.currentGameRef) return;

        const listener = this.currentGameRef.child('gameState').on('value', (snapshot) => {
            const state = snapshot.val();
            if (state) callback(state);
        });

        this.gameStateListeners.push({ 
            ref: this.currentGameRef.child('gameState'), 
            listener 
        });
    }

    async updateGameState(stateUpdate) {
        if (!this.currentGameRef) return;
        await this.currentGameRef.child('gameState').update(stateUpdate);
        await this.currentGameRef.child('lastActivity')
            .set(firebase.database.ServerValue.TIMESTAMP);
    }

    listenToActions(callback) {
        if (!this.currentGameRef) return;
        this.currentGameRef.child('actions').on('child_added', (snapshot) => {
            const action = snapshot.val();
            if (action) callback(action);
        });
    }

    async broadcastAction(action) {
        if (!this.currentGameRef) return;
        await this.currentGameRef.child('actions').push({
            ...action,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    async inviteFriend(friendId, playerName) {
        if (!this.userId) throw new Error("User not authenticated");

        const gameId = 'private_' + Date.now() + '_' + 
            Math.random().toString(36).substr(2, 9);
        
        // Create private game
        const gameRef = rtdb.ref(`games/${gameId}`);
        await gameRef.set({
            players: {
                south: {
                    userId: this.userId,
                    playerName: playerName,
                    connected: false
                }
            },
            gameState: {
                status: 'waiting',
                currentPlayer: 'south',
                trumpSuit: null,
                matchScores: { teamRed: 0, teamBlue: 0 },
                handTrickCounts: { teamRed: 0, teamBlue: 0 }
            },
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastActivity: firebase.database.ServerValue.TIMESTAMP,
            isPrivate: true,
            host: this.userId
        });

        // Send invite
        const inviteRef = rtdb.ref(`invites/${friendId}`).push();
        await inviteRef.set({
            gameId: gameId,
            fromUserId: this.userId,
            fromPlayerName: playerName,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            status: 'pending'
        });

        this.currentGameId = gameId;
        return gameId;
    }

    listenToInvites(callback) {
        if (!this.userId) return;

        const invitesRef = rtdb.ref(`invites/${this.userId}`);
        invitesRef.on('child_added', (snapshot) => {
            const invite = snapshot.val();
            if (invite && invite.status === 'pending') {
                callback({ inviteId: snapshot.key, ...invite });
            }
        });
    }

    async acceptInvite(inviteId, gameId) {
        await rtdb.ref(`invites/${this.userId}/${inviteId}/status`)
            .set('accepted');
        this.currentGameId = gameId;
    }

    disconnect() {
        this.gameStateListeners.forEach(({ ref, listener }) => {
            ref.off('value', listener);
        });
        this.gameStateListeners = [];

        if (this.currentGameRef) {
            this.currentGameRef.off();
            this.currentGameRef = null;
        }
        this.currentGameId = null;
    }
}

// Initialize Firebase manager
const firebaseManager = new FirebaseMultiplayerManager();
```

## 3. Event Listeners for New Buttons

Add these event listeners where the other button listeners are (around line 4200+):

```javascript
// Quick Match button
document.getElementById('quick-match-btn').addEventListener('click', async () => {
    myName = nameInput.value.trim() || 'Player';
    
    // Show quick match view
    menuMain.style.display = 'none';
    document.getElementById('menu-quick-match').style.display = 'block';
    
    try {
        // Set user ID
        if (currentUser) {
            firebaseManager.setUserId(currentUser.uid);
        }
        
        // Join matchmaking
        const gameId = await firebaseManager.joinMatchmakingQueue(myName);
        
        // Join the matched game
        const { myPosition, players } = await firebaseManager.joinGameRoom(gameId);
        
        // Update UI
        isMultiplayer = true;
        isHost = false;
        connectionMode = 'firebase';
        lobbyPlayers = players;
        myPosition = myPosition;
        
        // Update player names
        for (const pos of POSITIONS) {
            if (players[pos]) {
                playerNames[pos] = players[pos].playerName;
            }
        }
        
        updatePlayerAreaNames();
        hideModal();
        document.getElementById('menu-btn').style.display = 'flex';
        
        // Start listening to game state
        firebaseManager.listenToGameState((state) => {
            syncGameStateFromFirebase(state);
        });
        
        // Start game
        initMatch();
        
    } catch (error) {
        console.error("Matchmaking error:", error);
        document.getElementById('matchmaking-status').textContent = 
            'Matchmaking failed: ' + error.message;
        document.getElementById('matchmaking-status').className = 'status-error';
    }
});

// Cancel matchmaking
document.getElementById('cancel-matchmaking-btn').addEventListener('click', async () => {
    await firebaseManager.leaveMatchmakingQueue();
    backToMenu();
});

// Play with Friends button
document.getElementById('play-with-friends-btn').addEventListener('click', () => {
    menuMain.style.display = 'none';
    document.getElementById('menu-friends').style.display = 'block';
    
    // Show user's friend ID (their Firebase UID)
    if (currentUser) {
        document.getElementById('friend-id-display').textContent = currentUser.uid;
        firebaseManager.setUserId(currentUser.uid);
        
        // Listen for invites
        firebaseManager.listenToInvites((invite) => {
            showInviteNotification(invite);
        });
    }
});

// Copy friend ID
document.getElementById('copy-friend-id-btn').addEventListener('click', () => {
    if (currentUser) {
        navigator.clipboard.writeText(currentUser.uid).then(() => {
            const btn = document.getElementById('copy-friend-id-btn');
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 2000);
        });
    }
});

// Invite friend
document.getElementById('invite-friend-btn').addEventListener('click', async () => {
    const friendId = document.getElementById('friend-id-input').value.trim();
    myName = nameInput.value.trim() || 'Player';
    
    if (!friendId) {
        document.getElementById('friends-status').textContent = 
            'Please enter a friend ID';
        document.getElementById('friends-status').className = 'status-error';
        return;
    }
    
    try {
        const gameId = await firebaseManager.inviteFriend(friendId, myName);
        
        document.getElementById('friends-status').textContent = 
            'Invite sent! Waiting for friend to join...';
        document.getElementById('friends-status').className = 'status-connected';
        
        // Join the game as host
        const { myPosition, players } = await firebaseManager.joinGameRoom(gameId);
        
        isMultiplayer = true;
        isHost = true;
        connectionMode = 'firebase';
        myPosition = myPosition;
        
        // Wait for friend and start game
        firebaseManager.listenToGameState((state) => {
            syncGameStateFromFirebase(state);
        });
        
    } catch (error) {
        console.error("Invite error:", error);
        document.getElementById('friends-status').textContent = 
            'Failed to send invite: ' + error.message;
        document.getElementById('friends-status').className = 'status-error';
    }
});

// Friends back button
document.getElementById('friends-back-btn').addEventListener('click', () => {
    document.getElementById('menu-friends').style.display = 'none';
    menuMain.style.display = 'block';
});
```

## 4. Helper Functions

Add these helper functions:

```javascript
// Sync game state from Firebase
function syncGameStateFromFirebase(state) {
    if (!state) return;
    
    // Update local game state from Firebase
    if (state.trumpSuit) {
        trumpSuit = state.trumpSuit;
        updateTrumpDisplay();
    }
    
    if (state.currentPlayer) {
        currentPlayer = state.currentPlayer;
        highlightActivePlayer(currentPlayer);
    }
    
    if (state.matchScores) {
        matchScores = state.matchScores;
        updateScoreDisplay();
    }
    
    if (state.handTrickCounts) {
        handTrickCounts = state.handTrickCounts;
        updateHandScoreDisplay();
    }
    
    if (state.status === 'playing' && currentPlayer === myPosition) {
        highlightPlayableCards();
        updateStatusMessage("Your turn. Select a card to play.");
    }
}

// Show invite notification
function showInviteNotification(invite) {
    const message = `${invite.fromPlayerName} invited you to play!`;
    const accept = confirm(message + '\n\nAccept invite?');
    
    if (accept) {
        acceptFriendInvite(invite);
    }
}

async function acceptFriendInvite(invite) {
    try {
        await firebaseManager.acceptInvite(invite.inviteId, invite.gameId);
        
        const { myPosition, players } = await firebaseManager.joinGameRoom(invite.gameId);
        
        isMultiplayer = true;
        isHost = false;
        connectionMode = 'firebase';
        myPosition = myPosition;
        lobbyPlayers = players;
        
        // Update player names
        for (const pos of POSITIONS) {
            if (players[pos]) {
                playerNames[pos] = players[pos].playerName;
            }
        }
        
        updatePlayerAreaNames();
        hideModal();
        document.getElementById('menu-btn').style.display = 'flex';
        
        // Start listening to game state
        firebaseManager.listenToGameState((state) => {
            syncGameStateFromFirebase(state);
        });
        
        // Listen to actions (card plays, etc)
        firebaseManager.listenToActions((action) => {
            handleFirebaseAction(action);
        });
        
        initMatch();
        
    } catch (error) {
        console.error("Failed to accept invite:", error);
        alert("Failed to join game");
    }
}

function handleFirebaseAction(action) {
    switch (action.type) {
        case 'cardPlayed':
            if (action.player !== myPosition) {
                playCardFromNetwork(action.player, action.card);
            }
            break;
        case 'trumpSelected':
            if (action.player !== myPosition) {
                setTrumpFromNetwork(action.suit);
            }
            break;
        case 'reaction':
            showReaction(action.position, action.emoji);
            break;
    }
}
```

## 5. Integration with Existing Game Logic

### In playCard() function:
Add Firebase broadcast when using Firebase mode:

```javascript
function playCard(player, card) {
    // ... existing code ...
    
    // Broadcast in multiplayer
    if (isMultiplayer) {
        if (connectionMode === 'firebase') {
            firebaseManager.broadcastAction({
                type: 'cardPlayed',
                player: player,
                card: card
            });
            
            // Update game state
            firebaseManager.updateGameState({
                currentPlayer: currentPlayer,
                currentHand: currentHand,
                handTrickCounts: handTrickCounts
            });
        } else if (isHost) {
            // Existing PeerJS broadcast
            broadcast({ type: 'cardPlayed', player: player, card: card });
            sendGameState();
        }
    }
    
    // ... rest of existing code ...
}
```

### In setTrump() function:
Add Firebase broadcast:

```javascript
function setTrump(suit) {
    // ... existing code ...
    
    if (isMultiplayer) {
        if (connectionMode === 'firebase') {
            firebaseManager.broadcastAction({
                type: 'trumpSelected',
                suit: suit,
                player: currentPlayer
            });
            
            firebaseManager.updateGameState({
                trumpSuit: suit,
                status: 'playing'
            });
        } else if (isHost) {
            // Existing PeerJS broadcast
            broadcast({ type: 'trumpSelected', suit: suit });
        }
    }
    
    // ... rest of existing code ...
}
```

## 6. Firebase Database Structure

```
firebase-realtime-database/
├── matchmaking/
│   └── queue/
│       └── 4-player/
│           ├── {playerId1}: { userId, playerName, timestamp, status, gameId? }
│           └── {playerId2}: { userId, playerName, timestamp, status, gameId? }
│
├── games/
│   └── {gameId}/
│       ├── players/
│       │   ├── south: { userId, playerName, connected }
│       │   ├── north: { userId, playerName, connected }
│       │   ├── east: { userId, playerName, connected }
│       │   └── west: { userId, playerName, connected }
│       ├── gameState/
│       │   ├── status: "waiting" | "playing" | "finished"
│       │   ├── currentPlayer: "south" | "north" | "east" | "west"
│       │   ├── trumpSuit: "S" | "H" | "D" | "C" | null
│       │   ├── matchScores: { teamRed: 0, teamBlue: 0 }
│       │   └── handTrickCounts: { teamRed: 0, teamBlue: 0 }
│       ├── actions/
│       │   └── {actionId}: { type, player, card?, timestamp }
│       ├── reactions/
│       │   └── {reactionId}: { position, emoji, timestamp }
│       ├── createdAt: timestamp
│       ├── lastActivity: timestamp
│       └── isPrivate?: boolean
│
└── invites/
    └── {userId}/
        └── {inviteId}/
            ├── gameId: string
            ├── fromUserId: string
            ├── fromPlayerName: string
            ├── timestamp: number
            └── status: "pending" | "accepted" | "rejected"
```

## 7. Firebase Security Rules

Add these rules to Firebase Realtime Database:

```json
{
  "rules": {
    "matchmaking": {
      "queue": {
        "$gameMode": {
          ".read": true,
          "$playerId": {
            ".write": "!data.exists() || data.child('userId').val() === auth.uid"
          }
        }
      }
    },
    "games": {
      "$gameId": {
        ".read": "data.child('players').child('south').child('userId').val() === auth.uid || 
                  data.child('players').child('north').child('userId').val() === auth.uid || 
                  data.child('players').child('east').child('userId').val() === auth.uid || 
                  data.child('players').child('west').child('userId').val() === auth.uid",
        ".write": "data.child('players').child('south').child('userId').val() === auth.uid || 
                   data.child('players').child('north').child('userId').val() === auth.uid || 
                   data.child('players').child('east').child('userId').val() === auth.uid || 
                   data.child('players').child('west').child('userId').val() === auth.uid"
      }
    },
    "invites": {
      "$userId": {
        ".read": "$userId === auth.uid",
        ".write": "auth != null"
      }
    }
  }
}
```

## 8. Testing Checklist

- [ ] Quick Match finds opponents
- [ ] Quick Match creates game room with 2-4 players
- [ ] Friend invites are sent and received
- [ ] Friend invites can be accepted
- [ ] Game state syncs across all players
- [ ] Card plays are broadcast correctly
- [ ] Trump selection syncs
- [ ] Disconnected players can reconnect
- [ ] Presence system works (connected/disconnected)
- [ ] PeerJS mode still works (backward compatibility)
- [ ] AI fills empty slots in matchmaking

## 9. Deployment Notes

1. Set up Firebase project at https://console.firebase.google.com
2. Enable Realtime Database
3. Enable Anonymous Authentication
4. Add security rules from section 7
5. Update firebase config in index.html with your project credentials
6. Deploy and test

## Summary

This upgrade maintains full backward compatibility with the existing PeerJS system while adding robust Firebase-based multiplayer features. Users can choose between:
- **Play vs AI**: Original single-player experience
- **Quick Match**: Firebase matchmaking for instant games
- **Play with Friends**: Firebase-based friend invites
- **Host/Join Game (P2P)**: Original PeerJS peer-to-peer system

All features coexist harmoniously, and the game automatically handles reconnections and state synchronization.
