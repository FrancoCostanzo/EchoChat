import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from '@/locales/es.json';
import en from '@/locales/en.json';
import pt from '@/locales/pt.json';

const LANG_KEY = 'echochat-lang';

function getSavedLanguage() {
  try {
    return localStorage.getItem(LANG_KEY) || 'es';
  } catch {
    return 'es';
  }
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: getSavedLanguage(),
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
});

export function changeLanguage(lang) {
  i18n.changeLanguage(lang);
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.setAttribute('lang', lang);
}

export function getCurrentLanguage() {
  return i18n.language;
}

// Set initial lang attribute
document.documentElement.setAttribute('lang', getSavedLanguage());

export default i18n;
