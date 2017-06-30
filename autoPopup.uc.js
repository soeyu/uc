// ==UserScript==
// @name           autoPopup++
// @description    可定制化的自动弹出/关闭菜单/面板
// @description:en Auto popup/close menu/panel
// @updateURL      https://raw.githubusercontent.com/xinggsf/uc/master/autoPopup.uc.js
// 配置文件        https://raw.githubusercontent.com/xinggsf/uc/master/_autoPopup.js
// @homepageURL    http://bbs.kafan.cn/thread-1866855-1-1.html
// @include        chrome://browser/content/browser.xul
// @compatibility  Firefox 45+
// @startup        onAutoPopup.startup();
// @shutdown       onAutoPopup.shutdown();
// @author         xinggsf
// @version        2017.6.29
// @note  修改Profiles\chrome\Local\_autoPopup.js配置文件可实现定制化
// ==/UserScript==
-function() {
function clone(src){//浅克隆
	if (!src) return;
	let r = src.constructor === Object ?
		new src.constructor() :
		new src.constructor(src.valueOf());
	for (let key in src){
		if ( r[key] !== src[key] ){
			r[key] = src[key];
		}
	}
	r.toString = src.toString;
	r.valueOf = src.valueOf;
	return r;
}

const $ = id => document.getElementById(id),
idWidgetPanel = 'customizationui-widget-panel',

ppmPos = ['after_start','end_before','before_start','start_before'];
function getPopupPos(elt) {
	let box, w, h, b = !1,
	x = elt.boxObject.screenX,
	y = elt.boxObject.screenY;

	while (elt = elt.parentNode.closest('toolbar,hbox,vbox')) {
		h = elt.boxObject.height;
		w = elt.boxObject.width;
		if (h >= 45 && h >= 3 * w) {
			b = !0;
			break;
		}
		if (w >= 45 && w >= 3 * h) break;
	}
	if (!elt) return ppmPos[0];
	box = elt.boxObject;
	x = b ? (x <= w / 2 + box.screenX ? 1 : 3) :
			(y <= h / 2 + box.screenY ? 0 : 2);
	return ppmPos[x];
}

let nDelay, blackIDs, whiteIDs;
function loadUserSet() {
	let aFile = FileUtils.getFile("UChrm", ["local", "_autoPopup.js"], false);
	if (!aFile.exists() || !aFile.isFile()) return;
	let fstream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
	let sstream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
	fstream.init(aFile, -1, 0, 0);
	sstream.init(fstream);
	let data = sstream.read(sstream.available());
	try {
		data = decodeURIComponent(escape(data));
	} catch (e) {}
	sstream.close();
	fstream.close();
	if (data) return eval(data);
	/*
	let sandbox = new Cu.Sandbox(new XPCNativeWrapper(window));
	try {
		Cu.evalInSandbox(data, sandbox, 'latest');
	} catch (e) {
		return;
	}

	{nDelay, blackIDs, whiteIDs} = sandbox; */
}

class MenuAct {//菜单动作基类
	constructor(btnCSS = '', menuId = '') {
		this.btnCSS = btnCSS;
		this.menuId = menuId;
	}
	isButton(e) {
		this._ppm = 0;
		this.btn = e;
		return this.btnCSS ? e.matches(this.btnCSS) : this._isButton(e);
	}
	getPopupMenu(e) {
		if (this.menuId) return $(this.menuId);
		let s = e.getAttribute('context') || e.getAttribute('popup');
		return (s && $(s)) || e.querySelector('menupopup');
		//let c = e.ownerDocument.getAnonymousNodes(e);
	}
	get ppm() {
		let m = this._ppm || this.getPopupMenu(this.btn);
		if (m) {
			let frm = m.querySelector('iframe[src][type=content]');
			if (frm) this.frameURI = frm.getAttribute('src');
			this._ppm = m;
		}
		return m;
	}
	open(){
		let m = this.ppm;
		//console.log(m);
		if (m) {
			if (m.openPopup)
				m.openPopup(this.btn, getPopupPos(this.btn));
			else if (m.showPopup)
				m.showPopup();
			else if (m.popupBoxObject)
				m.popupBoxObject.showPopup();
		}
		else this.btn.click();
	}
	close(){
		if (idWidgetPanel === this.menuid)
            gURLBar.click();
        else if (this.ppm) {
			if (this.ppm.hidePopup)
				this.ppm.hidePopup();
			else if (this.ppm.popupBoxObject)
				this.ppm.popupBoxObject.hidePopup();
			else if (this.btn.closePopup)
				this.btn.closePopup();
		}
	}
}
let menuActContainer = [
	new class extends MenuAct{//处理白名单
		_isButton(e) {
			if (!e.hasAttribute('id')) return !1;
			let id = e.id;
			this.item = whiteIDs.find(k => k.id === id);
			return !!this.item;
		}
		getPopupMenu(e) {
			let id = this.item.popMenu;
			return (id && $(id)) || super.getPopupMenu(e);
		}
		open() {
			let fn = this.item.open;
			fn ? fn(this.btn) : super.open();
		}
		close() {
			let fn = this.item.close;
			fn ? fn(this.ppm) : super.close();
		}
	}(),
	new class extends MenuAct{//处理黑名单
		_isButton(e) {
			return blackIDs.some(css => e.mozMatchesSelector(css));
		}
		open() {}
	}(),
	new class extends MenuAct{
		getPopupMenu(e) {
			return this.btn;
		}
		close() {
			this.btn.open = !1;
		}
		open() {
			this.btn.open = !0;
		}
	}('menulist'),
	new class extends MenuAct{
		close() {
			this.ppm.parentNode.closePopup();
		}
	}('dropmarker'),
	new MenuAct('[widget-id][widget-type]',idWidgetPanel),
	//omnibar中的搜索引擎图标 btn => $('omnibar-in-urlbar').click()
	new MenuAct('#omnibar-defaultEngine','omnibar-engine-menu'),
	new class extends MenuAct{//原始搜索按钮
		close() {
			BrowserSearch.searchBar.textbox.closePopup();
		}
		open() {
			BrowserSearch.searchBar.openSuggestionsPanel();
		}
	}('[anonid=searchbar-search-button]','PopupSearchAutoComplete'),
	//new MenuAct('toolbarbutton[role=button][type=menu]'),
	//new MenuAct('#bookmarks-menu-button > toolbarbutton', 'BMB_bookmarksPopup'),
	new class extends MenuAct{
		_isButton(e) {
			return e.matches('toolbarbutton') && e.parentNode
				.matches('toolbarbutton') && this.ppm;
		}
		getPopupMenu(e) {
			return super.getPopupMenu(e.parentNode);
		}
	}(),
	new class extends MenuAct{
		_isButton(e) {
			return /toolbarbutton|button/.test(e.localName) && this.ppm;
		}
	}(),
	new class extends MenuAct{
		_isButton(e) {
			return e.closest('toolbar') && this.ppm &&
			('image' === e.nodeName || e.matches('[src^="data:image"]'));
		}
	}(),
];
let btnManager, ppmManager, _inMenu;
class AutoPop {
	constructor() {
		this.timer = 0;
		this.act = null;//MenuAct
	}
	clearTimer() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = 0;
		}
	}
	clean() {
		if (!this.act) return;
		this.clearTimer();
		this.act = null;
	}
	inMenu(e) {
		let a = ppmManager.act;
		if (!a || !a.ppm) return !1;
		if (e.nodeName === 'menuitem' || e === a.btn || a.frameURI === e.baseURI ||
			a.ppm.contains(e) || e.closest('vbox.panel-arrowcontainer,menupopup,popupset'))
			return !0;
		if (a.ppm.id !== idWidgetPanel) return !1;
		//console.log(e, e.ownerDocument, e.ownerDocument.location.href);
		// if (e.ownerDocument === document && e.matches('iframe[src][type=content]'))
			// a.frameURI = e.getAttribute('src');
		// return e.closest('[panelopen=true]');
		if (e.closest('[panelopen=true]')) return !0;
        // chrome://*.html仍然是旧式的扩展，文档类型为XULDocument
        return /^(moz-extension|chrome):\/\/.+\.html?$/i.test(e.ownerDocument.location.href);//e.ownerDocument instanceof HTMLDocument &&
	}
}
btnManager = new class extends AutoPop {
	setTimer() {
		this.timer = setTimeout(() => {
			this.act.open();
			ppmManager.clean();
			ppmManager.act = clone(this.act);
			this.clean();
		}, nDelay +9);
	}
	mouseOver(e) {
		this.clean();
		_inMenu = this.inMenu(e);
		if (_inMenu || e.disabled)
			return;
		for (let k of menuActContainer) {
			if (k.isButton(e)) {
				this.act = k;
				this.setTimer();
				break;
			}
		}
	}
}();
ppmManager = new class extends AutoPop {
	clean() {
		if (this.act) {
			this.act.close();
			super.clean();
		}
	}
	setTimer() {
		if (!this.timer) this.timer = setTimeout(() => {
			this.clean();
		}, nDelay);
	}
	mouseOver(e) {
		if (_inMenu) {
			this.clearTimer();
			return;
		}
		if (this.act) this.setTimer();
	}
}();

if (window.onAutoPopup) {
	window.onAutoPopup.shutdown();
	delete window.onAutoPopup;
}
let prevElt;
window.onAutoPopup = {//事件处理“类”
    startup() {
		prevElt = null;
		loadUserSet();
		let btnOmni = $('omnibar-defaultEngine');
		if (!BrowserSearch.searchBar || btnOmni)
			menuActContainer.splice(6, 1);
		if (!btnOmni)
			menuActContainer.splice(5, 1);

	    window.addEventListener('mouseover', this.mouseOver, !1);
	    window.addEventListener("unload", this.shutdown);
    },
	shutdown: ev => window.removeEventListener('mouseover', this.mouseOver),
	mouseOver(ev) {
		if (!document.hasFocus()) {
			ppmManager.clean();
			return;
		}
		let e = ev.originalTarget;
		if (e === prevElt) return;
		prevElt = e;
		btnManager.mouseOver(e);
		ppmManager.mouseOver(e);
	}
}
onAutoPopup.startup();

}();