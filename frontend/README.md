# Blanko Frontend

A Vite + React frontend scaffold for the Blanko application.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The development server will start at `http://localhost:5173` by default.

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Lint code with ESLint

## Project Structure

```
frontend/
├── src/
│   ├── components/      # React components
│   │   ├── Dashboard/   # Main dashboard view
│   │   ├── Topbar/      # Top navigation bar
│   │   ├── TemplatesIsland/ # Template selection
│   │   └── Boards/      # Boards grid view
│   ├── hooks/           # Custom React hooks
│   ├── styles/          # Global styles and CSS variables
│   ├── App.jsx          # Root component
│   └── main.jsx         # Entry point
├── index.html           # HTML template
└── package.json         # Dependencies and scripts
```

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **ESLint** - Code linting
