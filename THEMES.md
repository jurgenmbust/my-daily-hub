# Light and dark appearance

The Theme / Tema selector appears beside the language controls on the sign-in
screen and above the app navigation, including on mobile.

- System / Sistema follows the device's light/dark preference and responds when it changes.
- Light / Claro and Dark / Oscuro override the device setting.
- The sign-in preference is stored in the browser. Each signed-in username can
  save a separate preference in the same browser. Choices do not sync across devices.
- Switching still works if browser storage is blocked; the choice then lasts only
  until reload. Logging out returns to the sign-in preference.

Both themes cover cards, navigation, calendar states, task priorities, editor,
settings, login, error messages and native form controls. Tasks and data are unchanged;
no database migration or new dependency is required.

Validation: `npm test` and `npm run build` from frontend/. Manually check both
languages and themes on a phone and PC, including the task editor, calendar,
keyboard focus and saved preference after reload. Browser-native validation dialogs
follow the browser's appearance settings.

After merge, use the manual deployment workflow if its server setup is complete.
Otherwise use the existing backup, git pull, web build and web restart procedure
in LANGUAGES.md. Adding this feature to GitHub does not update the running server.
