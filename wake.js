//---------------------------------------------------------------------------
// 「パネルを起こしてください」の案内 — psdrename / psdtext / psdexport 共通
//
// Windows では、パネルを開いた直後のプラグイン UI にキーボードが配送されない。
// クリックは届き、DOM のフォーカスも入力欄まで来るのに、打鍵も Ctrl+V も
// 何も起きない。Photoshop 本体を一度クリックすると、以降は普通に動く。
//
// これは Adobe 側の既知の不具合で、公式な回避策も API も無い
// (app.bringToFront() も Windows では効かない)。webview 固有ではなく、
// パネル上のネイティブ入力欄でも同じに起きる。こちらから直す手段が無いので、
// 一度きりの案内で凌ぐ。
//
// 消えかたが肝心で、閉じるボタンを押させると案内として弱い。
// 実際にキーが届いた時点で自動的に消す。「打てるようになった」ことが
// そのまま消える条件なので、案内が残っていること自体が「まだ起きていない」
// の表示になる。
//---------------------------------------------------------------------------

/// #wakeHint を出し、最初のキー入力が届いたら消す。
///
///   import { createWakeHint } from './common/wake.js';
///   createWakeHint();
///
/// 対象の要素は各案件の index.html が持つ (文言は data-i18n で入れる)。
/// macOS では起きない不具合なので、Windows 以外では最初から出さない。
export function createWakeHint(opts = {}) {
	const {
		elementId = 'wakeHint',
		onlyOnWindows = true,
		className = 'show',
	} = opts;

	const el = document.getElementById(elementId);
	if (!el) return { hide() {}, get shown() { return false; } };

	const isWindows = /win/i.test(navigator.platform || navigator.userAgent || '');
	if (onlyOnWindows && !isWindows) return { hide() {}, get shown() { return false; } };

	let shown = true;
	el.classList.add(className);

	function hide() {
		if (!shown) return;
		shown = false;
		el.classList.remove(className);
	}

	// キーが 1 つでも届けば、もう起きている。capture で拾うのは、
	// 入力欄が stopPropagation する作りでも確実に届かせるため。
	window.addEventListener('keydown', hide, true);

	// 読んだ人が邪魔に思ったら押して消せる (押さなくても打てば消える)
	el.addEventListener('click', hide);

	return { hide, get shown() { return shown; } };
}
