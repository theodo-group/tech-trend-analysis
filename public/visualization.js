// Configuration
const config = {
    width: 1200,
    height: 800,
    margin: { top: 50, right: 150, bottom: 50, left: 70 },
    lineColors: d3.schemeCategory10,
    lineWidth: 2,
    pointRadius: 4
};

// State management for filters
let activeFilters = new Set();

// Create SVG
const svg = d3.select('#visualization')
    .append('svg')
    .attr('width', config.width)
    .attr('height', config.height);

// Create tooltip
const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

// Load and process data
async function loadData() {
    const response = await fetch('/api/data');
    const { timePoints, technologies, processedData } = await response.json();

    // Initialize all technologies as active
    activeFilters = new Set(technologies);

    // Setup filters
    setupFilters(technologies);

    // Initial render
    renderVisualization(timePoints, processedData);
}

// Setup filter checkboxes
function setupFilters(technologies) {
    const filterList = d3.select('#filter-list');

    technologies.forEach((tech, i) => {
        const filterItem = filterList
            .append('div')
            .attr('class', 'filter-item');

        filterItem
            .append('input')
            .attr('type', 'checkbox')
            .attr('id', `filter-${tech}`)
            .attr('checked', true)
            .on('change', function () {
                if (this.checked) {
                    activeFilters.add(tech);
                } else {
                    activeFilters.delete(tech);
                }
                updateVisualization();
            });

        filterItem
            .append('label')
            .attr('for', `filter-${tech}`)
            .text(tech)
            .style('color', config.lineColors[i % config.lineColors.length]);
    });
}

// Render the visualization
function renderVisualization(timePoints, data) {
    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales
    const xScale = d3.scalePoint()
        .domain(timePoints)
        .range([config.margin.left, config.width - config.margin.right]);

    const yScale = d3.scaleLinear()
        .domain([1, d3.max(data, d => d.rank) + 1])
        .range([config.margin.top, config.height - config.margin.bottom]);

    // Draw axes
    drawAxes(svg, xScale, yScale, timePoints);

    // Group data by technology
    const techLines = d3.group(data, d => d.technology);

    // Draw lines for each technology
    Array.from(techLines.entries()).forEach(([tech, techData], i) => {
        if (activeFilters.has(tech)) {
            // Sort by time point
            techData.sort((a, b) => timePoints.indexOf(a.timePoint) - timePoints.indexOf(b.timePoint));

            // Create line generator
            const line = d3.line()
                .x(d => xScale(d.timePoint))
                .y(d => yScale(d.rank));

            // Draw the line
            const color = config.lineColors[i % config.lineColors.length];

            svg.append('path')
                .datum(techData)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', config.lineWidth)
                .attr('d', line);

            // Draw points
            svg.selectAll(null)
                .data(techData)
                .enter()
                .append('circle')
                .attr('cx', d => xScale(d.timePoint))
                .attr('cy', d => yScale(d.rank))
                .attr('r', config.pointRadius)
                .attr('fill', color)
                .on('mouseover', function (event, d) {
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', .9);
                    tooltip.html(`
                        Technology: ${d.technology}<br/>
                        Time: ${d.timePoint}<br/>
                        Rank: ${d.rank}<br/>
                        Original Position: ${d.originalPosition}
                    `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function () {
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                });
        }
    });
}

// Draw axes
function drawAxes(svg, xScale, yScale, timePoints) {
    // Create axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    // Add x-axis
    svg.append('g')
        .attr('transform', `translate(0,${config.height - config.margin.bottom})`)
        .call(xAxis)
        .append('text')
        .attr('class', 'axis-label')
        .attr('x', config.width / 2)
        .attr('y', 40)
        .text('Time Period');

    // Add y-axis
    svg.append('g')
        .attr('transform', `translate(${config.margin.left},0)`)
        .call(yAxis)
        .append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -config.height / 2)
        .attr('y', -40)
        .text('Technology Rank');

    // Add grid lines
    svg.append('g')
        .attr('class', 'grid')
        .selectAll('line')
        .data(yScale.ticks())
        .enter()
        .append('line')
        .attr('x1', config.margin.left)
        .attr('x2', config.width - config.margin.right)
        .attr('y1', d => yScale(d))
        .attr('y2', d => yScale(d))
        .attr('stroke', '#ddd')
        .attr('stroke-width', 1);
}

// Update visualization when filters change
function updateVisualization() {
    fetch('/api/data')
        .then(response => response.json())
        .then(({ timePoints, technologies, processedData }) => {
            renderVisualization(timePoints, processedData);
        });
}

// Initialize visualization
loadData();
