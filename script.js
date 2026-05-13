let audioCtx;
let timerInterval;
const TIME_LIMIT = 120;
let exerciseStep = 0;

const levelUpAudio = new Audio('SIX SEVEN-recortado.mp3');

function renderMathDirectly(elementId, latexStr) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    // SOLUCIÓN VISUAL: Ajuste de escala para expresiones muy largas
    // Si el texto es largo, bajamos el tamaño de fuente y permitimos scroll horizontal
    el.style.overflowX = "auto";
    el.style.whiteSpace = "nowrap";
    if (latexStr.length > 60) {
        el.style.fontSize = "0.85rem";
    } else if (latexStr.length > 40) {
        el.style.fontSize = "1rem";
    } else {
        el.style.fontSize = "1.2rem";
    }

    el.innerHTML = `\\( ${latexStr} \\)`;
    
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([el]).then(() => {
            const mjx = el.querySelector('mjx-container');
            if (mjx) mjx.style.color = 'black';
        }).catch(err => console.warn("MathJax error:", err));
    }
}

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        if (type === 'hit') { osc.type = 'square'; osc.frequency.setValueAtTime(120, audioCtx.currentTime); gain.gain.setValueAtTime(0.1, audioCtx.currentTime); osc.start(); osc.stop(audioCtx.currentTime + 0.2); }
        else if (type === 'spell') { osc.type = 'triangle'; osc.frequency.setValueAtTime(440, audioCtx.currentTime); gain.gain.setValueAtTime(0.1, audioCtx.currentTime); osc.start(); osc.stop(audioCtx.currentTime + 0.3); }
        else if (type === 'click') { osc.type = 'sine'; osc.frequency.setValueAtTime(900, audioCtx.currentTime); gain.gain.setValueAtTime(0.03, audioCtx.currentTime); osc.start(); osc.stop(audioCtx.currentTime + 0.05); }
    } catch(e) {}
}

const randomSign = () => (Math.random() > 0.5 ? 1 : -1);
const randomCoef = () => (Math.floor(Math.random() * 6) + 1) * randomSign();

function generatePolyWithRules(termsCount, maxDegree, exactDegree = false) {
    let terms = [];
    let usedExponents = new Set();
    if (exactDegree && termsCount > 0) {
        usedExponents.add(maxDegree);
        terms.push({c: randomCoef(), e: maxDegree});
    }
    let attempts = 0;
    while(usedExponents.size < termsCount && attempts < 100) {
        let e = Math.floor(Math.random() * (maxDegree + 1));
        if(!usedExponents.has(e)) {
            usedExponents.add(e);
            terms.push({c: randomCoef(), e: e});
        }
        attempts++;
    }
    return terms.sort((a,b) => b.e - a.e);
}

function polyToTex(poly) {
    let s = "";
    poly.forEach((t, i) => {
        if (t.c === 0) return;
        let sign = t.c > 0 ? (i === 0 ? "" : "+") : "-";
        let absC = Math.abs(t.c);
        let coefStr = (absC === 1 && t.e !== 0) ? "" : absC;
        let termStr = t.e === 0 ? "" : (t.e === 1 ? "x" : `x^{${t.e}}`);
        s += `${sign}${coefStr}${termStr}`;
    });
    return s || "0";
}

