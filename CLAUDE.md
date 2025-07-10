# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an ECharts-based analytics dashboard for visualizing public transportation complaint/feedback data from Elasticsearch. It's a single-page application with no build process - all dependencies are loaded via CDN.

## Development Commands

Since this is a static site with no package.json:
```bash
# Start local development server
python -m http.server 8000
# Access at http://localhost:8000
```

## Architecture

### Technology Stack
- **Frontend**: Vanilla JavaScript (no framework)
- **Charts**: ECharts v5.4.3 (CDN)
- **HTTP Client**: Axios v1.6.0 (CDN)
- **Excel Export**: SheetJS/XLSX v0.18.5 (CDN)
- **Styling**: Custom CSS with glassmorphism effects

### Data Flow
1. Elasticsearch API → Axios → Data Processing → ECharts → UI
2. Fallback to mock data if CORS issues occur
3. Auto-refresh every 5 minutes

### Key Files
- `index.html`: Dashboard layout with 4 tabs (Overview, Detailed Reports, Analytics, Export)
- `app.js`: Core logic - Elasticsearch queries, chart initialization, data processing
- `styles.css`: Dark theme with modern animations and responsive design

## Important Configuration

### Elasticsearch Connection
In app.js:21, the Elasticsearch endpoint is configured:
```javascript
const ELASTICSEARCH_URL = 'http://124.158.5.222:9400/report_test/_search/';
```

### Chart Types Implemented
The dashboard includes 15+ chart types organized across tabs:
- Pie charts for distribution analysis (source, type, severity, status)
- Bar charts for rankings (enterprises, routes, content)
- Heatmaps and network graphs for advanced analytics
- Time series for trend analysis

## Development Notes

1. **No Build Process**: Direct file editing, no compilation needed
2. **CORS Handling**: Automatic fallback to mock data if Elasticsearch is unreachable
3. **Chart Updates**: All charts are initialized in `initializeCharts()` and updated via `updateAllCharts()`
4. **Tab System**: Managed by `showTab()` function with URL hash navigation
5. **Export Feature**: Uses SheetJS to generate Excel reports with multiple sheets

## Common Tasks

### Add a New Chart
1. Add container div in appropriate tab in index.html
2. Initialize chart in `initializeCharts()` function
3. Create update function following pattern of existing charts
4. Add to `updateAllCharts()` to include in refresh cycle

### Modify Data Aggregations
Edit the Elasticsearch query in `fetchDataAndUpdateCharts()` function - aggregations start at app.js:274

### Change Refresh Interval
Modify the setInterval at app.js:2618 (currently 5 minutes)

### Debug Elasticsearch Connection
Check browser console for CORS errors - the app will automatically use mock data as fallback