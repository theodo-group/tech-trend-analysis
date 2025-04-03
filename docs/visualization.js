// Resize functionality
function setupResizeHandle() {
    const resizeHandle = document.getElementById('resize-handle');
    const filtersPanel = document.getElementById('filters');
    let isResizing = false;
    let startX;
    let startWidth;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.pageX;
        startWidth = parseInt(window.getComputedStyle(filtersPanel).width, 10);
        document.body.style.cursor = 'col-resize';

        // Add overlay to prevent SVG interference with mouse events
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.zIndex = '9999';
        document.body.appendChild(overlay);

        function onMouseMove(e) {
            if (!isResizing) return;
            const width = startWidth + (e.pageX - startX);
            if (width >= 300) { // Minimum width
                filtersPanel.style.width = `${width}px`;
            }
        }

        function onMouseUp() {
            isResizing = false;
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.removeChild(overlay);
            // Trigger visualization update to adjust to new width
            renderVisualization(timePoints, technologiesData);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

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
let minRankChange = 0;
let forcedTechnologies = new Set();
let technologiesData = null;

// Rank change filter handler
function setupRankChangeFilter() {
    const applyButton = document.getElementById('apply-filter');
    applyButton.addEventListener('click', () => {
        const input = document.getElementById('position-change');
        minRankChange = parseInt(input.value) || 0;
        forcedTechnologies.clear(); // Reset forced technologies
        updateCheckboxes();
        updateVisualization();
    });
}

// Update checkbox states based on rank changes
function updateCheckboxes() {
    if (!technologiesData) return;

    const techRankChanges = new Map();
    Array.from(d3.group(technologiesData, d => d.technology).entries()).forEach(([tech, data]) => {
        techRankChanges.set(tech, data[0].rankChange);
    });

    // Sort technologies by visibility and name
    const sortedTechs = Array.from(techRankChanges.entries())
        .sort(([techA, changeA], [techB, changeB]) => {
            const visibleA = changeA >= minRankChange || forcedTechnologies.has(techA);
            const visibleB = changeB >= minRankChange || forcedTechnologies.has(techB);
            if (visibleA !== visibleB) return visibleB - visibleA;
            return techA.localeCompare(techB);
        });

    // Clear and rebuild filter list
    const filterList = d3.select('#filter-list');
    filterList.selectAll('*').remove();

    // Get color mapping for technologies
    const techColors = new Map();
    Array.from(techRankChanges.keys()).forEach((tech, i) => {
        techColors.set(tech, config.lineColors[i % config.lineColors.length]);
    });

    sortedTechs.forEach(([tech, rankChange]) => {
        const meetsRankThreshold = rankChange >= minRankChange;
        const isForced = forcedTechnologies.has(tech);
        const isBlocked = forcedTechnologies.has(`blocked:${tech}`);
        const isVisible = (meetsRankThreshold && !isBlocked) || (isForced && !isBlocked);
        const color = techColors.get(tech);

        const filterItem = filterList
            .append('div')
            .attr('class', 'filter-item');

        const checkbox = filterItem
            .append('input')
            .attr('type', 'checkbox')
            .attr('id', `filter-${tech}`)
            .property('checked', isVisible)
            .on('change', function () {
                if (this.checked) {
                    activeFilters.add(tech);
                    forcedTechnologies.add(tech);
                    forcedTechnologies.delete(`blocked:${tech}`);
                } else {
                    activeFilters.delete(tech);
                    forcedTechnologies.delete(tech);
                    if (meetsRankThreshold) {
                        forcedTechnologies.add(`blocked:${tech}`);
                    }
                }
                updateVisualization();
            });

        filterItem
            .append('label')
            .attr('for', `filter-${tech}`)
            .text(tech)
            .style('color', color);

        // Update active filters
        if (isVisible) {
            activeFilters.add(tech);
        } else {
            activeFilters.delete(tech);
        }
    });
}

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
    try {
        const data = await d3.csv('trends.csv');
        const timePoints = data.columns.slice(1);

        // Process the data
        const processedData = [];
        timePoints.forEach((timePoint, timeIndex) => {
            // Get all positions for this timepoint
            const positionsAtTime = data.map(row => ({
                technology: row[data.columns[0]],
                position: +row[timePoint]
            }));

            // Separate valid and missing positions
            const validPositions = positionsAtTime.filter(item => !isNaN(item.position));
            const missingPositions = positionsAtTime.filter(item => isNaN(item.position));

            // Sort valid positions
            validPositions.sort((a, b) => a.position - b.position);

            // Assign continuous ranks to valid positions
            let rank = 1;
            validPositions.forEach(item => {
                processedData.push({
                    technology: item.technology,
                    timePoint,
                    position: rank,
                    rank: rank,
                    originalPosition: item.position,
                    rankChange: 0 // Will be calculated below
                });
                rank++;
            });

            // Add missing positions at the end
            missingPositions.forEach(item => {
                processedData.push({
                    technology: item.technology,
                    timePoint,
                    position: rank,
                    rank: rank,
                    originalPosition: null,
                    rankChange: 0
                });
                rank++;
            });
        });

        // Calculate rank changes for each technology
        const techData = d3.group(processedData, d => d.technology);
        techData.forEach((points, tech) => {
            const positions = points.map(p => p.position).filter(p => !isNaN(p));
            if (positions.length >= 2) {
                const rankChange = Math.max(...positions) - Math.min(...positions);
                points.forEach(p => p.rankChange = rankChange);
            }
        });

        // Store data for checkbox updates
        technologiesData = processedData;

        // Initialize active filters based on rank changes
        activeFilters = new Set();
        updateCheckboxes();

        // Initial render
        renderVisualization(timePoints, processedData);
    } catch (error) {
        console.error('Error loading data:', error);
    }
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

    // Get color mapping for technologies
    const techColors = new Map();
    Array.from(techLines.keys()).forEach((tech, i) => {
        techColors.set(tech, config.lineColors[i % config.lineColors.length]);
    });

    // Draw lines for each technology
    Array.from(techLines.entries()).forEach(([tech, techData]) => {
        // Check if technology should be visible (either meets rank change threshold or is forced)
        if (activeFilters.has(tech)) {
            // Sort by time point
            techData.sort((a, b) => timePoints.indexOf(a.timePoint) - timePoints.indexOf(b.timePoint));

            // Create line generator
            const line = d3.line()
                .x(d => xScale(d.timePoint))
                .y(d => yScale(d.rank));

            // Draw the line
            const color = techColors.get(tech);

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
                        Original Position: ${d.originalPosition}<br/>
                        Rank Change: ${d.rankChange}
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
    if (!technologiesData) return;
    const timePoints = [...new Set(technologiesData.map(d => d.timePoint))];
    updateCheckboxes();
    renderVisualization(timePoints, technologiesData);
}

// Initialize visualization
loadData();
setupRankChangeFilter();
setupResizeHandle();
