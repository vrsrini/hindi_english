d3.csv("data.csv").then(function(data) {
    console.log("✅ Data loaded successfully:", data);

    data.forEach(d => {
        d["1991_Per"] = +d["1991_Per"];
        d["2001_Per"] = +d["2001_Per"];
        d["2011_Per"] = +d["2011_Per"];
    });

    let categories = [...new Set(data.map(d => d.Category))];
    let regions = [...new Set(data.map(d => d.Region))];

    const regionColors = {
        "Non-Hindi South": "#ff6b6b",
        "Non-Hindi,Non-South": "#4ecdc4",
        "Hindi_Belt": "#45b7d1"
    };

    let categoryContainer = d3.select("#category-buttons");
    categories.forEach(category => {
        categoryContainer.append("button")
            .text(category)
            .attr("data-category", category)
            .classed("active", category === "Monolinguals")
            .on("click", function() {
                categoryContainer.selectAll("button").classed("active", false);
                d3.select(this).classed("active", true);
                updateChart(currentRegion, currentState);
            });
    });

    let regionContainer = d3.select("#region-buttons");
    regions.forEach(region => {
        regionContainer.append("button")
            .attr("data-region", region)
            .style("background-color", regionColors[region] || "#555")
            .text(region)
            .on("click", () => updateStateButtons(region));
    });

    let currentRegion = regions[0];
    let currentState = "All";
    const tooltip = d3.select("#tooltip");

    function updateStateButtons(region) {
        currentRegion = region;
        currentState = "All";

        let states = ["All", ...new Set(data.filter(d => d.Region === region).map(d => d.State))];
        
        let stateContainer = d3.select("#state-container").html("");
        
        states.forEach(state => {
            stateContainer.append("button")
                .text(state)
                .attr("data-state", state)
                .classed("active", state === "All")
                .on("click", function() {
                    stateContainer.selectAll("button").classed("active", false);
                    d3.select(this).classed("active", true);
                    currentState = state;
                    updateChart(region, state);
                });
        });
    }

    updateStateButtons(currentRegion);

    d3.select("#reset-button").on("click", () => {
        categoryContainer.selectAll("button").classed("active", d => d === "Monolinguals");
        regionContainer.selectAll("button").classed("active", false)
            .filter(d => d === regions[0]).classed("active", true);
        updateStateButtons(regions[0]);
        currentState = "All";
        d3.select("#chart").html("");
    });

    function updateChart(region, state) {
        let selectedCategory = d3.select("#category-buttons button.active").attr("data-category");
        
        let filteredData = data.filter(d => 
            d.Region === region && 
            (state === "All" || d.State === state) &&
            d.Category === selectedCategory
        );

        if (filteredData.length === 0) {
            console.warn("⚠️ No data available for selected filters!");
            return;
        }

        let yMin, yMax;
        if (selectedCategory === "Monolinguals") {
            yMin = 50;
            yMax = 100;
        } else {
            let values = filteredData.flatMap(d => [d["1991_Per"], d["2001_Per"], d["2011_Per"]]);
            yMin = Math.floor(Math.min(...values) / 5) * 5;
            yMax = Math.ceil(Math.max(...values) / 5) * 5;
        }

        let width = document.getElementById("chart-container").clientWidth - 40;
        let height = 600;
        let margin = {top: 50, right: 80, bottom: 70, left: 80}; 

        let svg = d3.select("#chart").html("")
            .attr("width", width)
            .attr("height", height);

        let xScale = d3.scalePoint()
            .domain(["1991", "2001", "2011"])
            .range([margin.left, width - margin.right]);

        let yScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([height - margin.bottom, margin.top]);

        let lineGenerator = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.percentage));

        let statesList = [...new Set(filteredData.map(d => d.State))];

        statesList.forEach((stateName, index) => {
            let stateData = [
                {year: "1991", percentage: filteredData.find(d => d.State === stateName)["1991_Per"]},
                {year: "2001", percentage: filteredData.find(d => d.State === stateName)["2001_Per"]},
                {year: "2011", percentage: filteredData.find(d => d.State === stateName)["2011_Per"]}
            ];

            let lineColor = regionColors[region] || "#777";

            // Create line
            let path = svg.append("path")
                .datum(stateData)
                .attr("fill", "none")
                .attr("stroke", lineColor)
                .attr("stroke-width", 4)
                .attr("d", lineGenerator)
                .style("cursor", currentState === "All" ? "pointer" : "default");

            // Add dots
            svg.selectAll(`.dot-${index}`)
                .data(stateData)
                .enter()
                .append("circle")
                .attr("cx", d => xScale(d.year))
                .attr("cy", d => yScale(d.percentage))
                .attr("r", 10) // Larger dots for TV visibility
                .attr("fill", lineColor)
                .attr("stroke", "white")
                .attr("stroke-width", 2)
                .on("mouseover", function(event, d) {
                    if (currentState === "All") {
                        tooltip.style("display", "block")
                            .html(`${stateName}<br>${d.year}: ${d.percentage.toFixed(1)}`)
                            .style("left", (event.pageX + 15) + "px")
                            .style("top", (event.pageY - 30) + "px");
                    }
                })
                .on("mouseout", function() {
                    tooltip.style("display", "none");
                });

            // Add labels (only when specific state is selected)
            if (currentState !== "All") {
                svg.selectAll(`.label-${index}`)
                    .data(stateData)
                    .enter().append("text")
                    .attr("x", d => xScale(d.year))
                    .attr("y", d => yScale(d.percentage) - 25)
                    .attr("text-anchor", "middle")
                    .attr("fill", "white")
                    .attr("font-size", "16px")
                    .text(d => d.percentage.toFixed(1));
            }

            // Animation
            let totalLength = path.node().getTotalLength();
            path.attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition()
                .duration(4000)
                .ease(d3.easeLinear)
                .attr("stroke-dashoffset", 0);
        });

        // Add axes
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickSize(8))
            .selectAll("text")
            .style("font-size", "18px");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(yScale).tickSize(8))
            .selectAll("text")
            .style("font-size", "18px");
    }
});