const { setData, setOpacity } = require('./tailwind.function.js');
const CONFIG = require('./config.js');
const {
  fontFamily, lineHeight, spacing, negative, colors, borderRadius, fontSize
} = require('./tailwind.setting.js');

const defaultSpacing = {
  ...setData(1, 10),
  ...setData(12, 16, 2),
  ...setData(20, 100, 4)
};

const defaultNegative = {
  ...setData(-10, -1),
  ...setData(-16, -12, 2),
  ...setData(-100, -20, 4)
};

const defaultBorderRadius = {
  ...setData(1, 50)
};

const defaultFontSize = {
  24: '24px', /* use not-support */
  20: '20px', /* use not-support */
  16: '16px', /* use default */
  15: '15px', /* use not-support */
  13: '13px' /* use not-support */
};

const defaultColors = {
  xf: '#fff', /* use default */
  x0: '#000', /* use default */
  x9: '#999', /* use not-support */
  x45: '#454545', /* use not-support */
  x76: '#767676' /* use not-support */
};

const defaultOpacity = {
  ...setOpacity(0, 95, 5)
};

module.exports = {
  future: {
    removeDeprecatedGapUtilities: true,
    purgeLayersByDefault: true
  },
  purge: {
    enabled: process.env.NODE_ENV === 'production',
    content: [
      './src/**/*.html',
      './src/**/*.vue',
      './src/**/*.ejs',
      './src/**/*.js',
      './src/**/*.css'
    ],
    options: {
      extractors: [
        {
          extractor: content => content.match(/[$%\w.:\-/(,)]+(?<!\()/g) || [],
          extensions: ['ejs']
        }
      ]
    }
  },
  theme: {
    fontFamily: {
      body: fontFamily || 'arial, "微軟正黑體", "Microsoft JhengHei", "Heiti TC", "黑體", sans-serif, serif'
    },
    screens: {
      notsupport: [{
        raw: CONFIG.ieVersion === 0
          ? 'screen and (min-width: 0\\0)'
          : '\\0screen\\, screen\\9, all and (min-width: 0\\0) and (min-resolution: 0.001dpcm)'
      }],
      mLandscape: [{
        raw: `(max-width: ${CONFIG.mobileMaxWidth - 1}px) and (orientation: landscape) and (min-width: 480px)
        , (max-width: 999px) and (max-height: 428px) and (orientation: landscape) and (orientation: landscape) and (min-width: 480px)`
      }],
      m: [{
        raw: `(max-width: 1000px) and (max-height: 428px) and (orientation: landscape), (max-width: ${CONFIG.mobileMaxWidth - 1}px)`
      }],
      t: [{
        raw: `(min-width: ${CONFIG.mobileMaxWidth}px) and (max-width: 1001px) and (min-height: 428px)`
      }],
      tm: [{
        max: '1001px'
      }],
      pt: [{
        raw: `(min-width: ${CONFIG.mobileMaxWidth}px) and (min-height: 428px)`
      }],
      pMin: [{
        min: '1001px',
        max: `${CONFIG.desktopMinWidth}px`
      }],
      p: [{
        min: '1001px'
      }],
      pMax: [{
        min: `${CONFIG.desktopMinWidth + 1}px`
      }]
    },
    extend: {
      inset: {
        ...{
          '1/2': '50%',
          full: '100%'
        }
      },
      margin: {
        ...defaultSpacing,
        ...spacing,
        ...defaultNegative,
        ...negative
      },
      padding: {
        ...defaultSpacing,
        ...spacing
      },
      spacing: {
        ...defaultSpacing
      },
      width: {
        ...{
          cnt: `${CONFIG.contentWidth}px`
        }
      },
      height: {
        ...{
          '1/2': '50%'
        }
      },
      fontSize: {
        ...{
          vmp: `${((16 / CONFIG.desktopMinWidth) * 100)}vw`,
          vmt: `${((16 / 768) * 100)}vw`,
          vmm: `${((16 / CONFIG.basicMobileWidth) * 100)}vw`,
          vmmls: `${(((16 / CONFIG.basicMobileWidth) * 100) / 1.77)}vw`
        },
        ...defaultFontSize,
        ...fontSize
      },
      lineHeight: {
        default: lineHeight || 1.5
      },
      borderWidth: {
        ...defaultSpacing,
        ...spacing
      },
      borderRadius: {
        ...defaultBorderRadius,
        ...borderRadius
      },
      colors: {
        ...defaultColors,
        ...colors
      },
      opacity: {
        ...defaultOpacity
      }
    },
    fill: theme => ({
      ...theme('defaultColors'),
      ...theme('colors')
    }),
    backgroundColor: theme => ({
      ...theme('defaultColors'),
      ...theme('colors')
    })
  },
  variants: {},
  plugins: []
};
