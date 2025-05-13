const colors = d3.schemeTableau10;
const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

// 更新高亮函数，支持散点图和直方图双向淡出
function highlightHistogramsFromScatter(selectedPoints) {
  const dimensionKeys = [
    { id: 'time-histogram', key: 'mealHour', precision: 1 },
    { id: 'carb-histogram', key: 'total_carb', precision: 10 },
    { id: 'prot-histogram', key: 'protein_g', precision: 5 },
    { id: 'fat-histogram', key: 'fat_g', precision: 5 },
    { id: 'sugar-histogram', key: 'sugar_g', precision: 5 },
    { id: 'fiber-histogram', key: 'fiber_g', precision: 2 },
    { id: 'calorie-histogram', key: 'calorie', precision: 100 }
  ];

  dimensionKeys.forEach(dim => {
    const binsToKeep = new Set(
      selectedPoints.map(d => Math.floor(d[dim.key] / dim.precision) * dim.precision)
    );
    d3.selectAll(`#${dim.id} rect.hist`)
      .classed("dimmed", d => !binsToKeep.has(d.key));
  });
  
  // 淡出未选中的散点
  d3.selectAll("#scatter-plot circle")
    .classed("dimmed", d => !selectedPoints.some(sp => 
      sp.time_begin === d.time_begin && sp.person === d.person
    ));
}

function clearHistogramHighlighting() {
  d3.selectAll("rect.hist").classed("dimmed", false);
  d3.selectAll("#scatter-plot circle").classed("dimmed", false);
}

const style = document.createElement('style');
style.innerHTML = `
  rect.hist.dimmed, circle.dimmed {
    fill-opacity: 0.2;
    stroke-opacity: 0.2;
  }
  .tooltip rect {
    fill: rgba(30, 30, 30, 0.95);
    rx: 5;
    ry: 5;
  }
  .tooltip text {
    font-size: 11px;
    fill: white;
    pointer-events: none;
  }
  .tooltip tspan {
    font-size: 11px;
  }
`;
document.head.appendChild(style);

let filters = {
  time: null,
  person: null,
  carb: null,
  prot: null,
  fat: null,
  sugar: null,
  fiber: null,
  calorie: null
};

const chartInstances = {
  timeHist: null,
  countDisplay: null,
  nutrientHists: []
};

let allData = [];

