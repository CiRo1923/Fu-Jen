const CONFIG = require('./config.js');
// const FS = require('fs');

const calc = str => {
  const valArr = str.replace(/\(|\)|px/g, '').split(/\s[+-/*]\s/);
  const opArr = str.replace(/\(|\)|px/g, '').match(/\s[+-/*]\s/g);

  for (let i = 0, len = valArr.length; i < len; i += 1) {
    valArr[i] = +valArr[i];
  }
  for (let i = 0, len = opArr.length; i < len; i += 1) {
    opArr[i] = opArr[i].trim();
  }

  let currentTotal = valArr[0];
  for (let i = 0, len = opArr.length; i < len; i += 1) {
    switch (opArr[i]) {
      case '+':
        currentTotal += valArr[i + 1];
        break;
      case '-':
        currentTotal -= valArr[i + 1];
        break;
      case '*':
        currentTotal *= valArr[i + 1];
        break;
      case '/':
        currentTotal /= valArr[i + 1];
        break;
          // no default
    }
  }
  return currentTotal;
};

const vm = (value, basicWidth, multiple) => {
  let NumValue = parseInt(value, 10);
  const multipleValue = multiple || 1;

  if (/\w(\W)?[+\-*/]/.test(value)) {
    NumValue = calc(value);
  }

  const toPositive = NumValue < 0 ? (NumValue * -1) : NumValue;
  return (toPositive > 1) ? `${(((NumValue / basicWidth) * 100) / multipleValue).toFixed(8)}vw` : value;
};

module.exports = {
  functions: {
    calcfun(value) {
      let NumValue = parseInt(value, 10);

      if (/\w(\W)?[+\-*/]/.test(value)) {
        NumValue = calc(value);
      }

      return `${NumValue.toFixed(8)}px`;
    },
    vmp(value) {
      return vm(value, CONFIG.desktopMinWidth);
    },
    vmt(value) {
      return vm(value, 768);
    },
    vmm(value) {
      return vm(value, CONFIG.basicMobileWidth);
    },
    vmmls(value) {
      return vm(value, CONFIG.basicMobileWidth, 1.77);
    },
    mediaQuery(value, type) {
      let deviceValue = CONFIG.desktopMinWidth;

      if (value === 'tablet') {
        deviceValue = 768;
      } else if (value === 'mobile') {
        deviceValue = CONFIG.mobileMaxWidth;
      }

      let returnValue = `${deviceValue}px`;

      if (type === '+') {
        returnValue = `${(deviceValue + 1)}px`;
      } else if (type === '-') {
        returnValue = `${(deviceValue - 1)}px`;
      }

      return returnValue;
    },
    fz(desktopFz, reqFz, fzKey, multiple) {
      const basicFz = desktopFz.replace(/\(|\)|\s/g, '').split(',');
      const rwdfz = reqFz.replace(/\(|\)|\s/g, '').split(',');
      const index = basicFz.indexOf(fzKey);
      const multipleValue = multiple || 1;

      return `${(rwdfz[index] / multipleValue)}px`;
    },
    getIE() {
      if (CONFIG.ieVersion === 0) {
        return 'screen and (min-width: 0\\0)';
      }

      return '\\0screen\\, screen\\9, all and (min-width: 0\\0) and (min-resolution: 0.001dpcm)';
    },
    getAllIE() {
      return 'screen\\0';
    }
    // color(color, type) {
    //   const VARIABLES = FS.readFileSync('./src/assets/css/_common/variables.css', 'utf8');
    //   const colorArr = /--color:\(([^)]+)/.exec(VARIABLES.replace(/\s/g, ''))[1];
    //   const colorStr = color.replace(/'|"/g, '');
    //   let newColor = new RegExp(`${colorStr}:([^,?]*)`).exec(colorArr)[1];
    //   const rgb = newColor.length === 4
    //     ? /^#?([a-f\d]{1})([a-f\d]{1})([a-f\d]{1})$/i.exec(newColor)
    //     : /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(newColor);

    //   if (type === 'rgb' && rgb) {
    //     newColor = `${parseInt(rgb[1], 16)}, ${parseInt(rgb[2], 16)}, ${parseInt(rgb[3], 16)}`;
    //   }
    //   return newColor;
    // }
  }
};
