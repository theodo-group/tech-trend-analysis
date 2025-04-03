# Technology Evolution Trends Visualization

An interactive visualization of technology trends over time, showing how different technologies' rankings have changed.

## Features

- Interactive line chart showing technology rank changes over time
- Filter technologies by minimum rank change
- Toggle individual technologies
- Resizable filter panel
- Tooltips with detailed information
- Color-coded technology lines

## Usage

The visualization is available at: https://[your-github-username].github.io/it-jobs-watch/

### Local Development

To run locally:

1. Clone the repository
2. Open `docs/index.html` in your browser
3. No server required - all data processing happens client-side

### Data Format

The visualization expects a CSV file (`trends.csv`) with the following format:
- First column: Technology names
- Subsequent columns: Time periods with position values
- Missing values are allowed and will be handled appropriately

## Deployment

This project is configured for GitHub Pages:

1. Push changes to the main branch
2. GitHub Pages will automatically deploy from the `/docs` directory
3. The site will be available at your GitHub Pages URL

## License

MIT License