d3.csv("added_food.csv", row => {
  const parsedRow = {
    time_begin: parseTime(row.time_begin || ""),
    total_carb: +row.total_carb || 0,
    protein_g: +row.protein || 0,
    fat_g: +row.total_fat || 0,
    sugar_g: +row.sugar || 0,
    fiber_g: +row.dietary_fiber || 0,
    calorie: +row.calorie || 0,
    grow_in_glu: +row.grow_in_glu || 0,
    person: row.person || "Unknown",
    logged_food: row.logged_food || "Unknown"
  };
  if (!parsedRow.time_begin) {
    console.warn("Invalid time_begin in row:", row);
    return null;
  }
  return parsedRow;
}).then(data => {
  allData = data.filter(d => d !== null);
  if (allData.length === 0) {
    console.error("No valid data loaded.");
    return;
  }

  allData.forEach(d => {
    d.mealHour = d.time_begin.getHours() + d.time_begin.getMinutes() / 60;
    d.sugar = +d.sugar_g || 0;
    d.total_carb = +d.total_carb || 0;
    d.grow_in_glu = +d.grow_in_glu || 0;
    d.total_fat = +d.fat_g || 0;
  });

  const cw = document.getElementById('charts')?.clientWidth || 1200;
  const barW = (cw - 32) / 3, barH = 250; // 直方图高度调整为250
  const margin = { top: 20, right: 20, bottom: 40, left: 40 };
  

  function filterData() {
    return allData.filter(d => {
      const timeMatch = !filters.time || (d.mealHour >= filters.time[0] && d.mealHour <= filters.time[1]);
      return (
        timeMatch &&
        (!filters.person || d.person === filters.person) &&
        (!filters.carb || (d.total_carb >= filters.carb[0] && d.total_carb <= filters.carb[1])) &&
        (!filters.prot || (d.protein_g >= filters.prot[0] && d.protein_g <= filters.prot[1])) &&
        (!filters.fat || (d.fat_g >= filters.fat[0] && d.fat_g <= filters.fat[1])) &&
        (!filters.sugar || (d.sugar_g >= filters.sugar[0] && d.sugar_g <= filters.sugar[1])) &&
        (!filters.fiber || (d.fiber_g >= filters.fiber[0] && d.fiber_g <= filters.fiber[1])) &&
        (!filters.calorie || (d.calorie >= filters.calorie[0] && d.calorie <= filters.calorie[1]))
      );
    });
  }

  function updateCharts() {
    chartInstances.timeHist?.update();
    chartInstances.countDisplay?.update();
    chartInstances.nutrientHists.forEach(h => h.update());
  }

  function updateScatterChart() {
    const container = d3.select("#scatter-plot .dc-chart");
    if (!container.node()) return;
  
    let svg = container.select("svg");
    if (svg.empty()) {
      svg = container.append("svg").attr("width", 600).attr("height", 400);
    }
  
    const marginScatter = { top: 40, right: 30, bottom: 60, left: 60 };
    const width = +svg.attr("width") - marginScatter.left - marginScatter.right;
    const height = +svg.attr("height") - marginScatter.top - marginScatter.bottom;
  
    let g = svg.select("g.scatter-group");
    if (g.empty()) {
      g = svg.append("g")
        .attr("class", "scatter-group")
        .attr("transform", `translate(${marginScatter.left},${marginScatter.top})`);
      
      // 创建工具提示元素
      const tooltip = g.append("g")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("pointer-events", "none");
      
      tooltip.append("rect")
        .attr("rx", 5)
        .attr("ry", 5)
        .style("fill", "rgba(30,30,30,0.95)");
      
      tooltip.append("text")
        .style("font-size", "11px")
        .style("fill", "white")
        .attr("dy", "1.2em")
        .attr("dx", "0.5em");
    }

    const tooltip = g.select(".tooltip");
    const tooltipBg = tooltip.select("rect");
    const tooltipText = tooltip.select("text");
  
    let xAxisGroup = g.select(".x-axis");
    if (xAxisGroup.empty()) {
      xAxisGroup = g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
    }
  
    let yAxisGroup = g.select(".y-axis");
    if (yAxisGroup.empty()) {
      yAxisGroup = g.append("g").attr("class", "y-axis");
    }

    const selectedPerson = d3.select("#subjectSelect").property("value") || null;
    const selectedNutrient = d3.select("#nutrientSelect").property("value") || "sugar";

    const filtered = filterData().filter(d => (!selectedPerson || d.person === selectedPerson) && !isNaN(d[selectedNutrient]) && !isNaN(d.grow_in_glu));

    filtered.sort((a, b) => d3.descending(a.total_fat, b.total_fat));

    const x = d3.scaleLinear()
      .domain(d3.extent(filtered, d => d[selectedNutrient])).nice()
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain(d3.extent(filtered, d => d.grow_in_glu)).nice()
      .range([height, 0]);

    const r = d3.scaleSqrt()
      .domain(d3.extent(filtered, d => d.total_fat))
      .range([2, 10]);

    xAxisGroup.transition().call(d3.axisBottom(x));
    yAxisGroup.transition().call(d3.axisLeft(y));

    g.select(".x-axis-label").remove();
    g.append("text")
      .attr("class", "x-axis-label")
      .attr("text-anchor", "middle")
      .attr("x", width / 2)
      .attr("y", height + marginScatter.bottom - 10)
      .text(selectedNutrient === "sugar" ? "Sugar (g)" : "Total Carbohydrate (g)");

    g.select(".y-axis-label").remove();
    g.append("text")
      .attr("class", "y-axis-label")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -marginScatter.left + 20)
      .text("Glucose Increase (mg/dL)");

    const circles = g.selectAll("circle").data(filtered, d => d.time_begin + (d.group_id || ""));
    circles.exit().transition().attr("r", 0).remove();
    circles.transition()
      .attr("cx", d => x(d[selectedNutrient]))
      .attr("cy", d => y(d.grow_in_glu))
      .attr("r", d => r(d.total_fat));

    const allCircles = circles.enter().append("circle")
      .attr("cx", d => x(d[selectedNutrient]))
      .attr("cy", d => y(d.grow_in_glu))
      .attr("r", d => r(d.total_fat))
      .attr("fill", "steelblue")
      .on("mouseover", function(event, d) {
        const textLines = [
          `Calories: ${d.calorie}`,
          `Total Carb: ${d.total_carb}g`,
          `Fiber: ${d.fiber_g}g`,
          `Sugar: ${d.sugar_g}g`,
          `Protein: ${d.protein_g}g`,
          `Fat: ${d.total_fat}g`,
          `Glucose Δ: ${d.grow_in_glu.toFixed(1)}mg/dL`
        ];
        
        // 更新工具提示内容
        tooltipText.selectAll("tspan").remove();
        textLines.forEach((line, i) => {
          tooltipText.append("tspan")
            .attr("x", 5)
            .attr("dy", i ? "1.2em" : "0.3em")
            .text(line);
        });
        
        // 计算文本尺寸并调整背景
        const bbox = tooltipText.node().getBBox();
        const padding = { top: 5, right: 8, bottom: 5, left: 8 };
        tooltipBg
          .attr("width", bbox.width + padding.left + padding.right)
          .attr("height", bbox.height + padding.top + padding.bottom)
          .attr("x", bbox.x - padding.left)
          .attr("y", bbox.y - padding.top);
        
        // 定位工具提示组（数据点右上方）
        let tooltipX = x(d[selectedNutrient]) + 15;
        let tooltipY = y(d.grow_in_glu) - bbox.height - padding.top - padding.bottom - 5;
        
        // 边界检查：确保工具提示在图表区域内
        if (tooltipX + bbox.width + padding.left + padding.right > width) {
          tooltipX = x(d[selectedNutrient]) - bbox.width - padding.left - padding.right - 15;
        }
        if (tooltipY < 0) {
          tooltipY = y(d.grow_in_glu) + 15;
        }
        
        tooltip
          .attr("transform", `translate(${tooltipX},${tooltipY})`)
          .style("opacity", 1);

        // 确保工具提示在最上层
        tooltip.raise();
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
      })
      .merge(circles);

    let brush = g.select(".brush");
    if (brush.empty()) {
      brush = g.append("g")
        .attr("class", "brush")
        .lower();
    }

    const brushBehavior = d3.brush()
      .extent([[0, 0], [width, height]])
      .on("start brush end", brushed);

    brush.call(brushBehavior);

    let wasBrushed = false;

    function brushed(event) {
      const selection = event.selection;
      if (event.type === "start") {
        allCircles.classed("selected", false);
        wasBrushed = false;
      }
      if (selection) {
        wasBrushed = true;
        const [[x0, y0], [x1, y1]] = selection;
        allCircles.classed("selected", d => {
          const cx = x(d[selectedNutrient]);
          const cy = y(d.grow_in_glu);
          return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        });

        const selectedData = filtered.filter(d => {
          const cx = x(d[selectedNutrient]);
          const cy = y(d.grow_in_glu);
          return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        });

        highlightHistogramsFromScatter(selectedData);
      } else {
        allCircles.classed("selected", false);
        wasBrushed = false;
        clearHistogramHighlighting();
      }
    }

    svg.on("click", (event) => {
      if (event.target.tagName === "circle" || event.target.classList.contains("selection")) {
        return;
      }
      if (wasBrushed) {
        brush.call(brushBehavior.move, null);
        allCircles.classed("selected", false);
        wasBrushed = false;
        clearHistogramHighlighting();
      }
    });
  }

  function createTimeHistogram() {
    const container = d3.select('#time-histogram .dc-chart');
    const svg = container.append('svg').attr('width', barW).attr('height', barH);
    const x = d3.scaleLinear().domain([0, 24]).range([margin.left, barW - margin.right]);
    const y = d3.scaleLinear().range([barH - margin.bottom, margin.top]);

    function update() {
      const data = filterData();
      const grouped = d3.rollup(data, v => v.length, d => Math.floor(d.mealHour));
      const bins = Array.from(grouped, ([k, v]) => ({ key: k, value: v })).sort((a, b) => a.key - b.key);
      y.domain([0, d3.max(bins, d => d.value) || 1]);

      svg.selectAll("rect.hist").remove();
      svg.selectAll("rect.hist")
        .data(bins)
        .enter()
        .append("rect")
        .attr("class", "hist")
        .attr("x", d => x(d.key))
        .attr("y", d => y(d.value))
        .attr("width", Math.max(1, x(1) - x(0) - 1))
        .attr("height", d => Math.max(0, barH - margin.bottom - y(d.value)))
        .attr("fill", colors[0]);

      svg.select(".y-axis").call(d3.axisLeft(y).ticks(5));
    }

    svg.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${barH - margin.bottom})`).call(d3.axisBottom(x).ticks(24));
    svg.append("g").attr("class", "y-axis").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(y).ticks(5));

    svg.append("g").attr("class", "brush")
      .call(d3.brushX().extent([[margin.left, margin.top], [barW - margin.right, barH - margin.bottom]])
        .on("end", (event) => {
          if (event.selection) {
            filters.time = [x.invert(event.selection[0]), x.invert(event.selection[1])];
          } else {
            filters.time = null;
          }
          updateCharts();
          updateScatterChart();
        }));

    return { update };
  }

  function createPersonSelect() {
    const container = d3.select('#subject-select .dc-chart');
    const persons = [...new Set(allData.map(d => d.person))].sort();
    const select = container.append('select').attr('id', 'subjectSelect')
      .on('change', () => {
        filters.person = d3.select('#subjectSelect').property('value') || null;
        updateCharts();
        updateScatterChart();
      });

    select.append('option').attr('value', '').text('All');
    select.selectAll('option.person')
      .data(persons)
      .enter()
      .append('option')
      .attr("value", d => d)
      .text(d => d);
  }

  function createCountDisplay() {
    const container = d3.select('#total-count .dc-chart');
    const span = container.append('span');
    return {
      update: () => span.text(filterData().length)
    };
  }

  function createNutrientHistogram({ id, key, precision, filterKey, label }, index) {
    const container = d3.select(`#${id} .dc-chart`);
    const svg = container.append("svg").attr("width", barW).attr("height", barH);
    const x = d3.scaleLinear().range([margin.left, barW - margin.right]);
    const y = d3.scaleLinear().range([barH - margin.bottom, margin.top]);

    function update() {
      const data = filterData();
      const grouped = d3.rollup(data, v => v.length, d => Math.floor(d[key] / precision) * precision);
      const bins = Array.from(grouped, ([k, v]) => ({ key: k, value: v })).sort((a, b) => a.key - b.key);

      x.domain([0, d3.max(allData, d => d[key]) || precision]);
      y.domain([0, d3.max(bins, d => d.value) || 1]);

      svg.selectAll("rect.hist").remove();
      svg.selectAll("rect.hist")
        .data(bins)
        .enter()
        .append("rect")
        .attr("class", "hist")
        .attr("x", d => x(d.key))
        .attr("y", d => y(d.value))
        .attr("width", Math.max(1, x(precision) - x(0) - 1))
        .attr("height", d => Math.max(0, barH - margin.bottom - y(d.value)))
        .attr("fill", colors[index]);

      svg.select(".x-axis").call(d3.axisBottom(x).ticks(5));
      svg.select(".y-axis").call(d3.axisLeft(y).ticks(5));
    }

    x.domain([0, d3.max(allData, d => d[key]) || precision]);
    svg.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${barH - margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").attr("class", "y-axis").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(y).ticks(5));

    svg.append("g").attr("class", "brush")
      .call(d3.brushX().extent([[margin.left, margin.top], [barW - margin.right, barH - margin.bottom]])
        .on("end", (event) => {
          if (event.selection) {
            filters[filterKey] = [x.invert(event.selection[0]), x.invert(event.selection[1])];
          } else {
            filters[filterKey] = null;
          }
          updateCharts();
          updateScatterChart();
        }));

    return { update };
  }

  chartInstances.timeHist = createTimeHistogram();
  createPersonSelect();
  chartInstances.countDisplay = createCountDisplay();
  chartInstances.nutrientHists = [
    { id: 'carb-histogram', key: 'total_carb', precision: 10, filterKey: 'carb', label: 'Carbs (g)' },
    { id: 'prot-histogram', key: 'protein_g', precision: 5, filterKey: 'prot', label: 'Protein (g)' },
    { id: 'fat-histogram', key: 'fat_g', precision: 5, filterKey: 'fat', label: 'Fat (g)' },
    { id: 'sugar-histogram', key: 'sugar_g', precision: 5, filterKey: 'sugar', label: 'Sugar (g)' },
    { id: 'fiber-histogram', key: 'fiber_g', precision: 2, filterKey: 'fiber', label: 'Fiber (g)' },
    { id: 'calorie-histogram', key: 'calorie', precision: 100, filterKey: 'calorie', label: 'Calories' }
  ].map((cfg, i) => createNutrientHistogram(cfg, i));

  updateCharts();
  updateScatterChart();

  d3.select('#reset-filters').on('click', () => {
    Object.keys(filters).forEach(k => filters[k] = null);
    d3.select('#subjectSelect').property('value', '');
    d3.selectAll('.brush').each(function () {
      d3.select(this).call(d3.brushX().move, null);
    });
    updateCharts();
    updateScatterChart();
    clearHistogramHighlighting();
  });

  d3.select("#nutrientSelect").on("change", updateScatterChart);
}).catch(error => {
  console.error('Error loading data:', error);
});