const CONFIG = require('./config.js');
const FUNCTION = require('./postcss.function.js');
const postcssEachVar = !CONFIG.tailwindcss ? require('postcss-each-variables') : () => {};
const postcssEach = !CONFIG.tailwindcss ? require('postcss-each') : () => {};
const postcssFor = !CONFIG.tailwindcss ? require('postcss-for') : () => {};
const postcssMixins = !CONFIG.tailwindcss ? require('postcss-mixins') : () => {};
const postcssMapGet = !CONFIG.tailwindcss ? require('postcss-map-get') : () => {};
const postcssConditionals = !CONFIG.tailwindcss ? require('postcss-conditionals') : () => {};
const postcssApply = !CONFIG.tailwindcss ? require('postcss-apply-class') : () => {};
const tailwindcss = !CONFIG.tailwindcss ? () => {} : require('tailwindcss');
const purgecss = (process.env.NODE_ENV === 'production' && !CONFIG.tailwindcss) ? require('@fullhuman/postcss-purgecss') : () => {};
const cssnano = process.env.NODE_ENV === 'production' ? require('cssnano') : () => {};
const sort = (process.env.NODE_ENV === 'production' && !CONFIG.tailwindcss) ? require('postcss-sort-media-queries') : () => {};
const autoprefixer = process.env.NODE_ENV === 'production' ? require('autoprefixer') : () => {};

module.exports = {
  plugins: [
    require('postcss-import'),
    postcssEachVar,
    postcssEach,
    postcssFor,
    postcssMixins,
    require('postcss-css-variables'),
    postcssMapGet,
    require('postcss-hexrgba'),
    require('postcss-calc'),
    require('postcss-functions')({
      functions: FUNCTION.functions
    }),
    postcssConditionals,
    require('postcss-nested'),
    postcssApply,
    tailwindcss,
    purgecss({
      content: [
        'src/**/*.vue',
        'src/**/*.ejs',
        'src/**/*.js'
      ],
      fontFace: true,
      keyframes: true,
      variables: true,
      defaultExtractor: content => content.match(/[$%\w.:\-/(,)]+(?<!\()/g) || [],
      skippedContentGlobs: ['node_modules/**'],
      safelist: {
        deep: [/:not/, /:nth-child/, /:first-child/, /:last-child/, /:checked/, /:disabled/, /:read-only/]
      }
    }),
    cssnano({
      preset: ['default', {
        discardComments: {
          removeAll: true
        }
      }]
    }),
    require('postcss-assets')({
      loadPaths: [`src/${CONFIG.imgs}`, `src/${CONFIG.svgs}`]
    }),
    sort({
      sort: (a, b) => {
        return b.localeCompare(a);
      }
    }),
    require('postcss-pxtorem')({
      propList: ['*', '!box-shadow', '!text-shadow'],
      minPixelValue: 2
    }),
    autoprefixer({
      grid: true,
      overrideBrowserslist: [
        '> 1%',
        'last 5 versions',
        'Firefox >= 45',
        'ios >= 8',
        'ie >= 10'
      ]
    })
  ]
};
