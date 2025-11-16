# Blanko Frontend

A Vite + React frontend scaffold for the Blanko dashboard.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Dashboard/      # Main dashboard component
│   │   ├── Topbar/         # Top navigation bar
│   │   ├── TemplatesIsland/ # Templates display component
│   │   └── Boards/         # Boards grid and cards
│   ├── hooks/              # Custom React hooks
│   ├── styles/             # Global styles and CSS variables
│   ├── App.jsx             # Root component
│   └── main.jsx            # Entry point
└── package.json
```

