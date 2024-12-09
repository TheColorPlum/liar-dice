# Liar's Dice Game

A multiplayer implementation of the classic Liar's Dice game using Next.js, TypeScript, and WebSocket for real-time gameplay.

## Project Structure

```
liar-dice/
├── app/                    # Next.js app directory
├── components/            # React components
│   ├── GameBoard.tsx     # Main game board display
│   ├── GameControls.tsx  # Game control buttons and setup screens
│   ├── GameLog.tsx       # Game event log display
│   └── LiarsDice.tsx     # Main game component
├── types/                # TypeScript type definitions
│   └── game.ts          # Game-related types and constants
├── utils/               # Utility functions
│   ├── computerAI.ts    # Computer player logic
│   ├── gameLogic.ts     # Core game rules and logic
│   └── socketHandler.ts # WebSocket communication handler
```

## Features

- Single player mode with AI opponents
- Multiplayer mode with real-time gameplay
- Customizable number of players (2-6)
- Game log tracking all actions
- End-game scenarios
- Automatic dice rolling
- Challenge system
- Room-based multiplayer

## Game Rules

1. Each player starts with 5 dice
2. Players take turns making bids about the total number of dice showing a particular value
3. A bid consists of a quantity and a value (e.g., "four 3's")
4. Each new bid must be higher than the previous bid (either in quantity or value)
5. Players can challenge the previous bid if they think it's false
6. Ones (1's) are wild and count as any value
7. The loser of each round loses one die
8. Players are eliminated when they lose all their dice
9. The last player with dice wins

### End Game Rules
- When only two players remain with one die each, the bidding changes
- Players only bid on the total value of both dice
- The higher bid wins unless challenged

## Technical Implementation

### Components

- **GameBoard**: Handles the display of players, dice, and current game state
- **GameControls**: Manages game setup and control actions
- **GameLog**: Displays a scrollable history of game events
- **LiarsDice**: Main component orchestrating game flow

### Utilities

- **computerAI.ts**: Implements computer player strategy
  - Probability-based decision making
  - Dynamic risk assessment
  - Adaptive bidding strategy

- **gameLogic.ts**: Core game mechanics
  - Bid validation
  - Challenge resolution
  - Game state management

- **socketHandler.ts**: Real-time communication
  - WebSocket event handling
  - Room management
  - Player synchronization

## Setup and Running

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development

### Adding New Features

1. Define types in `types/game.ts`
2. Implement game logic in `utils/`
3. Create/update components in `components/`
4. Update socket handlers if needed

### Testing

Run the test suite:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - feel free to use this code for your own projects!
