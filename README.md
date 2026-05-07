# Uptime Monitor

Built with Node.js, Express, and TypeScript.

## Setup

### Prerequisites

- Node.js v18+
- npm

### Install

```
git clone https://github.com/your-username/uptime-monitor.git
cd uptime-monitor
npm install
```

### Configure

Create a `.env` file in the project root:

```
PORT=3000
MASTER_KEY=your-secret-key-here
```

`MASTER_KEY` must be at least 16 characters. The server will refuse to start without it.

### Run

```
# Development
npm run dev

# Production
npm run build
npm start

# Linux quick-start (installs Node if needed, builds, and starts)
bash run-linux.sh
```

## Usage

- **`/`** — public status page, no auth required
- **`/login`** — enter your master key to access the admin panel
- **`/admin`** — create, edit, and delete monitors

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/status` | All monitor data |
| `GET` | `/api/monitors` | List monitors |
| `GET` | `/api/monitor/:id` | Get a monitor |
| `POST` | `/api/monitor`  | Create `{ name, url }` |
| `PUT` | `/api/monitor/:id` | Update `{ name?, url? }` |
| `DELETE` | `/api/monitor/:id` | Delete a monitor |
| `GET` | `/api/checks/:id` | All checks for a monitor |
| `GET` | `/api/check/:id` | Latest check for a monitor |
| `GET` | `/api/total/:id` | Total check count |

## License

[MIT](LICENSE)
