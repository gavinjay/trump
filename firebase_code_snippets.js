/**
 * FIREBASE MULTIPLAYER CODE SNIPPETS
 *
 * These code snippets can be inserted into index.html to add Firebase multiplayer support.
 * Insert them in the appropriate locations as indicated by the comments.
 */

// ===========================================
// 1. INSERT AFTER: auth.onAuthStateChanged
// BEFORE: // --- CONSTANTS ---
// ===========================================

// Initialize Realtime Database
const rtdb = firebase.database();
const firebaseEnabled = true;

// Track connection mode
let connectionMode = null; // 'firebase' or 'peerjs'

// Update Firebase manager when user signs in
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        console.log("Signed in as:", user.uid);
        firebaseManager.setUserId(user.uid);
        initializeUserStats();
    }
});

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

        return new Promise((resolve, reject) => {
            playerRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data && data.gameId) {
                    this.currentGameId = data.gameId;
                    playerRef.off('value');
                    resolve(data.gameId);
                }
            });

            setTimeout(() => this.checkForMatches(gameMode), 1000);

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

        if (waitingPlayers.length >= 2) {
            const gameId = 'game_' + Date.now() + '_' +
                Math.random().toString(36).substr(2, 9);
            const playersForGame = waitingPlayers.slice(0, 4);

            await this.createGameRoom(gameId, playersForGame);

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

const firebaseManager = new FirebaseMultiplayerManager();

// ===========================================
// 2. HELPER FUNCTIONS
// INSERT BEFORE: // --- EVENT LISTENERS ---
// ===========================================

// Sync game state from Firebase
function syncGameStateFromFirebase(state) {
    if (!state) return;

    if (state.trumpSuit && state.trumpSuit !== trumpSuit) {
        trumpSuit = state.trumpSuit;
        updateTrumpDisplay();
        if (myPosition) {
            sortHand(players[myPosition].hand);
            renderAllHands();
        }
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

        const { myPosition: pos, players } = await firebaseManager.joinGameRoom(invite.gameId);

        isMultiplayer = true;
        isHost = false;
        connectionMode = 'firebase';
        myPosition = pos;
        lobbyPlayers = players;

        for (const position of POSITIONS) {
            if (players[position]) {
                playerNames[position] = players[position].playerName;
            }
        }

        updatePlayerAreaNames();
        hideModal();
        document.getElementById('menu-btn').style.display = 'flex';

        firebaseManager.listenToGameState((state) => {
            syncGameStateFromFirebase(state);
        });

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

// ===========================================
// 3. EVENT LISTENERS FOR NEW BUTTONS
// INSERT WITH OTHER BUTTON EVENT LISTENERS
// ===========================================

// Quick Match button
document.getElementById('quick-match-btn').addEventListener('click', async () => {
    myName = nameInput.value.trim() || 'Player';

    menuMain.style.display = 'none';
    document.getElementById('menu-quick-match').style.display = 'block';

    try {
        if (currentUser) {
            firebaseManager.setUserId(currentUser.uid);
        }

        const gameId = await firebaseManager.joinMatchmakingQueue(myName);

        const { myPosition: pos, players } = await firebaseManager.joinGameRoom(gameId);

        isMultiplayer = true;
        isHost = false;
        connectionMode = 'firebase';
        myPosition = pos;
        lobbyPlayers = players;

        for (const position of POSITIONS) {
            if (players[position]) {
                playerNames[position] = players[position].playerName;
            }
        }

        updatePlayerAreaNames();
        hideModal();
        document.getElementById('menu-btn').style.display = 'flex';

        firebaseManager.listenToGameState((state) => {
            syncGameStateFromFirebase(state);
        });

        firebaseManager.listenToActions((action) => {
            handleFirebaseAction(action);
        });

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

    if (currentUser) {
        document.getElementById('friend-id-display').textContent = currentUser.uid;
        firebaseManager.setUserId(currentUser.uid);

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

        const { myPosition: pos, players } = await firebaseManager.joinGameRoom(gameId);

        isMultiplayer = true;
        isHost = true;
        connectionMode = 'firebase';
        myPosition = pos;

        firebaseManager.listenToGameState((state) => {
            syncGameStateFromFirebase(state);
        });

        firebaseManager.listenToActions((action) => {
            handleFirebaseAction(action);
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

// ===========================================
// 4. MODIFY playCard() FUNCTION
// ADD THIS INSIDE playCard() AFTER EXISTING BROADCAST CODE
// ===========================================

// Inside playCard() function, after existing multiplayer broadcast:
if (isMultiplayer && connectionMode === 'firebase') {
    firebaseManager.broadcastAction({
        type: 'cardPlayed',
        player: player,
        card: card
    });

    firebaseManager.updateGameState({
        currentPlayer: currentPlayer,
        handTrickCounts: handTrickCounts
    });
}

// ===========================================
// 5. MODIFY setTrump() FUNCTION
// ADD THIS INSIDE setTrump() AFTER EXISTING BROADCAST CODE
// ===========================================

// Inside setTrump() function, after existing multiplayer broadcast:
if (isMultiplayer && connectionMode === 'firebase') {
    firebaseManager.broadcastAction({
        type: 'trumpSelected',
        suit: suit,
        player: currentPlayer
    });

    firebaseManager.updateGameState({
        trumpSuit: suit,
        status: 'playing'
    });
}

// ===========================================
// 6. MODIFY sendReaction() FUNCTION
// ADD THIS INSIDE sendReaction() FOR FIREBASE MODE
// ===========================================

// Inside sendReaction() function:
if (isMultiplayer && connectionMode === 'firebase') {
    firebaseManager.broadcastAction({
        type: 'reaction',
        position: position,
        emoji: emoji
    });
}
