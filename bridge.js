//---------------------------------------------------------------------------
// UXP パネルとの postMessage ブリッジ — 共通
//
// webview 側の窓口。要求には reqId を振って応答を Promise で受け、
// パネルからの一方的な通知 (ツリー更新など) はハンドラ表に配る。
//
// ここには実機で踏んだ挙動が集まっている:
//
//   - webview → panel の送信形は環境によって受け付ける形が違うので、
//     文字列 1 引数 → 文字列 + targetOrigin → 素のオブジェクト の順に試す
//   - パネル → webview は `window` の message として届く
//     (`<webview>` 要素側の message は data が undefined で来る)
//   - 起動直後の ready はブリッジ確立前だと消えることがあるので、
//     接続が立つまで一定間隔で送り直す
//   - 応答が来ないまま放置すると Promise が永久に残り、ボタンが
//     disabled のまま固まるので、必ずタイムアウトで reject する
//---------------------------------------------------------------------------

/// ブリッジを 1 つ作る。返り値の post / request をそのまま使う。
///
///   const bridge = createBridge({
///       iid: IID,
///       timeoutMessage: (type) => tr('app.timeout', type),
///       handlers: { tree: applyTree, log: (m) => dlog('panel', m.msg),
///                   showHelp: openHelp },
///       isConnected: () => state.connected,
///       onSendError: () => { if (!state.connected) renderAll(); },
///       onGiveUp: () => { bridgeFailed = true; renderAll(); },
///   });
///   const { post, request } = bridge;
///
/// handlers は「メッセージ型 → 関数」。reqId 付きの応答で Promise を解決した
/// あとも、その型のハンドラがあれば呼ぶ (tree は応答であり通知でもある)。
export function createBridge(opts = {}) {
	const {
		iid = '',
		timeoutMs = 20000,
		timeoutMessage = (type) => 'no response from the panel (' + type + ')',
		handlers = {},
		isConnected = () => true,
		onSendError = null,
		onGiveUp = null,
		readyTries = 20,
		readyIntervalMs = 700,
	} = opts;

	const pending = new Map();
	let reqSeq = 0;
	const stats = { sendTries: 0, lastSendError: '' };   ///< 診断行が読む

	function post(msg) {
		stats.sendTries++;
		const s = JSON.stringify(iid ? { ...msg, iid } : msg);
		const attempts = [
			() => window.uxpHost.postMessage(s),
			() => window.uxpHost.postMessage(s, '*'),
			() => window.uxpHost.postMessage(msg),
		];
		for (const f of attempts) {
			try { f(); return; } catch (e) { stats.lastSendError = String(e && e.message || e); }
		}
		console.error('postMessage failed:', stats.lastSendError);
		if (onSendError) onSendError(msg);
	}

	function request(type, payload = {}) {
		return new Promise((resolve, reject) => {
			const reqId = ++reqSeq;
			const timer = setTimeout(() => {
				if (!pending.has(reqId)) return;
				pending.delete(reqId);
				reject(new Error(timeoutMessage(type)));
			}, timeoutMs);
			pending.set(reqId, {
				resolve: (m) => { clearTimeout(timer); resolve(m); },
				reject: (e) => { clearTimeout(timer); reject(e); },
			});
			post({ type, reqId, ...payload });
		});
	}

	function onMessage(msg) {
		if (typeof msg === 'string') {
			try { msg = JSON.parse(msg); } catch (e) { return; }
		}
		if (!msg || !msg.type) return;

		if (msg.reqId && pending.has(msg.reqId)) {
			const p = pending.get(msg.reqId);
			pending.delete(msg.reqId);
			if (msg.type === 'error') p.reject(new Error(msg.message || 'error'));
			else p.resolve(msg);
		}

		const h = handlers[msg.type];
		if (h) h(msg);
	}

	/// ready を送って接続を待つ。消えることがあるので接続が立つまで送り直す。
	function connect() {
		let tries = 0;
		const timer = setInterval(() => {
			if (isConnected()) { clearInterval(timer); return; }
			if (++tries > readyTries) {
				clearInterval(timer);
				if (onGiveUp) onGiveUp();
				return;
			}
			try { post({ type: 'ready' }); } catch (e) { /* 次のリトライへ */ }
		}, readyIntervalMs);
		try { post({ type: 'ready' }); } catch (e) { /* リトライに任せる */ }
	}

	window.addEventListener('message', (ev) => onMessage(ev.data));

	return { post, request, connect, stats };
}
