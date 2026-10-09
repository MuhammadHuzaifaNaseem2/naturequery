'use strict'

// Keep initialization scoped so the workspace script can use its own bindings.
;(() => {
  const themeKey = 'naturequery.desktop.theme'
  let savedTheme = 'dim'
  try {
    const preference = localStorage.getItem(themeKey)
    if (preference === 'light') savedTheme = 'light'
  } catch {
    // Local storage can be unavailable in a restricted profile; dim stays usable.
  }
  document.documentElement.dataset.theme = savedTheme
})()
