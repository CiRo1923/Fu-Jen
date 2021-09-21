const setData = (start = 1, end = 1, Interval = 1) => {
  let result = {};
  for (let i = start; i <= end; i += Interval) {
    result[i] = `${i}px`;
  }
  return result;
};

const setOpacity = (start = 1, end = 1, Interval = 1) => {
  let result = {};
  for (let i = start; i <= end; i += Interval) {
    result[i] = (i / 100);
  }

  return result;
};

module.exports = {
  setData,
  setOpacity
};
