/**
 * Reference range interpretation helper
 */
const numberFrom = (value) => {
  const match = String(value ?? '').replace(/,/g, '').match(/[-+]?\d*\.?\d+/);
  return match ? Number(match[0]) : null;
};

const checkOutOfRange = (value, range, alertable = true) => {
  if (alertable === false) return false;
  const observed = numberFrom(value);
  const rangeStr = String(range ?? '');
  if (!Number.isFinite(observed) || !rangeStr) return false;

  // Upper limit only, e.g. <0.50
  const upperLimit = rangeStr.match(/[<≤]\s*(\d*\.?\d+)/);
  if (upperLimit) return observed > Number(upperLimit[1]);

  // Lower limit only, e.g. >40
  const lowerLimit = rangeStr.match(/[>≥]\s*(\d*\.?\d+)/);
  if (lowerLimit) return observed < Number(lowerLimit[1]);

  // Range intervals, e.g. 70-100 or 12.00–15.00
  const intervals = [...rangeStr.matchAll(/(\d*\.?\d+)\s*(?:–|-|to)\s*(\d*\.?\d+)/gi)]
    .map((match) => [Number(match[1]), Number(match[2])])
    .filter(([low, high]) => Number.isFinite(low) && Number.isFinite(high));

  if (intervals.length === 1) {
    return observed < intervals[0][0] || observed > intervals[0][1];
  }

  return intervals.length ? observed > Math.max(...intervals.map(([, high]) => high)) : false;
};

module.exports = {
  numberFrom,
  checkOutOfRange,
};
