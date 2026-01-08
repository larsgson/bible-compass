# Bible Compass

A React + Vite application for exploring Bible translations across languages and regions.

## Features

- 🌍 Select from 1700+ languages with autocomplete search
- 📍 Choose from various regions worldwide
- 📱 Responsive design optimized for both mobile and desktop
- ⚡ Built with Vite for fast development and builds

## Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (v8 or higher)

## Installation

```bash
# Install dependencies
pnpm install
```

## Development

```bash
# Start the development server
pnpm dev
```

The app will be available at `http://localhost:3000`

## Build

```bash
# Build for production
pnpm build
```

## Preview Production Build

```bash
# Preview the production build locally
pnpm preview
```

## Project Structure

```
bible-compass/
├── public/
│   ├── ALL-langs-mini.json        # Language codes
│   ├── ALL-langs-data/
│   │   └── summary.json           # Language full names
│   └── regions.json               # Region data
├── src/
│   ├── components/
│   │   ├── Menu.jsx               # Navigation menu
│   │   ├── Settings.jsx           # Settings page
│   │   ├── LanguageAutocomplete.jsx
│   │   ├── RegionAutocomplete.jsx
│   │   └── *.css                  # Component styles
│   ├── App.jsx                    # Main app component
│   ├── main.jsx                   # App entry point
│   └── index.css                  # Global styles
├── index.html
├── vite.config.js
└── package.json
```

## Data Sources

The application uses three main data files:

- **ALL-langs-mini.json**: Contains language codes organized by canon (OT/NT) and media type
- **ALL-langs-data/summary.json**: Contains full language names and vernacular names
- **regions.json**: Contains region names and their associated languages

## Technology Stack

- React 18
- Vite 5
- CSS3 with responsive design
- Native JavaScript (no additional UI libraries)