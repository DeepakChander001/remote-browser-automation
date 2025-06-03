# Remote Browser Automation Suite

**Control, view, and automate remote browser sessions securely using WebRTC, WebSockets, and AI-powered natural language translation.**

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Components](#components)
  - [Relay Server (Node.js)](#relay-server-nodejs)
  - [Translator API (Python/Flask)](#translator-api-pythonflask)
  - [Browser Extension](#browser-extension)
  - [TURN Server](#turn-server)
- [Setup & Installation](#setup--installation)
- [Usage](#usage)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This project enables **remote browser automation** by combining a WebSocket relay server, a browser extension, a natural language-to-command translator API, and a TURN server for robust WebRTC connectivity. It allows users to control or view a browser remotely, send natural language commands, and stream browser video/audio in real time.

---

## Architecture

```
[Viewer Extension] <--WebRTC/WS--> [Relay Server] <--HTTP--> [Translator API]
      ^                                                        |
      |                                                        v
[Controller Extension] <--WebRTC/WS--> [Relay Server]     [TURN Server]
```

- **Relay Server:** Manages device pairing, relays commands and WebRTC streams.
- **Translator API:** Converts natural language prompts into browser automation commands using OpenAI.
- **Browser Extension:** Provides UI and automation logic for both controller and viewer.
- **TURN Server:** Ensures reliable WebRTC connections across NAT/firewalls.

---

## Features

- 🔒 **Secure Device Pairing** (6-digit codes)
- 🗣️ **Natural Language to Command Translation** (OpenAI GPT-4)
- 🖥️ **Real-Time Browser Streaming** (WebRTC)
- 🕹️ **Remote Control & Automation** (click, type, scroll, search, navigate)
- 🌐 **Cross-Network Connectivity** (TURN server support)
- 🧩 **Easy-to-Use Browser Extension** (Chrome/Edge/Brave)
- 🛠️ **Modular, Extensible, and Open Source**

---

## Components

### Relay Server (Node.js)

- **Path:** `relay-server/`
- **Purpose:** WebSocket server for device registration, authentication, pairing, and relaying commands/streams.
- **Key Dependencies:** `ws`, `jsonwebtoken`, `dotenv`, `node-fetch`
- **Scripts:**
  - `npm start` – Start the relay server
  - `npm run dev` – Start with hot-reload (nodemon)
- **Token Generation:** Use `generate-token.js` to create JWT tokens for devices.

### Translator API (Python/Flask)

- **Path:** `translator-api/`
- **Purpose:** REST API that translates natural language prompts into browser automation commands using OpenAI.
- **Key Dependencies:** `Flask`, `flask-cors`, `openai`, `python-dotenv`, `gunicorn`
- **Endpoints:**
  - `POST /translate` – Translate a prompt to a command
  - `GET /health` – Health check

### Browser Extension

- **Path:** `extension/`
- **Purpose:** Chrome-compatible extension for both controller and viewer roles.
- **Features:**
  - Select mode (Controller/Viewer)
  - Pair devices using a code
  - Send/receive commands and stream video
  - UI for sending prompts and viewing streams
- **Permissions:** `debugger`, `tabCapture`, `storage`, `tabs`, `activeTab`

### TURN Server

- **Path:** `turn-server/`
- **Purpose:** [coturn](https://github.com/coturn/coturn) configuration for reliable WebRTC relay.
- **Config:** `turnserver.conf` (edit with your public/private IPs and credentials)

---

## Setup & Installation

### Prerequisites

- Node.js (v16+)
- Python 3.8+
- Chrome/Edge/Brave browser
- [coturn](https://github.com/coturn/coturn) (for TURN server)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/remote-browser-automation.git
cd remote-browser-automation
```

### 2. Environment Variables

Create a `.env` file in the root with:

```
# For relay-server and translator-api
JWT_SECRET=your-super-secret-key
OPENAI_API_KEY=your-openai-api-key
```

### 3. Install Dependencies

#### Relay Server

```bash
cd relay-server
npm install
```

#### Translator API

```bash
cd ../translator-api
pip install -r requirements.txt
```

### 4. Start the Services

#### Start Relay Server

```bash
cd relay-server
npm start
```

#### Start Translator API

```bash
cd ../translator-api
python app.py
# or for production:
# gunicorn -b 0.0.0.0:5000 app:app
```

#### Start TURN Server

Edit `turn-server/turnserver.conf` and run:

```bash
turnserver -c turn-server/turnserver.conf
```

#### Load the Extension

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder

---

## Usage

1. **Open the extension** in your browser.
2. **Select a mode:**
   - **Controller:** Generates a pairing code to share.
   - **Viewer:** Enter the pairing code to connect.
3. **Send natural language commands** (e.g., "Search for AI news") from the viewer.
4. **Watch the remote browser** and control it in real time.

---

## Security

- **JWT tokens** are used for device authentication.
- **Pairing codes** expire after 5 minutes.
- **Environment variables** should be kept secret and never committed.
- **TURN server** should use strong credentials and TLS in production.

---

## Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check [issues page](https://github.com/yourusername/remote-browser-automation/issues).

---

## License

This project is licensed under the MIT License.

---

**Made with ❤️ for secure, AI-powered remote browser automation.**
