// Re-export everything from the new themes directory for backwards compatibility
export {
  type FlavorColors,
  type CustomTheme,
  type CatppuccinFlavor,
  type BuiltinThemeId,
  flavors,
  flavorLabels,
  THEME_GROUPS,
  registerCustomTheme,
  unregisterCustomTheme,
  getCustomThemes,
  getCustomTheme,
  isBuiltinFlavor,
  isDarkTheme,
  isDarkFlavor,
  applyFlavor,
  applyTheme,
} from './themes';
