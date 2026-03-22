# Gen-AI

## Agentic Big-Brother Style 3D Simulation Prototype

This project now includes a browser-based 3D simulation where eight autonomous characters (4 male, 4 female) move around a house compound with:

- 4 bedrooms
- 2 kitchens
- 2 bathrooms
- hall/social core
- garden

It supports:

- Personality-driven movement and behavior loops.
- Random show events (party, conflict, blackout) that alter house dynamics.
- Side control panel with chat command input to summon events/characters.
- A top-down “game-like” camera view inspired by social-sim/Among-Us style readability.

## Run

Because this is an ES module app, run from a local web server:

```bash
python3 -m http.server 8000
```

Then open:

- http://localhost:8000

## Example Chat Commands

- `event party`
- `event conflict`
- `event blackout`
- `spawn male`
- `spawn female`
- `mood conflict`
- `mood calm`