function generateSingleExercise() {
    const types = ['suma', 'mult', 'resta'];
    const type = types[exerciseStep % 3];
    exerciseStep++;
    let p1, p2;
    let lvl = gameState.currentLevel;
    if (lvl === 1) {
        if (type === 'mult') { p1 = generatePolyWithRules(1, 2, false); p2 = generatePolyWithRules(2, 2, true); } 
        else { p1 = generatePolyWithRules(2, 2, true); p2 = generatePolyWithRules(2, 2, true); }
    } else if (lvl === 2) {
        if (type === 'mult') { p1 = generatePolyWithRules(2, 3, false); p2 = generatePolyWithRules(2, 3, false); } 
        else { p1 = generatePolyWithRules(3, 3, false); p2 = generatePolyWithRules(Math.random()>0.5 ? 3 : 2, 3, false); }
    } else { 
        if (type === 'mult') { p1 = generatePolyWithRules(3, 5, false); p2 = generatePolyWithRules(2, 5, false); } 
        else { p1 = generatePolyWithRules(4, 5, true); p2 = generatePolyWithRules(4, 5, false); }
    }
    if (type === 'suma' || type === 'resta') {
        const sign = type === 'suma' ? 1 : -1;
        const resMap = {};
        p1.concat(p2.map(t => ({c: t.c * sign, e: t.e}))).forEach(t => resMap[t.e] = (resMap[t.e] || 0) + t.c);
        const resPoly = Object.keys(resMap).map(e => ({c: resMap[e], e: parseInt(e)})).filter(t => t.c !== 0).sort((a,b) => b.e - a.e);
        return { q: `(${polyToTex(p1)}) ${type === 'suma' ? '+' : '-'} (${polyToTex(p2)})`, a: polyToTex(resPoly) };
    } else {
        const resMap = {};
        p1.forEach(t1 => p2.forEach(t2 => { let e = t1.e + t2.e; resMap[e] = (resMap[e] || 0) + (t1.c * t2.c); }));
        const resPoly = Object.keys(resMap).map(e => ({c: resMap[e], e: parseInt(e)})).filter(t => t.c !== 0).sort((a,b) => b.e - a.e);
        return { q: `(${polyToTex(p1)}) \\cdot (${polyToTex(p2)})`, a: polyToTex(resPoly) };
    }
}

let gameState = { 
    userString: "", cursorPos: 0, playerHP: 100, monsterHP: 100, 
    isGameOver: false, cursorVisible: true, isBlocked: false, 
    playerName: "EQUIPO", selectedAvatarImg: "jenna8bits.png",
    currentLevel: 1, score: 0, timeLeft: TIME_LIMIT, mistakes: []
};

function selectAvatar(img, el) {
    gameState.selectedAvatarImg = img;
    document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    playSound('click');
}

function startGame() {
    initAudio();
    gameState.playerName = document.getElementById('player-name-input').value.trim() || "EQUIPO";
    document.getElementById('display-name').innerText = gameState.playerName.toUpperCase();
    document.getElementById('player-avatar-display').src = gameState.selectedAvatarImg;
    document.getElementById('screen-start').style.display = 'none';
    document.getElementById('screen-game').style.display = 'flex';
    updateUI();
    playSound('spell');
    nextExercise(); 
}

function restartApp() {
    clearInterval(timerInterval);
    levelUpAudio.pause();
    levelUpAudio.currentTime = 0;
    gameState = { 
        userString: "", cursorPos: 0, playerHP: 100, monsterHP: 100, 
        isGameOver: false, cursorVisible: true, isBlocked: false, 
        playerName: "EQUIPO", selectedAvatarImg: "jenna8bits.png",
        currentLevel: 1, score: 0, timeLeft: TIME_LIMIT, mistakes: []
    };
    document.getElementById('screen-end').style.display = 'none';
    document.getElementById('screen-game').style.display = 'none';
    document.getElementById('screen-start').style.display = 'flex';
    document.getElementById('player-name-input').value = "";
    document.getElementById('exercise-display').innerHTML = "";
    document.getElementById('user-input-display').innerHTML = "";
    updateUI();
}

function nextExercise() {
    if (gameState.isGameOver) return;
    currentExercise = generateSingleExercise();
    gameState.userString = "";
    gameState.cursorPos = 0;
    document.getElementById('user-input-display').classList.remove('error-text');
    updateMessage(`¡TU TURNO! (NIVEL ${gameState.currentLevel})`);
    renderMathDirectly('exercise-display', `${currentExercise.q} =`);
    renderUserAnswer();
    startTimer();
}

function renderUserAnswer() {
    if (gameState.isBlocked) return;
    let before = gameState.userString.slice(0, gameState.cursorPos);
    let after = gameState.userString.slice(gameState.cursorPos);
    let cursor = gameState.cursorVisible ? '|' : '\\phantom{|}';
    let t = before + cursor + after;
    const o = (t.match(/\{/g) || []).length;
    const c = (t.match(/\}/g) || []).length;
    for(let i=0; i < (o-c); i++) t += "}";
    renderMathDirectly('user-input-display', t);
}

