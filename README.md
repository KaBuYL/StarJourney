# Desktop Pet Memo (星游记)

A lightweight desktop pet widget built with Electron. The pet sits on top of your screen and transforms into a checkbox memo with a completion history.

## Features

- Floating, frameless, always-on-top desktop pet
- Switches between a compact pet form and an expanded memo form
- Checkbox to-do list with persistent storage
- History tracking for completed items
- Draggable window and system tray controls (show/hide/quit)
- Data saved locally as JSON

## Tech Stack

- [Electron](https://www.electronjs.org/)
- HTML / CSS / JavaScript

## Getting Started

Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm start
```

## Build

```bash
# Windows installer (NSIS)
npm run pack-setup

# Unpacked folder build
npm run pack-folder

# Default build target
npm run dist
```

## Data Storage

To-dos and history are stored in a local `Star-Adventure-data/pet-memo-data.json` file next to the project directory.

## Author

KaBu.Lhz

## License

MIT
