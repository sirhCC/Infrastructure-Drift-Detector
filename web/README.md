# Web Dashboard

A Next.js-based web dashboard for Infrastructure Drift Detector.

## Features

- **Real-time Drift Visualization**: View drift detection results in real-time
- **Resource Dependency Graph**: Visualize infrastructure dependencies
- **Historical Trends**: Track drift patterns over time
- **Multi-Project Support**: Manage multiple infrastructure projects
- **Interactive Reports**: Filter, search, and analyze drift data

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd web
npm install
```

### Development

```bash
# Start the API server (in root directory)
npm run dashboard

# Start the Next.js dev server (in web directory)
cd web
npm run dev
```

The dashboard will be available at `http://localhost:3000`
The API server runs at `http://localhost:3001`

### Production Build

```bash
cd web
npm run build
npm start
```

## Project Structure

```
web/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── projects/          # Projects view
│   ├── scans/             # Scans view
│   └── resources/         # Resources view
├── components/            # React components
│   ├── ui/               # UI components (shadcn/ui)
│   ├── charts/           # Chart components
│   ├── graphs/           # Dependency graph
│   └── tables/           # Data tables
├── lib/                  # Utility functions
│   ├── api.ts           # API client
│   └── utils.ts         # Helper functions
├── public/              # Static assets
└── package.json
```

## Configuration

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_PREFIX=/api
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Charts**: Recharts
- **Graphs**: React Flow
- **State Management**: React Query
- **HTTP Client**: Axios

## API Endpoints

The dashboard connects to these API endpoints:

- `GET /api/health` - Health check
- `GET /api/projects` - List projects
- `POST /api/scan` - Trigger a scan
- `GET /api/scans` - List recent scans
- `GET /api/history/:projectId` - Get project history
- `GET /api/history/:projectId/stats` - Get statistics
- `GET /api/history/:projectId/trends` - Get trend data
- `GET /api/resources/:projectId` - List resources

## Development Notes

This is a placeholder structure for the web dashboard. The full implementation includes:

1. **Real-time Updates**: WebSocket support for live drift notifications
2. **Advanced Filtering**: Complex query builder for resources
3. **Custom Visualizations**: Interactive charts and graphs
4. **Export Functionality**: Download reports in various formats
5. **User Management**: Authentication and authorization (future)

## Contributing

The dashboard is actively being developed. Key areas for contribution:

- Additional chart types
- Enhanced filtering capabilities
- Real-time WebSocket integration
- Mobile responsive design improvements

## License

MIT