function parseToMap(str) {
    let map = {};
    let s = str.replace(/[\{\}\s]/g, "").replace(/(\+|-)x/g, "$11x").replace(/^x/g, "1x").replace(/-/g, "+-");
    if (s.startsWith("+")) s = s.substring(1);
    let terms = s.split("+").filter(t => t !== "");
    for (let t of terms) {
        let coef = 1, exp = 0;
        if (t.includes("x")) {
            let parts = t.split("x");
            coef = parts[0] === "" ? 1 : (parts[0] === "-" ? -1 : parseInt(parts[0]));
            if (parts[1]) exp = parseInt(parts[1].replace("^", ""));
            else exp = 1;
        } else { coef = parseInt(t); }
        map[exp] = (map[exp] || 0) + coef;
    }
    return map;
}

function isMathEquivalent(uStr, cStr) {
    try {
        let uMap = parseToMap(uStr);
        let cMap = parseToMap(cStr);
        let allExps = new Set([...Object.keys(uMap), ...Object.keys(cMap)]);
        for (let e of allExps) {
            if ((uMap[e] || 0) !== (cMap[e] || 0)) return false;
        }
        return true;
    } catch(e) { return false; }
}

function checkAnswer() {
    if (gameState.isGameOver || gameState.isBlocked || gameState.userString === "") return;
    
    let uNormal = gameState.userString.replace(/[\{\}\s]/g, "");
    let cNormal = currentExercise.a.replace(/[\{\}\s]/g, "");
    
    if (uNormal === cNormal) { 
        processHit(); 
    } 
    else {
        if (isMathEquivalent(gameState.userString, currentExercise.a)) {
            // MENSAJE ACTUALIZADO SEGÚN TU PEDIDO
            updateMessage("No te olvides de operar con los términos semejantes y ordenarlos de mayor a menor");
            playSound('click');
        } else {
            processMiss();
        }
    }
}

function processHit() {
    gameState.isBlocked = true; clearInterval(timerInterval);
    playSound('spell'); 
    gameState.score += 100 + gameState.timeLeft;
    gameState.monsterHP -= 25; 
    updateUI();
    updateMessage("¡ACIERTO!");
    setTimeout(() => { 
        if (gameState.monsterHP <= 0) {
            gameState.score += 500; 
            if (gameState.currentLevel < 3) {
                gameState.currentLevel++;
                gameState.monsterHP = 100;
                updateUI();
                updateMessage(`¡NIVEL ${gameState.currentLevel} DESBLOQUEADO!`);
                levelUpAudio.currentTime = 0; 
                levelUpAudio.play().catch(e => console.log(e));
                setTimeout(() => { gameState.isBlocked = false; nextExercise(); }, 2500);
            } else { endGame(true); }
        } else { gameState.isBlocked = false; nextExercise(); }
    }, 1200);
}

function processMiss() {
    gameState.isBlocked = true; clearInterval(timerInterval);
    playSound('hit'); gameState.playerHP -= 20; updateUI();
    updateMessage("ERROR");
    gameState.mistakes.push({ q: currentExercise.q, user: gameState.userString === "" ? "Vacío" : gameState.userString, correct: currentExercise.a });
    const d = document.getElementById('user-input-display');
    d.classList.add('error-text'); 
    renderMathDirectly('user-input-display', `\\text{Solución: } ${currentExercise.a}`);
    animateDamage('app-container');
    setTimeout(() => { gameState.isBlocked = false; if (gameState.playerHP <= 0) endGame(false); else nextExercise(); }, 4000);
}

function handleInput(k) {
    if (gameState.isGameOver || gameState.isBlocked) return;
    playSound('click');
    let before = gameState.userString.slice(0, gameState.cursorPos);
    let after = gameState.userString.slice(gameState.cursorPos);
    const inExp = before.lastIndexOf('^{') > before.lastIndexOf('}');
    let insertStr = k;
    if (k === '^') insertStr = "^{";
    else if (k === '²') insertStr = "^{2}";
    else if (k === '³') insertStr = "^{3}";
    else if (k === '⁴') insertStr = "^{4}";
    if (inExp && "0123456789".includes(k)) { insertStr = k + "}"; } 
    else if (inExp && (k === '+' || k === '-' || k === 'x' || k === '(' || k === ')')) { insertStr = "}" + k; }
    gameState.userString = before + insertStr + after;
    gameState.cursorPos += insertStr.length;
    renderUserAnswer();
}

