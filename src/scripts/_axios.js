import axios from 'axios';

const apiRequest = axios.create({
  baseURL: '/web/'
});

// common
export const apiInfo = (data) => apiRequest.get('information', { params: data });
export const apiMenu = (data) => apiRequest.get('menus', { params: data });
export const apiUserRoles = (data) => apiRequest.get('userroles', { params: data });
export const apiCategories = (data) => apiRequest.get('categories', { params: data });
export const apiArticles = (data) => apiRequest.get(`articles${ data.params?.articleId ? ('/' + data.params.articleId) : '' }`, { params: data });
export const apiLinks = (data) => apiRequest.get('links', { params: data });
export const apiPpagepictures = (data) => apiRequest.get('indexpagepictures', { params: data });
export const apiMenupage = (data) => apiRequest.get('menupage', { params: data });
export const apiPage = (data) => apiRequest.get('page', { params: data });
