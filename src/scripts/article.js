import '../assets/css/article.css';

import { apiCategories } from '../scripts/_axios.js';
import { createApp } from 'vue';
import './_common.js';
import { getFunctionCadeData } from '../scripts/_factory.js';
import Tools from '../_components/Tools.vue';
import Article from '../_components/Article.vue';

apiCategories({
  FunctionCode: getFunctionCadeData().id
}).then(res => {
  const { status, data } = res;

  if (status === 200) {
    console.log(data);

    createApp(Tools).provide('data', data).mount('#tools');
    createApp(Article).provide('data', data).mount('#article');
  }
});
