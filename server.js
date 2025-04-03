const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Process data for visualization
function processData({ timePoints, data }) {
    const processedData = [];

    timePoints.forEach((timePoint, timeIndex) => {
        // Create array of [technology, position] pairs for this time point
        const positionsAtTime = data.map(tech => ({
            technology: tech.technology,
            position: tech.positions[timeIndex]
        }));

        // Separate items with and without positions
        const itemsWithPosition = positionsAtTime.filter(item => !isNaN(item.position));
        const itemsWithoutPosition = positionsAtTime.filter(item => isNaN(item.position));

        // Sort items with positions
        itemsWithPosition.sort((a, b) => a.position - b.position);

        // Assign continuous ranks to items with positions
        let continuousPosition = 1;
        itemsWithPosition.forEach((item) => {
            processedData.push({
                technology: item.technology,
                timePoint,
                position: continuousPosition,
                rank: continuousPosition,
                originalPosition: item.position
            });
            continuousPosition++;
        });

        // Add items without positions at the end
        const lastRank = continuousPosition;
        itemsWithoutPosition.forEach((item, index) => {
            processedData.push({
                technology: item.technology,
                timePoint,
                position: lastRank + index + 1,
                rank: lastRank + index + 1,
                originalPosition: null
            });
        });
    });

    return processedData;
}

// Endpoint to get the data
app.get('/api/data', (req, res) => {
    try {
        const fileContent = fs.readFileSync('trends.csv', 'utf8');
        const lines = fileContent.trim().split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        const timePoints = headers.slice(1);

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            const technology = values[0];
            const positions = values.slice(1).map(Number);

            data.push({
                technology,
                positions
            });
        }

        const processedData = processData({ timePoints, data });
        const technologies = [...new Set(data.map(item => item.technology))];

        res.json({ timePoints, technologies, processedData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
