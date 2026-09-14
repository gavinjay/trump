# Firebase Multiplayer Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Trump Card Game                          │
│                     Multiplayer System                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
       ┌────────────────┐            ┌────────────────┐
       │   PeerJS Mode  │            │ Firebase Mode  │
       │   (Existing)   │            │     (New)      │
       └────────────────┘            └────────────────┘
                │                             │
                │                             │
    ┌───────────┴───────────┐    ┌───────────┴────────────┐
    │                       │    │                        │
    ▼                       ▼    ▼                        ▼
┌────────┐            ┌────────┐ ┌────────┐        ┌────────┐
│  Host  │◄──P2P────►│  Join  │ │ Quick  │        │ Friends│
│  Game  │            │  Game  │ │ Match  │        │ Invite │
└────────┘            └────────┘ └────────┘        └────────┘
    │                       │         │                  │
    │                       │         │                  │
    │    Direct WebRTC      │         │  Firebase RTDB   │
    └───────────────────────┘         └──────────────────┘
```

## Quick Match Flow

```
┌─────────────┐
│   Player    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Click "Quick Match"
       ▼
┌──────────────────────────────┐
│  Firebase Matchmaking Queue  │
│  /matchmaking/queue/4-player │
└──────┬───────────────────────┘
       │
       │ 2. Add to queue
       │    { userId, playerName, status: "waiting" }
       │
       │ 3. Check for matches (2-4 players)
       ▼
┌──────────────────────┐
│  Create Game Room    │
│  /games/{gameId}     │
│  - Assign positions  │
│  - Fill with AI      │
└──────┬───────────────┘
       │
       │ 4. Update queue entries with gameId
       ▼
┌──────────────────┐
│  Players Join    │
│  Game Room       │
│  - Set connected │
│  - Setup presence│
└──────┬───────────┘
       │
       │ 5. Listen to gameState
       │ 6. Listen to actions
       ▼
┌──────────────┐
│  Game Starts │
└──────────────┘
```

## Friend Invite Flow

```
Player A                Firebase                Player B
   │                       │                       │
   │ 1. Get Friend ID      │                       │
   │◄──────────────────────┤                       │
   │   (Firebase UID)      │                       │
   │                       │                       │
   │ 2. Send Invite        │                       │
   ├──────────────────────►│                       │
   │   to Friend B's UID   │                       │
   │                       │                       │
   │                       │ 3. Invite notification│
   │                       ├──────────────────────►│
   │                       │   "Player A invited   │
   │                       │    you to play!"      │
   │                       │                       │
   │                       │ 4. Accept Invite      │
   │                       │◄──────────────────────┤
   │                       │                       │
   │ 5. Both join game     │ 6. Both join game     │
   ├──────────────────────►│◄──────────────────────┤
   │                       │                       │
   │ 7. Game State Sync    │ 8. Game State Sync    │
   │◄──────────────────────┼──────────────────────►│
   │                       │                       │
