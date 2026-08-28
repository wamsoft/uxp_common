# uxp_common

Shared webview-side pieces for the Photoshop UXP panels
[uxp_psdrename](https://github.com/wamsoft/uxp_psdrename),
[uxp_psdtext](https://github.com/wamsoft/uxp_psdtext) and
[uxp_psdexport](https://github.com/wamsoft/uxp_psdexport).

All three put their UI in a webview and keep the UXP panel script as a thin
bridge to Photoshop, so they kept growing the same helpers three times over —
and a fix in one silently left the others broken. This repository is where
those helpers live now. It is used as a submodule at
`plugin/webview/common/`, inside the webview root because a webview may not
be able to reach above it.

| Module | What it does |
|---|---|
| `modal.js` | Opening and closing modal dialogs: backdrop clicks, Escape, and a guard for unsaved edits |
| `paste.js` | Pasting through the panel, because a webview never gets keyboard focus on Windows |
| `i18n.js` | A tiny i18n engine; each panel supplies its own dictionary |

Plain ES modules with no build step and no dependencies.

## modal.js

`click` fires on the nearest common ancestor of `mousedown` and `mouseup`, so
a selection drag that starts inside a dialog and ends on the backdrop reads as
a backdrop click. Closing on that alone throws away whatever was being edited.
`wireModalClose` closes only when the press and the release are both on the
backdrop, and routes Escape through the same door.

```js
import { wireModalClose, escapeModal } from './common/modal.js';

wireModalClose('#editDialog', closeEditDialog, isDirty,
               () => setStatus('#editStatus', tr('modal.dirty'), 'error'));

// Escape: pass the dialogs front-most first
escapeModal(['#helpDialog', '#sheetDialog', '#editDialog']);
```

Pass `isDirty` only for dialogs that lose work when they close. The `×`
button always closes, since pressing it is deliberate.

## paste.js

On Windows a UXP panel's webview does not receive keyboard focus, so `Ctrl+V`
never arrives — a known Adobe issue with no workaround. The panel side reads
the clipboard instead and hands the text over. Clicking a field still moves
DOM focus even when OS focus is elsewhere, so "the field you clicked last" is
enough to know where the text should land.

```js
import { attachPaste } from './common/paste.js';

attachPaste('#renameDialog', {
	button: '#rnPaste', fallback: '#rnFind',
	request, tr, setStatus: setRenameStatus,
});
```

The panel must hold the `clipboard` permission and answer a `readClipboard`
message with `{ text }`.

## i18n.js

```js
import { createI18n } from './common/i18n.js';

const DICT = { ja: { 'app.lang': 'EN' }, en: { 'app.lang': 'JA' } };
export const { tr, applyI18n, currentLang, toggleLang, setLang } =
	createI18n(DICT, 'psdrename.lang');
```

`applyI18n()` fills every `data-i18n`, `data-i18n-title` and `data-i18n-ph`
element. `tr('rn.count', 10, 3)` substitutes `{0}` and `{1}`. English is the
default, and an unknown key falls back to English and then to the key itself.

`localStorage` is unavailable inside a UXP webview, so the language lives in
memory; `setLang()` exists for panels that keep it in their own preferences.

## License

[MIT](LICENSE)
