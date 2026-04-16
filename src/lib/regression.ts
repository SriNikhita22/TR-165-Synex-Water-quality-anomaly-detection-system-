/**
 * Performs Simple Linear Regression on an array of sensor data.
 * @param data Array of objects {x: number, y: number}
 * @returns { m: number, b: number } slope and intercept
 */
export const simpleLinearRegression = (data: { x: number; y: number }[]) => {
  const n = data.length;
  if (n === 0) return { m: 0, b: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += data[i].x;
    sumY += data[i].y;
    sumXY += data[i].x * data[i].y;
    sumXX += data[i].x * data[i].x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { m: 0, b: sumY / n };

  const m = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;

  return { m, b };
};

/**
 * Predicts next N points based on SLR.
 * @param lastPoints Array of last 10 points
 * @param nextN Number of points to predict
 * @returns Array of objects {x: number, y: number}
 */
export const predictNextPoints = (lastPoints: { x: number; y: number }[], nextN: number = 5) => {
  if (lastPoints.length < 2) {
    return {
      predictions: [],
      slope: 0,
      intercept: 0,
      projectionAlert: () => "Insufficient data for projection"
    };
  }

  const { m, b } = simpleLinearRegression(lastPoints);
  const lastX = lastPoints[lastPoints.length - 1].x;
  
  // We start from the lastX to ensure the connection is perfect
  const predictions = [];
  for (let i = 0; i <= nextN; i++) {
    const nextX = lastX + i;
    predictions.push({
      x: nextX,
      y: m * nextX + b
    });
  }
  
  return { 
    predictions, 
    slope: m, 
    intercept: b,
    projectionAlert: (targetHours: number) => {
      // Assuming X unit is some interval, e.g. 5 mins. 
      // 2 hours = 120 mins = 24 intervals of 5 mins.
      // But let's just use the slope to calculate a relative projection.
      // The user specifically asked for "Projected to hit [Value] in 2 hours"
      // We will calculate Y after 120 units (assuming X is minutes) 
      // or whatever time scale is appropriate.
      // Let's assume x is index and 1 index = 5 minutes. 
      // So 2 hours = 24 steps later.
      const projectedX = lastX + (targetHours * 12); // if 1 step = 5 mins, 12 steps = 1 hour
      const projectedY = m * projectedX + b;
      return `Projected to hit ${projectedY.toFixed(2)} in ${targetHours} hours`;
    }
  };
};
