module.exports = {
  HtmlWebpackPlugin: [{
    filename: 'Page/FactsAtAGlanceZhTW/index.html',
    template: '_shared/layout.ejs',
    includeName: 'Article/index.ejs',
    title: '',
    description: '',
    chunks: ['page']
  }]
};
