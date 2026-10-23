import type { ChatIcon } from './store';

export const TEMPLATES: Record<'ideas' | 'shopping' | 'movies' | 'work', { title: string; icon: ChatIcon; color: string }> = {
  ideas: { title: 'Идеи', icon: 'bulb', color: '#F2A33A' },
  shopping: { title: 'Покупки', icon: 'cart', color: '#4FAE4E' },
  movies: { title: 'Фильмы', icon: 'movie', color: '#E2574C' },
  work: { title: 'Работа', icon: 'briefcase', color: '#3390EC' },
};
