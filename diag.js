//---------------------------------------------------------------------------
// 自己診断行 — 共通
//
// fetch もブリッジも使わず、画面の #diagLine に内部状態を出し続ける。
// 「見えている画面のコンテキスト」が何を考えているかを直接読むための仕掛けで、
// ブリッジが死んでいても動くことに意味がある。時計が止まっていれば
// 画面の合成そのものが凍っている。
//
// 出す内容:
//
//   [iid] 時計 <案件ごとの項目> host:ok sent:12 SENDERR:… JSERR:…
//
// 案件ごとの項目は fields() で差し込む (接続状態や行数など)。
//---------------------------------------------------------------------------

/// この webview インスタンスの識別子。パネルへ送るメッセージにも載せる。
export function newIid() {
	return Math.floor(Math.random() * 36 ** 4).toString(36);
}

/// 診断行を 1 つ作る。作った時点から動きはじめる。
///
///   const diag = createDiag({
///       iid: IID,
///       stats: bridge.stats,
///       fields: () => ' conn:' + (state.connected ? 'Y' : 'n') +
///                     ' rows:' + state.rows.length,
///   });
///   diag.toggle();   // Ctrl+D や ≡ メニューから
export function createDiag(opts = {}) {
	const {
		iid = '',
		stats = { sendTries: 0, lastSendError: '' },
		fields = () => '',
		elementId = 'diagLine',
		intervalMs = 500,
	} = opts;

	let shown = false;
	let lastJsError = '';

	window.addEventListener('error', (e) => {
		lastJsError = (e.message || '') + ' @' +
		              (e.filename || '').split('/').pop() + ':' + e.lineno;
	});
	window.addEventListener('unhandledrejection', (e) => {
		lastJsError = 'reject: ' + String(e.reason && (e.reason.message || e.reason));
	});

	function hostState() {
		if (!window.uxpHost) return 'none';
		return window.uxpHost.__mock ? 'mock' : 'ok';
	}

	function update() {
		const el = document.getElementById(elementId);
		if (!el) return;
		const t = new Date();
		const clock = t.toTimeString().slice(0, 8) + '.' +
		              Math.floor(t.getMilliseconds() / 100);
		el.textContent =
			'[' + iid + '] ' + clock +
			fields() +
			' host:' + hostState() +
			' sent:' + stats.sendTries +
			(stats.lastSendError ? ' SENDERR:' + stats.lastSendError : '') +
			(lastJsError ? ' JSERR:' + lastJsError : '');
		el.className = (shown ? 'show' : '') +
		               ((lastJsError || stats.lastSendError) ? ' err' : '');
	}

	setInterval(update, intervalMs);

	return {
		toggle() { shown = !shown; update(); },
		update,
		get shown() { return shown; },
		get lastJsError() { return lastJsError; },
	};
}
