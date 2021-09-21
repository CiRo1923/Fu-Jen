import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import About from '../views/About.vue';

const routes = [{
  path: '/:language/',
  name: 'home',
  component: Home
}, {
  path: '/:language/about/:articleId',
  name: 'about',
  component: About
}];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

export default router;
