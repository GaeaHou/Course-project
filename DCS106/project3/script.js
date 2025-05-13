/* 使用D3.js加载数据并绘制交互式散点图 */

// 异步加载数据并绘制图表
async function loadAndVisualizeData() {
  try {
    // 加载JSON数据
    const data = await d3.json("data.json");

    // 设置图表尺寸
    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // 创建SVG容器
    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 设置X轴（碳水化合物）
    const x = d3.scaleLinear()
      .domain([d3.min(data, d => d.carbs) - 5, d3.max(data, d => d.carbs) + 5])
      .range([0, width]);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .append("text")
      .attr("x", width / 2)
      .attr("y", 40)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .text("Carbohydrates (g)");

    // 设置Y轴（血糖）
    const y = d3.scaleLinear()
      .domain([d3.min(data, d => d.glucose) - 5, d3.max(data, d => d.glucose) + 5])
      .range([height, 0]);

    svg.append("g")
      .call(d3.axisLeft(y))
      .append("text")
      .attr("x", -height / 2)
      .attr("y", -40)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .text("Blood Glucose (mg/dL)");

    // 创建散点
    svg.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.carbs))
      .attr("cy", d => y(d.glucose))
      .attr("r", 5)
      .attr("fill", "steelblue")
      .on("mouseover", function(event, d) {
        // 鼠标悬停：放大圆点并更改颜色
        d3.select(this).attr("r", 8).attr("fill", "orange");
        // 显示提示框
        svg.append("text")
          .attr("id", "tooltip")
          .attr("x", x(d.carbs) + 10)
          .attr("y", y(d.glucose) - 10)
          .attr("fill", "#000")
          .text(`Subject: ${d.subject}, Glucose: ${d.glucose}, Carbs: ${d.carbs}`);
      })
      .on("mouseout", function() {
        // 鼠标移开：恢复圆点样式并移除提示框
        d3.select(this).attr("r", 5).attr("fill", "steelblue");
        d3.select("#tooltip").remove();
      });

  } catch (error) {
    console.error("Error loading or visualizing data:", error);
  }
}

// 执行图表绘制
loadAndVisualizeData();