function backspace() {
    if (gameState.isGameOver || gameState.isBlocked || gameState.cursorPos === 0) return;
    playSound('click');
    let before = gameState.userString.slice(0, gameState.cursorPos);
    let after = gameState.userString.slice(gameState.cursorPos);
    let delLength = 1;
    if (before.endsWith("^{2}") || before.endsWith("^{3}") || before.endsWith("^{4}")) delLength = 4;
    else if (before.endsWith("^{")) delLength = 2;
    else if (before.endsWith("}")) delLength = 1; 
    gameState.userString = before.slice(0, -delLength) + after;
    gameState.cursorPos -= delLength;
    renderUserAnswer();
}

function moveCursor(dir) {
    if (gameState.isGameOver || gameState.isBlocked) return;
    let before = gameState.userString.slice(0, gameState.cursorPos);
    let after = gameState.userString.slice(gameState.cursorPos);
    const inExp = before.lastIndexOf('^{') > before.lastIndexOf('}');
    if (dir === 'left' && gameState.cursorPos > 0) {
        if (before.endsWith("^{2}") || before.endsWith("^{3}") || before.endsWith("^{4}")) gameState.cursorPos -= 4;
        else if (before.endsWith("^{")) gameState.cursorPos -= 2;
        else if (before.endsWith("}")) gameState.cursorPos -= 1;
        else gameState.cursorPos--;
        playSound('click');
    }
    if (dir === 'right') {
        if (gameState.cursorPos < gameState.userString.length) {
            if (after.startsWith("^{2}") || after.startsWith("^{3}") || after.startsWith("^{4}")) gameState.cursorPos += 4;
            else if (after.startsWith("^{")) gameState.cursorPos += 2;
            else if (after.startsWith("}")) gameState.cursorPos += 1;
            else gameState.cursorPos++;
            playSound('click');
        } else if (inExp) { gameState.userString += "}"; gameState.cursorPos++; playSound('click'); }
    }
    renderUserAnswer();
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    gameState.timeLeft = TIME_LIMIT;
    updateTimerDisplay(gameState.timeLeft);
    timerInterval = setInterval(() => {
        if (!gameState.isBlocked && !gameState.isGameOver) {
            gameState.timeLeft--; updateTimerDisplay(gameState.timeLeft);
            if (gameState.timeLeft <= 0) { clearInterval(timerInterval); handleTimeout(); }
        }
    }, 1000);
}

function updateTimerDisplay(s) {
    const el = document.getElementById('timer-display');
    if (el) { el.innerText = `TIEMPO: ${s}s`; if (s <= 30) el.classList.add('low-time'); else el.classList.remove('low-time'); }
}

function handleTimeout() {
    if (gameState.isGameOver) return;
    gameState.isBlocked = true; playSound('hit'); gameState.playerHP -= 20; updateUI();
    updateMessage("¡TIEMPO AGOTADO!"); animateDamage('app-container');
    setTimeout(() => { gameState.isBlocked = false; if (gameState.playerHP <= 0) endGame(false); else nextExercise(); }, 1500);
}

function updateUI() {
    document.getElementById('player-hp').style.width = Math.max(0, gameState.playerHP) + "%";
    const monsterBar = document.getElementById('monster-hp');
    monsterBar.style.width = Math.max(0, gameState.monsterHP) + "%";
    const enemyName = document.getElementById('enemy-name-display');
    if (gameState.currentLevel === 1) { monsterBar.style.backgroundColor = '#2ecc71'; if (enemyName) enemyName.innerText = `BOSS NIVEL 1`; }
    else if (gameState.currentLevel === 2) { monsterBar.style.backgroundColor = '#e67e22'; if (enemyName) enemyName.innerText = `BOSS NIVEL 2`; }
    else if (gameState.currentLevel === 3) { monsterBar.style.backgroundColor = '#9b59b6'; if (enemyName) enemyName.innerText = `BOSS FINAL SUPER PRO`; }
}