```

## Game State Synchronization

```
┌──────────────────────────────────────────────────┐
│              Firebase Realtime DB                │
│                                                  │
│  /games/{gameId}/                                │
│    ├── players/                                  │
│    │   ├── south: {connected: true}              │
│    │   ├── north: {connected: false} ←──┐        │
│    │   ├── east: {connected: true}      │        │
│    │   └── west: {connected: true, isAI}│        │
│    │                                     │        │
│    ├── gameState/                    Reconnect   │
│    │   ├── currentPlayer: "south"       │        │
│    │   ├── trumpSuit: "H"               │        │
│    │   ├── matchScores: {teamRed: 2...  │        │
│    │   └── handTrickCounts: {...}       │        │
│    │                                     │        │
│    ├── actions/ (queue)                 │        │
│    │   ├── action1: {type: "cardPlayed"}│        │
│    │   └── action2: {type: "trumpSel...}│        │
│    │                                     │        │
│    └── reactions/                        │        │
│        └── reaction1: {emoji: "👍"}      │        │
│                                          │        │
└──────────────────────────────────────────┼────────┘
                                           │
                    Player disconnected ───┘
                    but can rejoin anytime!
```

## Dual Multiplayer System

```
                  User Menu
                     │
      ┌──────────────┼──────────────┐
      │              │              │
      ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│Play vs AI│  │ Firebase │  │  PeerJS  │
│  (Local) │  │   Mode   │  │   Mode   │
└──────────┘  └────┬─────┘  └────┬─────┘
                   │             │
        ┌──────────┼──────┐      │
        ▼          ▼      ▼      ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │ Quick  │ │Friends │ │  Host  │
    │ Match  │ │ Invite │ │  Join  │
    └────────┘ └────────┘ └────────┘
        │          │          │
        │          │          │
        ▼          ▼          ▼
    ┌──────────────────────────┐
    │    Game Play Engine      │
    │  (Shared for all modes)  │
    └──────────────────────────┘
```

## Data Flow During Card Play

```
Player Action: Play Card
         │
         ▼
┌────────────────────┐
│  Local Game State  │
│  - Remove card     │
│  - Add to trick    │
└────────┬───────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
┌────────────────┐  ┌────────────────┐
│  PeerJS Mode   │  │  Firebase Mode │
│  broadcast()   │  │  broadcastAct()│
└────────┬───────┘  └────────┬───────┘
         │                   │
         │                   ▼
         │          ┌─────────────────┐
         │          │ Firebase RTDB   │
         │          │ /actions/push() │
         │          └────────┬────────┘
         │                   │
         ▼                   ▼
┌─────────────────────────────────────┐
│      Other Players Receive          │
│  - PeerJS: conn.on('data')          │
│  - Firebase: .on('child_added')     │
└─────────┬───────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Update UI          │
│  - Render card      │
│  - Update trick     │
│  - Next turn        │
└─────────────────────┘
```

## Reconnection Mechanism

```
Player Disconnects
       │
       ▼
┌──────────────────────┐
│ Firebase detects     │
│ .info/connected      │
│ = false              │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ onDisconnect()       │
│ triggers:            │
│ players/{pos}/       │
│   connected = false  │
└──────┬───────────────┘
       │
       │ Game continues
       │ with remaining
       │ players
       │
Player Reconnects
       │
       ▼
┌──────────────────────┐
│ 1. Sign in           │
│ 2. Find gameId       │
│ 3. joinGameRoom()    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Read current state:  │
│ - gameState          │
│ - players            │
│ - Recent actions     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Resume game from     │
│ current position     │
│ - Sync UI            │
│ - Set presence       │
└──────────────────────┘
```

## Security Model

```
┌──────────────────────────────────────┐
│     Firebase Security Rules          │
└──────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
    ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐
│Matching│ │ Games  │ │Invites │
│ Queue  │ │  Room  │ │        │
└────────┘ └────────┘ └────────┘
    │         │         │
    │         │         │
Read: ✓     Read: ✓    Read: ✓
Anyone    If player   Own only
          in game
    │         │         │
Write: ✓    Write: ✓   Write: ✓
Own entry  If player   Anyone
only      in game    (to send)
```

## Component Interaction

```
┌─────────────────────────────────────────────┐
│           HTML/CSS Layer                    │
│  - Menu buttons                             │
│  - Game board                               │
│  - Modals                                   │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│         JavaScript Game Engine              │
│  - Game logic (cards, tricks, scoring)      │
│  - UI rendering                             │
│  - Player management                        │
└──┬────────────────────────────────────────┬─┘
   │                                        │
   │ ┌──────────────────────────────────┐  │
   └►│  Multiplayer Manager Layer       │◄─┘
     │  ┌────────────┐  ┌────────────┐  │
     │  │  PeerJS    │  │  Firebase  │  │
     │  │  Manager   │  │  Manager   │  │
     │  └──────┬─────┘  └─────┬──────┘  │
     └─────────┼──────────────┼──────────┘
               │              │
               ▼              ▼
         ┌──────────┐   ┌──────────┐
         │ PeerJS   │   │ Firebase │
         │ Network  │   │ Realtime │
         │          │   │ Database │
         └──────────┘   └──────────┘
```

## Key Benefits

### Firebase Mode
✓ Server-based matchmaking
✓ Persistent game state
✓ Reconnection support
✓ No peer discovery needed
✓ Works behind firewalls
✓ Centralized game state

### PeerJS Mode
✓ Direct P2P connection
✓ Lower latency
✓ No server costs
✓ More privacy
✓ Works offline (local network)
✓ Existing feature maintained

### Both Modes Share
✓ Same game engine
✓ Same UI/UX
✓ Same card logic
✓ Same scoring system
✓ Seamless switching
