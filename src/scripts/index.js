import '../assets/css/index.css';

import { createApp } from 'vue';
import './_common.js';
import Tools from '../_components/Tools.vue';
import Home from '../_components/Home.vue';

createApp(Tools).mount('#tools');
createApp(Home).mount('#home');