function updateMessage(t) { document.getElementById('battle-message').innerText = t; }
function animateDamage(id) { const el = document.getElementById(id); if(el) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 300); } }

function endGame(win) {
    gameState.isGameOver = true; clearInterval(timerInterval);
    levelUpAudio.pause();
    document.getElementById('screen-game').style.display = 'none';
    document.getElementById('screen-end').style.display = 'flex';
    document.getElementById('end-title').innerText = win ? "¡VICTORIA ABSOLUTA!" : "DERROTA";
    document.getElementById('end-title').style.color = win ? "#2ecc71" : "#e74c3c";
    document.getElementById('end-message').innerText = win ? "HAS DERROTADO A LOS 3 JEFES." : "EL ÁLGEBRA FUE DEMASIADO PARA USTEDES.";
    document.getElementById('end-score').innerText = `TU PUNTAJE: ${gameState.score} pts`;
    document.getElementById('print-team-name').innerText = `Equipo: ${gameState.playerName} - Puntaje: ${gameState.score} pts`;
    const mistakesBoard = document.getElementById('mistakes-board');
    const mistakesList = document.getElementById('mistakes-list');
    mistakesList.innerHTML = '';
    if (gameState.mistakes.length > 0) {
        mistakesBoard.style.display = 'block';
        gameState.mistakes.forEach((err) => {
            const li = document.createElement('li');
            li.innerHTML = `<div class="error-item"><span>Ejercicio: \\( ${err.q} \\)</span><br><span>Tu respuesta: \\( ${err.user} \\)</span><br><span>Correcto: \\( ${err.correct} \\)</span></div>`;
            mistakesList.appendChild(li);
        });
        if (window.MathJax && window.MathJax.typesetPromise) { window.MathJax.typesetPromise([mistakesList]).catch(()=>{}); }
    } else { mistakesBoard.style.display = 'none'; }
}

function downloadPDF() { window.print(); }

document.getElementById('btn-spell').onclick = checkAnswer;
document.getElementById('btn-reset').onclick = () => { if(!gameState.isBlocked) { gameState.userString = ""; gameState.cursorPos = 0; renderUserAnswer(); } };

document.addEventListener('keydown', (e) => {
    if (document.getElementById('screen-start').style.display === 'flex') { if (e.key === "Enter") startGame(); return; }
    if (!gameState.isGameOver && !gameState.isBlocked) {
        let key = e.key;
        if (key === '*') key = 'x'; 
        if ("0123456789+-x^".includes(key)) handleInput(key);
        else if (key === "Backspace") { e.preventDefault(); backspace(); }
        else if (key === "Enter") checkAnswer();
        else if (key === "ArrowLeft") { e.preventDefault(); moveCursor('left'); }
        else if (key === "ArrowRight") { e.preventDefault(); moveCursor('right'); }
    }
});

function initKeyboard() {
    const keys = ['7','8','9','+','x','<','4','5','6','-','^','>','1','2','3','²','³','⁴','0','⌫'];
    const container = document.getElementById('keyboard');
    if(!container) return;
    container.innerHTML = '';
    keys.forEach(k => {
        const b = document.createElement('button');
        b.innerText = k === '⌫' ? 'BORRAR' : k; 
        b.className = 'key';
        if (k === '⌫') b.classList.add('key-backspace');
        else if (k === '0') b.classList.add('key-zero');
        else if (isNaN(k) && k !== '0') b.classList.add('key-op');
        if (['²','³','⁴'].includes(k)) b.classList.add('key-exp');
        b.onmousedown = (ev) => { 
            ev.preventDefault(); 
            if (k === '⌫') backspace(); 
            else if (k === '<') moveCursor('left');
            else if (k === '>') moveCursor('right');
            else handleInput(k); 
        };
        container.appendChild(b);
    });
}

setInterval(() => { gameState.cursorVisible = !gameState.cursorVisible; renderUserAnswer(); }, 500);
document.addEventListener("DOMContentLoaded", initKeyboard);
