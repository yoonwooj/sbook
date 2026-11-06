/* ==========================================================================
 * 스케치북 그리기 기능 (draw.js)
 * - 연필 / 붓 / 색연필 / 형광펜 / 스프레이 / 페인트통
 * - 지우개 3종 (둥근 / 네모 / 부드러운)
 * - 색상(.btn__color), 굵기(.btn__pendp), 이전/다음, 전체 지우기
 * ui.js 가 만든 버튼들을 그대로 읽어서 동작합니다. (ui.js 뒤에 로드)
 * ========================================================================== */
(function () {
    'use strict';

    var paper = document.querySelector('.contents__paper');
    if (!paper) return;

    /* ---------- 캔버스 준비 ---------- */
    var canvas = document.createElement('canvas');   // 실제 그림
    var live = document.createElement('canvas');     // 형광펜 미리보기용 임시 레이어
    var ring = document.createElement('div');        // 붓 크기 표시 커서
    canvas.className = 'draw__canvas';
    live.className = 'draw__live';
    ring.className = 'draw__ring';
    var stage = document.createElement('div');       // 확대/이동이 적용되는 종이
    stage.className = 'draw__stage';
    stage.appendChild(canvas);
    stage.appendChild(live);
    stage.appendChild(ring);
    paper.appendChild(stage);

    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var lctx = live.getContext('2d');
    var dpr = 1;
    var W = 0, H = 0;   // CSS px 크기

    /* ---------- 도구 설정 ---------- */
    var DRAW_SIZE = [2, 5, 10, 18];       // small, mid, large, xlarge
    var ERASE_SIZE = [10, 22, 40, 70];
    var SHAPE_NAMES = ['line', 'rect', 'circle', 'ellipse', 'triangle', 'pentagon', 'hexagon', 'bubble'];
    var STICKER_NAMES = [];
    for (var n = 1; n <= 19; n++) STICKER_NAMES.push('sticker_' + (n < 10 ? '0' : '') + n);
    var TOOL_NAMES = ['pen', 'calligraphy', 'crayon', 'highlighter', 'spray', 'bucket',
                      'eraser1', 'eraser2', 'eraser3'].concat(SHAPE_NAMES, STICKER_NAMES);
    var STICKER_SIZE = [70, 110, 160, 240];   // 굵기 버튼 → 스티커 크기(px)
    // 버튼 이름 → 의미:  pen=연필, calligraphy=붓, crayon=색연필
    var HISTORY_MAX = 20;

    function subWraps() { return Array.prototype.slice.call(document.querySelectorAll('.subMenuWrap')); }

    function currentTool() {
        var wraps = subWraps();
        var wrap = document.querySelector('.subMenuWrap.active');
        var tab = wraps.indexOf(wrap);
        if (tab < 0) return null;
        var btn = wrap.querySelector('.subMenu__list.active button') || wrap.querySelector('.subMenu__list button');
        if (!btn) return null;
        for (var i = 0; i < TOOL_NAMES.length; i++) {
            if (btn.classList.contains(TOOL_NAMES[i])) return TOOL_NAMES[i];
        }
        return null;
    }

    function isEraser(t) { return t && t.indexOf('eraser') === 0; }
    function isShape(t) { return SHAPE_NAMES.indexOf(t) >= 0; }
    function isSticker(t) { return t && t.indexOf('sticker_') === 0; }

    function currentColor() {
        var b = document.querySelector('.btn__color.active') || document.querySelector('.btn__color');
        return b ? getComputedStyle(b).backgroundColor : '#000';
    }

    function sizeIndex() {
        var list = Array.prototype.slice.call(document.querySelectorAll('.btn__pendp'));
        var i = list.indexOf(document.querySelector('.btn__pendp.active'));
        return i < 0 ? 1 : i;
    }

    // 도구별 실제 굵기(px)
    function widthFor(tool) {
        var i = sizeIndex();
        if (isEraser(tool)) return ERASE_SIZE[i];
        if (isShape(tool)) return DRAW_SIZE[i] * 0.9 + 1.5;
        if (isSticker(tool)) return STICKER_SIZE[i];
        var s = DRAW_SIZE[i];
        switch (tool) {
            case 'pen': return Math.max(1.2, s * 0.7);
            case 'calligraphy': return s * 1.6 + 2;
            case 'crayon': return s * 1.4 + 3;
            case 'highlighter': return s * 2.6 + 8;
            case 'spray': return s * 2.6 + 14;   // 지름
        }
        return s;
    }

    /* ---------- 캔버스 크기 (커지기만 함: 그림/되돌리기 보존) ---------- */
    function fitCanvas() {
        var cw = paper.clientWidth, ch = paper.clientHeight;
        if (!cw || !ch) return;
        if (cw <= W && ch <= H) return;
        var nw = Math.max(cw, W), nh = Math.max(ch, H);

        var d = Math.min(window.devicePixelRatio || 1, 2);
        if (nw * nh * d * d > 3500000) d = 1;       // 큰 화면은 메모리 절약

        var tmp = null;
        if (W) {
            tmp = document.createElement('canvas');
            tmp.width = canvas.width; tmp.height = canvas.height;
            tmp.getContext('2d').drawImage(canvas, 0, 0);
        }
        dpr = d; W = nw; H = nh;
        [canvas, live].forEach(function (c) {
            c.width = Math.round(W * dpr);
            c.height = Math.round(H * dpr);
            c.style.width = W + 'px';
            c.style.height = H + 'px';
        });
        stage.style.width = W + 'px';
        stage.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        applyView();
        if (tmp) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(tmp, 0, 0); ctx.restore(); }
        resetHistory();
    }

    /* ---------- 되돌리기 / 다시하기 ---------- */
    var history = [], hIdx = -1;
    var btnUndo = document.querySelector('.btn__undo');
    var btnRedo = document.querySelector('.btn__redo');

    function snapshot() { return ctx.getImageData(0, 0, canvas.width, canvas.height); }
    function resetHistory() { history = [snapshot()]; hIdx = 0; updateHistoryButtons(); }
    function pushHistory() {
        history = history.slice(0, hIdx + 1);
        history.push(snapshot());
        if (history.length > HISTORY_MAX) history.shift();
        hIdx = history.length - 1;
        updateHistoryButtons();
    }
    function restore() { ctx.putImageData(history[hIdx], 0, 0); updateHistoryButtons(); }
    function undo() { if (hIdx > 0) { hIdx--; restore(); } }
    function redo() { if (hIdx < history.length - 1) { hIdx++; restore(); } }
    function updateHistoryButtons() {
        if (btnUndo) btnUndo.classList.toggle('disabled', hIdx <= 0);
        if (btnRedo) btnRedo.classList.toggle('disabled', hIdx >= history.length - 1);
    }
    function clearAll() {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        pushHistory();
    }

    if (btnUndo) btnUndo.addEventListener('click', undo);
    if (btnRedo) btnRedo.addEventListener('click', redo);
    var btnDelete = document.querySelector('.btn__delete');
    if (btnDelete) btnDelete.addEventListener('click', clearAll);
    document.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        var k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    });

    /* ---------- 탭별로 마지막에 고른 도구 기억 ---------- */
    (function rememberToolPerTab() {
        var wraps = subWraps();
        var remembered = [null, null, null, null];
        wraps.forEach(function (wrap, ti) {
            wrap.querySelectorAll('.subMenu__list button').forEach(function (b) {
                b.addEventListener('click', function () { remembered[ti] = b.closest('.subMenu__list'); });
            });
        });
        document.querySelectorAll('.gnb__list .btn').forEach(function (btn, ti) {
            btn.addEventListener('click', function () {
                var item = remembered[ti];
                if (!item) return;
                wraps[ti].querySelectorAll('.subMenu__list').forEach(function (li) { li.classList.remove('active'); });
                item.classList.add('active');
            });
        });
    })();

    /* ---------- 그리기 ---------- */
    var drawing = false, pid = null, tool = null, st = null, sprayTimer = null;
    var handCheck = document.getElementById('use');   // 체크 = 손 모드

    function pos(e) {
        var r = canvas.getBoundingClientRect();
        var k = (r.width / (W || 1)) || 1;   // 현재 확대 배율
        return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
    }
    function pressureOf(e) {
        return e.pointerType === 'pen' && e.pressure ? 0.4 + e.pressure * 1.2 : 1;
    }
    function rnd(a, b) { return a + Math.random() * (b - a); }

    // 두 점 사이를 일정 간격으로 찍어 주는 헬퍼
    function stampLine(a, b, spacing, fn) {
        var d = Math.hypot(b.x - a.x, b.y - a.y);
        var n = Math.max(1, Math.ceil(d / spacing));
        for (var i = 1; i <= n; i++) fn(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n);
    }

    function setupStroke(c, color, width, erase) {
        c.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        c.globalAlpha = 1;
        c.strokeStyle = color;
        c.fillStyle = color;
        c.lineWidth = width;
        c.lineCap = 'round';
        c.lineJoin = 'round';
    }

    // 부드러운 곡선(중간점 이차곡선)으로 한 구간 그리기
    function smoothSegment(c, p, width) {
        var mid = { x: (st.last.x + p.x) / 2, y: (st.last.y + p.y) / 2 };
        c.lineWidth = width;
        c.beginPath();
        c.moveTo(st.prevMid.x, st.prevMid.y);
        c.quadraticCurveTo(st.last.x, st.last.y, mid.x, mid.y);
        c.stroke();
        st.prevMid = mid;
        st.last = p;
    }

    function dot(c, x, y, width) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 0.01, y + 0.01);
        c.lineWidth = width;
        c.stroke();
    }

    function crayonStamp(x, y) {
        // 색연필: 종이 결이 비치는 듯한 촘촘한 알갱이 + 옅은 바탕색
        var w = st.w, r0 = w / 2;
        ctx.fillStyle = st.color;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(x, y, r0 * 0.92, 0, Math.PI * 2);
        ctx.fill();
        var count = Math.ceil(w * 1.4) + 4;
        var size = w > 14 ? 2.2 : 1.7;
        for (var k = 0; k < count; k++) {
            var a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * r0;
            ctx.globalAlpha = rnd(0.45, 1);
            ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, size, size);
        }
        ctx.globalAlpha = 1;
    }

    function sprayAt(x, y) {
        var rad = st.w / 2;
        var count = Math.ceil(rad * 1.6);
        ctx.fillStyle = st.color;
        for (var k = 0; k < count; k++) {
            var a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * rad;
            ctx.globalAlpha = rnd(0.4, 0.9);
            ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.3, 1.3);
        }
        ctx.globalAlpha = 1;
    }

    function eraseSquare(x, y) {
        var s = st.w;
        ctx.clearRect(x - s / 2, y - s / 2, s, s);
    }

    function eraseSoft(x, y) {
        var r = st.w / 2;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,0.45)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // 시작 점
    function strokeStart(p, pr, t) {
        switch (tool) {
            case 'pen':
                setupStroke(ctx, st.color, st.w * pr, false);
                dot(ctx, p.x, p.y, st.w * pr);
                break;
            case 'calligraphy':
                st.bw = st.w * 0.9 * pr;
                setupStroke(ctx, st.color, st.bw, false);
                dot(ctx, p.x, p.y, st.bw);
                break;
            case 'crayon': crayonStamp(p.x, p.y); break;
            case 'highlighter':
                setupStroke(lctx, st.color, st.w, false);
                dot(lctx, p.x, p.y, st.w);
                break;
            case 'spray': sprayAt(p.x, p.y); break;
            case 'eraser1':
                setupStroke(ctx, '#000', st.w, true);
                dot(ctx, p.x, p.y, st.w);
                break;
            case 'eraser2': eraseSquare(p.x, p.y); break;
            case 'eraser3': eraseSoft(p.x, p.y); break;
        }
    }

    // 이동
    function strokeMove(p, pr, t) {
        switch (tool) {
            case 'pen':
                setupStroke(ctx, st.color, st.w * pr, false);
                smoothSegment(ctx, p, st.w * pr);
                break;
            case 'calligraphy': {
                // 빠르게 그을수록 가늘어지고, 천천히 그을수록 굵어지는 붓 느낌
                var dt = Math.max(1, t - st.lastT);
                var speed = Math.hypot(p.x - st.last.x, p.y - st.last.y) / dt;   // px/ms
                var target = st.w * pr * (1.25 - Math.min(speed / 2.5, 1) * 0.85);
                st.bw = st.bw * 0.75 + target * 0.25;
                setupStroke(ctx, st.color, st.bw, false);
                smoothSegment(ctx, p, st.bw);
                break;
            }
            case 'crayon':
                stampLine(st.last, p, Math.max(1, st.w / 8), crayonStamp);
                st.last = p;
                break;
            case 'highlighter':
                setupStroke(lctx, st.color, st.w, false);
                smoothSegment(lctx, p, st.w);
                break;
            case 'spray':
                stampLine(st.last, p, Math.max(2, st.w / 6), sprayAt);
                st.last = p;
                break;
            case 'eraser1':
                setupStroke(ctx, '#000', st.w, true);
                smoothSegment(ctx, p, st.w);
                break;
            case 'eraser2':
                stampLine(st.last, p, Math.max(2, st.w / 5), function (x, y) { eraseSquare(x, y); });
                st.last = p;
                break;
            case 'eraser3':
                stampLine(st.last, p, Math.max(2, st.w / 6), eraseSoft);
                st.last = p;
                break;
        }
        st.lastT = t;
    }

    function strokeEnd() {
        // 도형/스티커: 미리보기 레이어를 본 캔버스에 확정
        if (isShape(tool) || isSticker(tool)) {
            var keep = st.moved;
            if (keep) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(live, 0, 0);
                ctx.restore();
            }
            clearLive();
            liveSolid(false);
            return keep;
        }
        // 곡선의 마지막 구간 마무리
        if (tool === 'pen' || tool === 'calligraphy' || tool === 'highlighter' || tool === 'eraser1') {
            var c = tool === 'highlighter' ? lctx : ctx;
            var w = tool === 'calligraphy' ? st.bw : (tool === 'pen' ? st.w : st.w);
            setupStroke(c, tool === 'eraser1' ? '#000' : st.color, w, tool === 'eraser1');
            c.beginPath();
            c.moveTo(st.prevMid.x, st.prevMid.y);
            c.lineTo(st.last.x, st.last.y);
            c.stroke();
        }
        // 형광펜: 임시 레이어를 반투명 + 곱하기로 본 캔버스에 합치기
        if (tool === 'highlighter') {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 0.4;
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(live, 0, 0);
            ctx.restore();
            lctx.save();
            lctx.setTransform(1, 0, 0, 1, 0, 0);
            lctx.clearRect(0, 0, live.width, live.height);
            lctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        return true;
    }

    /* ---------- 도형 ---------- */
    function polyPath(c, n, startDeg, x, y, w, h) {
        var pts = [], minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        for (var i = 0; i < n; i++) {
            var a = (startDeg + (360 / n) * i) * Math.PI / 180;
            var px = Math.cos(a), py = Math.sin(a);
            pts.push([px, py]);
            minX = Math.min(minX, px); maxX = Math.max(maxX, px);
            minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        }
        for (var j = 0; j < n; j++) {
            var X = x + (pts[j][0] - minX) / (maxX - minX) * w;
            var Y = y + (pts[j][1] - minY) / (maxY - minY) * h;
            if (j === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
        }
        c.closePath();
    }

    function shapePath(c, t, a, b) {
        var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        var w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        c.beginPath();
        switch (t) {
            case 'line': c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); break;
            case 'rect': c.rect(x, y, w, h); break;
            case 'circle':   // 시작점이 중심, 끌어간 거리가 반지름
                c.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); break;
            case 'ellipse': c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); break;
            case 'triangle':
                c.moveTo(x + w / 2, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); break;
            case 'pentagon': polyPath(c, 5, -90, x, y, w, h); break;
            case 'hexagon': polyPath(c, 6, 0, x, y, w, h); break;
            case 'bubble': {   // 말풍선
                var bh = h * 0.78;
                var r = Math.max(0, Math.min(Math.min(w, bh) * 0.22, bh / 2, w / 2));
                c.moveTo(x + r, y);
                c.lineTo(x + w - r, y);
                c.arcTo(x + w, y, x + w, y + r, r);
                c.lineTo(x + w, y + bh - r);
                c.arcTo(x + w, y + bh, x + w - r, y + bh, r);
                c.lineTo(x + w * 0.5, y + bh);
                c.lineTo(x + w * 0.25, y + h);
                c.lineTo(x + w * 0.3, y + bh);
                c.lineTo(x + r, y + bh);
                c.arcTo(x, y + bh, x, y + bh - r, r);
                c.lineTo(x, y + r);
                c.arcTo(x, y, x + r, y, r);
                c.closePath();
                break;
            }
        }
    }

    /* ---------- 이모티콘(스티커) ---------- */
    var stickerImg = {};
    (function loadStickers() {
        var data = window.STICKER_DATA || {};
        Object.keys(data).forEach(function (k) {
            var im = new Image();
            im.src = data[k];
            stickerImg[k] = im;
        });
    })();

    function clearLive() {
        lctx.save();
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.clearRect(0, 0, live.width, live.height);
        lctx.restore();
    }

    function drawSticker(c, name, p, w) {
        var im = stickerImg[name];
        if (!im || !im.complete || !im.naturalWidth) return false;
        var h = w * im.naturalHeight / im.naturalWidth;
        c.drawImage(im, p.x - w / 2, p.y - h / 2, w, h);
        return true;
    }

    // 도형/스티커 미리보기는 불투명하게 (형광펜 미리보기와 구분)
    function liveSolid(on) { live.classList.toggle('is-solid', !!on); }

    /* ---------- 페인트통 (영역 채우기) ---------- */
    function parseColor(str) {
        var m = str.match(/\d+(\.\d+)?/g) || [0, 0, 0];
        return [+m[0], +m[1], +m[2]];
    }

    function bucketFill(x, y, colorStr) {
        var w = canvas.width, h = canvas.height;
        var sx = Math.floor(x * dpr), sy = Math.floor(y * dpr);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false;

        var img = ctx.getImageData(0, 0, w, h);
        var d = img.data;
        var fc = parseColor(colorStr);

        // 흰 종이 위에 올린 색 기준으로 비교 (투명 = 흰색)
        function over(i, ch) {
            var a = d[i + 3] / 255;
            return d[i + ch] * a + 255 * (1 - a);
        }
        var i0 = (sy * w + sx) * 4;
        var tr = over(i0, 0), tg = over(i0, 1), tb = over(i0, 2);
        var TOL = 90;
        function similar(i) {
            return Math.abs(over(i, 0) - tr) + Math.abs(over(i, 1) - tg) + Math.abs(over(i, 2) - tb) <= TOL;
        }

        // 이미 같은 색이면 건너뜀
        if (d[i0 + 3] === 255 && Math.abs(d[i0] - fc[0]) + Math.abs(d[i0 + 1] - fc[1]) + Math.abs(d[i0 + 2] - fc[2]) < 6) return false;

        var mask = new Uint8Array(w * h);
        var stack = [sx, sy];
        while (stack.length) {
            var cy = stack.pop(), cx = stack.pop();
            var lx = cx;
            while (lx >= 0 && !mask[cy * w + lx] && similar((cy * w + lx) * 4)) lx--;
            lx++;
            var up = false, down = false;
            for (var xx = lx; xx < w && !mask[cy * w + xx] && similar((cy * w + xx) * 4); xx++) {
                mask[cy * w + xx] = 1;
                if (cy > 0) {
                    var u = !mask[(cy - 1) * w + xx] && similar(((cy - 1) * w + xx) * 4);
                    if (u && !up) stack.push(xx, cy - 1);
                    up = u;
                }
                if (cy < h - 1) {
                    var dn = !mask[(cy + 1) * w + xx] && similar(((cy + 1) * w + xx) * 4);
                    if (dn && !down) stack.push(xx, cy + 1);
                    down = dn;
                }
            }
        }

        // 채우기 + 선 가장자리(반투명 안티앨리어싱) 밑에 색을 깔아 흰 테두리 방지
        for (var yy = 0; yy < h; yy++) {
            for (var x2 = 0; x2 < w; x2++) {
                var p = yy * w + x2, i = p * 4;
                if (mask[p]) {
                    d[i] = fc[0]; d[i + 1] = fc[1]; d[i + 2] = fc[2]; d[i + 3] = 255;
                } else if (d[i + 3] < 255 &&
                    ((x2 > 0 && mask[p - 1]) || (x2 < w - 1 && mask[p + 1]) ||
                     (yy > 0 && mask[p - w]) || (yy < h - 1 && mask[p + w]))) {
                    var a = d[i + 3] / 255;
                    d[i] = d[i] * a + fc[0] * (1 - a);
                    d[i + 1] = d[i + 1] * a + fc[1] * (1 - a);
                    d[i + 2] = d[i + 2] * a + fc[2] * (1 - a);
                    d[i + 3] = 255;
                }
            }
        }
        ctx.putImageData(img, 0, 0);
        return true;
    }

    /* ---------- 포인터 이벤트 ---------- */
    function allowed(e) {
        if (e.pointerType === 'mouse') return e.button === 0;
        if (e.pointerType === 'touch') return !!(handCheck && handCheck.checked);   // 펜 모드에서는 손가락 입력 무시
        return true;
    }

    canvas.addEventListener('pointerdown', function (e) {
        if (startPan(e)) return;
        if (!allowed(e) || drawing) return;
        var t = currentTool();
        if (!t) return;
        e.preventDefault();
        var p = pos(e);
        tool = t;

        if (t === 'bucket') {
            if (bucketFill(p.x, p.y, currentColor())) pushHistory();
            return;
        }

        drawing = true;
        pid = e.pointerId;
        try { canvas.setPointerCapture(pid); } catch (err) { /* 무시 */ }
        st = {
            color: currentColor(),
            w: widthFor(t),
            last: p, prevMid: p, lastT: e.timeStamp, bw: null,
            start: p, moved: false
        };
        if (isShape(t)) { liveSolid(true); return; }          // 드래그하며 크기 지정
        if (isSticker(t)) {                                    // 누른 자리에 놓고, 끌면 위치 조정
            liveSolid(true);
            st.moved = drawSticker(lctx, t, p, st.w);
            return;
        }
        strokeStart(p, pressureOf(e), e.timeStamp);

        if (t === 'spray') {   // 가만히 눌러도 계속 뿌려지게
            sprayTimer = setInterval(function () { if (drawing) sprayAt(st.last.x, st.last.y); }, 30);
        }
    });

    canvas.addEventListener('pointermove', function (e) {
        if (panning && e.pointerId === panState.pid) { doPan(e); return; }
        var p = pos(e);
        moveRing(e, p);
        if (!drawing || e.pointerId !== pid) return;
        e.preventDefault();
        if (isShape(tool)) {
            clearLive();
            setupStroke(lctx, st.color, st.w, false);
            shapePath(lctx, tool, st.start, p);
            lctx.stroke();
            if (Math.hypot(p.x - st.start.x, p.y - st.start.y) > 3) st.moved = true;
            return;
        }
        if (isSticker(tool)) {
            clearLive();
            st.moved = drawSticker(lctx, tool, p, st.w) || st.moved;
            return;
        }
        var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
        if (!evs.length) evs = [e];
        for (var i = 0; i < evs.length; i++) {
            strokeMove(pos(evs[i]), pressureOf(evs[i]), evs[i].timeStamp || e.timeStamp);
        }
    });

    function finish(e) {
        if (panning && (!e || e.pointerId === panState.pid)) { endPan(); return; }
        if (!drawing || (e && e.pointerId !== pid)) return;
        drawing = false;
        if (sprayTimer) { clearInterval(sprayTimer); sprayTimer = null; }
        try { canvas.releasePointerCapture(pid); } catch (err) { /* 무시 */ }
        if (strokeEnd()) pushHistory();
    }
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* ---------- 커서(굵기 표시 원) ---------- */
    function moveRing(e, p) {
        if (e.pointerType === 'touch') { ring.style.display = 'none'; return; }
        var t = currentTool();
        if (!t || t === 'bucket' || isShape(t) || isSticker(t) || panMode()) { ring.style.display = 'none'; return; }
        var s = Math.max(4, widthFor(t));
        ring.style.display = 'block';
        ring.style.width = ring.style.height = s + 'px';
        ring.style.left = p.x + 'px';
        ring.style.top = p.y + 'px';
        ring.style.borderRadius = t === 'eraser2' ? '2px' : '50%';
    }
    canvas.addEventListener('pointerleave', function () { ring.style.display = 'none'; });

    /* ---------- 확대 / 축소 / 이동 ---------- */
    var view = { s: 1, tx: 0, ty: 0 };
    var panning = false, panState = null, spaceDown = false;
    var zoomRange = document.querySelector('.zoomRange');
    var btnZoomIn = document.querySelector('.btn__zoom.enlargement');
    var btnZoomOut = document.querySelector('.btn__zoom.reduction');
    var btnMove = document.querySelector('.btn__zoom.move');
    var MIN_S = 0.5, MAX_S = 3;

    // 슬라이더 0~100 (50 = 100%)  ↔  배율 0.5배~3배
    function scaleFromRange(v) { return v <= 50 ? MIN_S + (v / 50) * (1 - MIN_S) : 1 + ((v - 50) / 50) * (MAX_S - 1); }
    function rangeFromScale(s) { return s <= 1 ? (s - MIN_S) / (1 - MIN_S) * 50 : 50 + (s - 1) / (MAX_S - 1) * 50; }

    function panMode() { return (btnMove && btnMove.classList.contains('active')) || spaceDown; }

    var KEEP = 120;   // 어느 쪽으로 밀어도 종이가 최소한 이만큼은 화면에 남도록

    function applyView() {
        var pw = paper.clientWidth, ph = paper.clientHeight;
        var sw = W * view.s, sh = H * view.s;
        var mx = Math.min(KEEP, sw, pw), my = Math.min(KEEP, sh, ph);
        view.tx = Math.min(pw - mx, Math.max(mx - sw, view.tx));
        view.ty = Math.min(ph - my, Math.max(my - sh, view.ty));
        stage.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.s + ')';
        stage.classList.toggle('is-moved', view.s < 1 || view.tx !== 0 || view.ty !== 0);
        updateCursor();
    }

    // 이동 버튼을 더블클릭하면 원래 위치/크기로
    function resetView() {
        view.s = 1; view.tx = 0; view.ty = 0;
        applyView();
        syncRange();
    }

    // (cx, cy) = 화면에서 고정할 점 (기본: 화면 중앙)
    function setScale(ns, cx, cy) {
        ns = Math.min(MAX_S, Math.max(MIN_S, ns));
        if (cx === undefined) { cx = paper.clientWidth / 2; cy = paper.clientHeight / 2; }
        var ux = (cx - view.tx) / view.s, uy = (cy - view.ty) / view.s;
        view.s = ns;
        view.tx = cx - ux * ns;
        view.ty = cy - uy * ns;
        applyView();
    }

    function syncRange() { if (zoomRange) zoomRange.value = Math.round(rangeFromScale(view.s) / 5) * 5; }

    if (zoomRange) {
        zoomRange.addEventListener('input', function () { setScale(scaleFromRange(+zoomRange.value)); });
        btnZoomIn.addEventListener('click', function () {
            zoomRange.value = Math.min(100, +zoomRange.value + 10);
            setScale(scaleFromRange(+zoomRange.value));
        });
        btnZoomOut.addEventListener('click', function () {
            zoomRange.value = Math.max(0, +zoomRange.value - 10);
            setScale(scaleFromRange(+zoomRange.value));
        });
    }

    // 이동(손) 버튼 상태가 바뀌면 커서 갱신
    if (btnMove) {
        btnMove.addEventListener('click', function () { setTimeout(updateCursor, 0); });
        btnMove.addEventListener('dblclick', resetView);
        btnMove.title = '이동 (두 번 누르면 원래 위치로)';
    }

    // 마우스 휠: Ctrl+휠 = 확대/축소, 그냥 휠 = 화면 이동
    paper.addEventListener('wheel', function (e) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            var r = paper.getBoundingClientRect();
            setScale(view.s * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
            syncRange();
        } else {
            view.tx -= e.deltaX; view.ty -= e.deltaY;
            applyView();
        }
    }, { passive: false });

    // 스페이스바를 누르고 있는 동안 임시로 이동 모드
    document.addEventListener('keydown', function (e) {
        if (e.code === 'Space' && !e.repeat && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) {
            spaceDown = true; e.preventDefault(); updateCursor();
        }
    });
    document.addEventListener('keyup', function (e) {
        if (e.code === 'Space') { spaceDown = false; updateCursor(); }
    });

    function updateCursor() {
        canvas.style.cursor = panning ? 'grabbing' : (panMode() ? 'grab' : '');
        if (panMode()) ring.style.display = 'none';
    }

    // 이동 시작 (이동 모드 / 가운데 버튼). 손가락도 이동 모드면 화면을 끌 수 있음
    function startPan(e) {
        var middle = e.pointerType === 'mouse' && e.button === 1;
        if (!(panMode() || middle)) return false;
        if (e.pointerType === 'mouse' && e.button !== 0 && !middle) return false;
        e.preventDefault();
        panning = true;
        panState = { pid: e.pointerId, x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        updateCursor();
        return true;
    }
    function doPan(e) {
        view.tx = panState.tx + (e.clientX - panState.x);
        view.ty = panState.ty + (e.clientY - panState.y);
        applyView();
    }
    function endPan() {
        panning = false;
        try { canvas.releasePointerCapture(panState.pid); } catch (err) { /* 무시 */ }
        panState = null;
        updateCursor();
    }

    /* ---------- 시작 ---------- */
    fitCanvas();
    if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe(paper);
    window.addEventListener('resize', fitCanvas);
    setTimeout(fitCanvas, 0);
})();
