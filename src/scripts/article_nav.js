import '../assets/css/article.css';

import { apiMenupage } from '../scripts/_axios.js';
import { createApp } from 'vue';
import './_common.js';
import { language, params } from '../scripts/_factory.js';
import Tools from '../_components/ToolsNav.vue';
import Article from '../_components/ArticleNav.vue';

// 取得選單頁內容以及選單成功
apiMenupage({
  Language: language(),
  MenuPageRouteName: params('menuPage'),
  MenuPageItemRouteName: params('menuPageId')
}).then(res => {
  const { status, data } = res;

  if (status === 200) {
    console.log(data);

    createApp(Tools).provide('data', data).mount('#tools');
    createApp(Article).provide('data', data).mount('#article');
  }
});
