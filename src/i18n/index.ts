import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEn from '../locales/en/common.json';
import settingsEn from '../locales/en/settings.json';
import editorEn from '../locales/en/editor.json';
import searchEn from '../locales/en/search.json';
import sidebarEn from '../locales/en/sidebar.json';
import exportEn from '../locales/en/export.json';
import importEn from '../locales/en/import.json';
import commandsEn from '../locales/en/commands.json';
import graphEn from '../locales/en/graph.json';
import pluginsEn from '../locales/en/plugins.json';
import dialogsEn from '../locales/en/dialogs.json';
import errorsEn from '../locales/en/errors.json';
import statusbarEn from '../locales/en/statusbar.json';

const resources = {
  en: {
    common: commonEn,
    settings: settingsEn,
    editor: editorEn,
    search: searchEn,
    sidebar: sidebarEn,
    export: exportEn,
    import: importEn,
    commands: commandsEn,
    graph: graphEn,
    plugins: pluginsEn,
    dialogs: dialogsEn,
    errors: errorsEn,
    statusbar: statusbarEn,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: [
    'common', 'settings', 'editor', 'search', 'sidebar',
    'export', 'import', 'commands', 'graph', 'plugins',
    'dialogs', 'errors', 'statusbar',
  ],
  interpolation: {
    escapeValue: false,
  },
});

// Update html lang attribute when language changes
i18n.on('languageChanged', (lng) => {
  document.documentElement.setAttribute('lang', lng);
});

export default i18n;
