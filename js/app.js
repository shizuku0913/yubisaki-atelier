(function(){
  "use strict";

  // ---- sound effects ----
  let audioCtx = null;
  function ensureAudio(){
    if(!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      audioCtx = new AC();
    }
    if(audioCtx.state==='suspended') audioCtx.resume();
    return audioCtx;
  }

  // Cute child-like spoken sound effects via the Web Speech API.
  // Falls back to a synthesized tone if speech synthesis isn't available.
  let cachedJaVoice = null;
  function pickJaVoice(){
    if(!window.speechSynthesis) return null;
    if(cachedJaVoice) return cachedJaVoice;
    const voices = window.speechSynthesis.getVoices().filter(v=> v.lang && v.lang.toLowerCase().startsWith('ja'));
    if(voices.length===0) return null;
    const preferred = ['kyoko','女性','female','girl','child','o-ren'];
    const avoid = ['otoya','male','man','boy'];
    let best = voices.find(v=>{
      const n = v.name.toLowerCase();
      return preferred.some(p=>n.includes(p)) && !avoid.some(a=>n.includes(a));
    });
    if(!best) best = voices.find(v=> !avoid.some(a=> v.name.toLowerCase().includes(a)));
    cachedJaVoice = best || voices[0];
    return cachedJaVoice;
  }
  if(window.speechSynthesis){
    window.speechSynthesis.onvoiceschanged = ()=>{ cachedJaVoice = null; pickJaVoice(); };
  }
  function speakCute(text, rate){
    if(!window.speechSynthesis) return false;
    try{
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.pitch = 2;
      u.rate = rate || 1.15;
      u.volume = 1;
      const v = pickJaVoice();
      if(v) u.voice = v;
      window.speechSynthesis.speak(u);
      return true;
    }catch(e){ return false; }
  }

  function playDispenseFallback(){
    const ac = ensureAudio(); if(!ac) return;
    const t = ac.currentTime;
    // soft, gentle "puni-yon-yon" wobble
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    osc.type = 'sine';
    const base = 330;
    const bounces = [1.4, 0.78, 1.22, 0.88, 1.06, 0.98];
    const dur = 0.055;
    let time = t;
    osc.frequency.setValueAtTime(base, t);
    bounces.forEach(mult=>{
      osc.frequency.linearRampToValueAtTime(base*mult, time+dur);
      time += dur;
    });
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.15, t+0.045);
    gain.gain.exponentialRampToValueAtTime(0.001, time+0.09);
    osc.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    osc.start(t); osc.stop(time+0.1);
    // soft rounded tail (sine, not triangle, for a gentler sparkle)
    const o2 = ac.createOscillator();
    const g2 = ac.createGain();
    o2.type = 'sine';
    o2.frequency.value = 1300;
    const start = time - 0.03;
    g2.gain.setValueAtTime(0.0001, start);
    g2.gain.linearRampToValueAtTime(0.055, start+0.015);
    g2.gain.exponentialRampToValueAtTime(0.0001, start+0.15);
    o2.connect(g2); g2.connect(ac.destination);
    o2.start(start); o2.stop(start+0.17);
  }
  function playDispenseSound(){
    playDispenseFallback();
    speakCute('ぷにょーん', 1.3);
  }

  let lastMixSoundTime = 0;
  function playMixFallback(){
    const ac = ensureAudio(); if(!ac) return;
    const t = ac.currentTime;
    // slow, gooey "gunyo gunyo" wobble
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    const base = 210;
    const wobble = [1.35, 0.7, 1.2, 0.78, 1.05];
    const dur = 0.075;
    let time = t;
    osc.frequency.setValueAtTime(base, t);
    wobble.forEach(mult=>{
      osc.frequency.linearRampToValueAtTime(base*mult, time+dur);
      time += dur;
    });
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.16, t+0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time+0.06);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(t); osc.stop(time+0.08);

    // soft low squish texture underneath
    const bufSize = Math.floor(ac.sampleRate*0.13);
    const buffer = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufSize;i++){ data[i] = (Math.random()*2-1) * (1 - i/bufSize); }
    const noise = ac.createBufferSource();
    noise.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    const ngain = ac.createGain();
    ngain.gain.setValueAtTime(0.06, t);
    ngain.gain.exponentialRampToValueAtTime(0.001, t+0.13);
    noise.connect(filter); filter.connect(ngain); ngain.connect(ac.destination);
    noise.start(t);
  }
  function playMixSound(){
    const now = performance.now()/1000;
    if(now - lastMixSoundTime < 0.28) return;
    lastMixSoundTime = now;
    playMixFallback();
    speakCute('ぐにょぐにょー', 1.25);
  }

  function playMixCompleteSound(){
    const ac = ensureAudio(); if(!ac) return;
    const t = ac.currentTime;
    [1046, 1568].forEach((freq,i)=>{
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t + i*0.075;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.2, start+0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start+0.22);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(start); osc.stop(start+0.24);
    });
  }

  function playDiscoveryFanfare(){
    const ac = ensureAudio(); if(!ac) return;
    const t = ac.currentTime;
    // rising "ta-da!" arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq,i)=>{
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = t + i*0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.22, start+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start+0.5);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(start); osc.stop(start+0.55);
    });
    // sparkle shimmer on top
    const shimmerStart = t + notes.length*0.09;
    for(let i=0;i<10;i++){
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1800 + Math.random()*1400;
      const start = shimmerStart + Math.random()*0.35;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.08+Math.random()*0.05, start+0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start+0.28);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(start); osc.stop(start+0.3);
    }
    // warm final chord
    const chordStart = shimmerStart + 0.1;
    [523.25, 659.25, 783.99].forEach(freq=>{
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, chordStart);
      gain.gain.linearRampToValueAtTime(0.14, chordStart+0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, chordStart+0.7);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(chordStart); osc.stop(chordStart+0.75);
    });
  }

  function playRecreatedChime(){
    const ac = ensureAudio(); if(!ac) return;
    const t = ac.currentTime;
    // a quick, happy "did it again!" two-note bounce with a sparkle
    [880, 1174.7].forEach((freq,i)=>{
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = t + i*0.1;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.2, start+0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start+0.28);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(start); osc.stop(start+0.3);
    });
    const shimmerStart = t + 0.22;
    for(let i=0;i<5;i++){
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1900 + Math.random()*1000;
      const start = shimmerStart + Math.random()*0.2;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.07, start+0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start+0.2);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(start); osc.stop(start+0.22);
    }
  }

  const COLORS = [
    {name:"あか",   c:"#ff2f1f"},
    {name:"だいだい", c:"#ff8c1e"},
    {name:"きいろ", c:"#ffd622"},
    {name:"みどり", c:"#1fb141"},
    {name:"あお",   c:"#1a80ff"},
    {name:"むらさき", c:"#9d2fd6"},
    {name:"ピンク", c:"#ff3d8f"},
    {name:"しろ",   c:"#fbfaf5"},
    {name:"くろ",   c:"#241b16"}
  ];
  const WATER = {name:"みず", c:"#bfe8fb", isWater:true};
  const TUBE_ITEMS = COLORS.concat([WATER]);

  const DISH_THEMES = [
    {pc1:"#ff9fb8", pc2:"#ffe3ea", pc3:"#ffc9d6", star:"⭐"},
    {pc1:"#8fe0d0", pc2:"#e3fff9", pc3:"#c3f5e9", star:"✨"},
    {pc1:"#9fc7ff", pc2:"#e6f2ff", pc3:"#c7e0ff", star:"🌟"},
    {pc1:"#ffd27a", pc2:"#fff3da", pc3:"#ffe3ad", star:"🌸"},
    {pc1:"#c9a8ff", pc2:"#f1e6ff", pc3:"#ddc4ff", star:"🍬"}
  ];
  const DISH_COUNT = 5;

  // ---- color discovery / encyclopedia ----
  const COMBO_TABLE = {
    'あか,だいだい': {name:'しゅいろ', emoji:'🔶'},
    'あか,きいろ': {name:'オレンジ', emoji:'🟠'},
    'あか,みどり': {name:'ちゃいろ', emoji:'🟫'},
    'あお,あか': {name:'むらさき', emoji:'🟣'},
    'あか,むらさき': {name:'ワインいろ', emoji:'🍷'},
    'あか,ピンク': {name:'ローズいろ', emoji:'🌹'},
    'あか,しろ': {name:'ピンク', emoji:'🌸'},
    'あか,くろ': {name:'えんじいろ', emoji:'🟤'},
    'きいろ,だいだい': {name:'こがねいろ', emoji:'🌟'},
    'だいだい,みどり': {name:'オリーブいろ', emoji:'🫒'},
    'あお,だいだい': {name:'つちいろ', emoji:'🪵'},
    'だいだい,むらさき': {name:'レンガいろ', emoji:'🧱'},
    'だいだい,ピンク': {name:'ももいろ', emoji:'🍑'},
    'しろ,だいだい': {name:'アプリコットいろ', emoji:'🍊'},
    'くろ,だいだい': {name:'キャラメルいろ', emoji:'🍮'},
    'きいろ,みどり': {name:'きみどり', emoji:'🍏'},
    'あお,きいろ': {name:'みどり', emoji:'🟢'},
    'きいろ,むらさき': {name:'からしいろ', emoji:'🌭'},
    'きいろ,ピンク': {name:'コーラルいろ', emoji:'🪸'},
    'きいろ,しろ': {name:'クリームいろ', emoji:'🍦'},
    'きいろ,くろ': {name:'マスタードいろ', emoji:'🌾'},
    'あお,みどり': {name:'せいじいろ', emoji:'🌊'},
    'みどり,むらさき': {name:'すみれちゃ', emoji:'🍂'},
    'みどり,ピンク': {name:'モスピンク', emoji:'🌺'},
    'しろ,みどり': {name:'わかくさいろ', emoji:'🌱'},
    'くろ,みどり': {name:'しんりんいろ', emoji:'🌲'},
    'あお,むらさき': {name:'あいいろ', emoji:'🔷'},
    'あお,ピンク': {name:'ラベンダーいろ', emoji:'💐'},
    'あお,しろ': {name:'みずいろ', emoji:'💙'},
    'あお,くろ': {name:'こんいろ', emoji:'🔵'},
    'むらさき,ピンク': {name:'ぼたんいろ', emoji:'🌺'},
    'しろ,むらさき': {name:'ふじいろ', emoji:'💜'},
    'くろ,むらさき': {name:'なすいろ', emoji:'🍆'},
    'しろ,ピンク': {name:'さくらいろ', emoji:'🌸'},
    'くろ,ピンク': {name:'モーブいろ', emoji:'💋'},
    'くろ,しろ': {name:'はいいろ', emoji:'⬜'}
  };

  // Ratio-aware variants: the SAME two colors mixed in different amounts
  // make different named colors, not just one fixed result - e.g. mostly
  // red with a little blue reads as a reddish purple, not plain purple.
  // These are generated from the balanced-mix table above using the real
  // Japanese color-naming pattern "<tint>みの<base>" (e.g. あかみのむらさき
  // = "purple with a reddish cast"), so every pair gets three discoverable
  // results (balanced, and tinted toward each side) without hand-writing
  // over a hundred names individually.
  const RATIO_COMBO_TABLE = {};
  Object.entries(COMBO_TABLE).forEach(([key, base])=>{
    const [n1, n2] = key.split(',');
    RATIO_COMBO_TABLE[key+',balanced'] = base;
    RATIO_COMBO_TABLE[key+','+n1] = {name: n1+'みの'+base.name, emoji: base.emoji};
    RATIO_COMBO_TABLE[key+','+n2] = {name: n2+'みの'+base.name, emoji: base.emoji};
  });

  // A curated set of three-color mixes - not every possible triple (84 of
  // them), just a wide, varied set with real named results rather than the
  // generic subtractive-mix output.
  const TRIPLE_COMBO_TABLE = {
    'あか,きいろ,しろ': {name:'サーモンピンク', emoji:'🐟'},
    'あお,あか,しろ': {name:'ラベンダーグレー', emoji:'🌫️'},
    'あか,きいろ,くろ': {name:'セピアいろ', emoji:'📜'},
    'あお,きいろ,しろ': {name:'ミントグリーン', emoji:'🍀'},
    'あか,しろ,みどり': {name:'グレイッシュベージュ', emoji:'🏖️'},
    'あお,しろ,むらさき': {name:'ペリウィンクル', emoji:'🦋'},
    'あお,あか,くろ': {name:'すみいろ', emoji:'🖋️'},
    'あお,きいろ,くろ': {name:'カーキいろ', emoji:'🎒'},
    'あお,あか,きいろ': {name:'アースブラウン', emoji:'🌍'},
    'しろ,むらさき,ピンク': {name:'オーキッドいろ', emoji:'🌷'},
    'あお,くろ,みどり': {name:'ディープティール', emoji:'🦚'},
    'あか,しろ,ピンク': {name:'コーラルピンク', emoji:'🐚'},
    'あか,しろ,だいだい': {name:'アプリコットクリーム', emoji:'🧡'},
    'きいろ,しろ,みどり': {name:'ピスタチオいろ', emoji:'🥝'},
    'あか,しろ,むらさき': {name:'モーブグレー', emoji:'🪻'},
    'あか,くろ,みどり': {name:'オリーブブラウン', emoji:'🫘'},
    'あお,くろ,むらさき': {name:'ミッドナイトブルー', emoji:'🌌'},
    'きいろ,しろ,むらさき': {name:'アンティークゴールド', emoji:'🏺'},
    'あお,しろ,だいだい': {name:'グレイッシュテラコッタ', emoji:'🏜️'},
    'あお,あか,ピンク': {name:'マゼンタパープル', emoji:'💗'},
    'きいろ,しろ,ピンク': {name:'シャーベットいろ', emoji:'🍧'},
    'しろ,みどり,ピンク': {name:'ペールジェイド', emoji:'🪷'},
    'くろ,しろ,むらさき': {name:'スモーキーバイオレット', emoji:'🌑'},
    'あお,きいろ,むらさき': {name:'オリーブグレー', emoji:'🕊️'},
    'あか,きいろ,むらさき': {name:'スパイスブラウン', emoji:'🌰'},
    'しろ,だいだい,むらさき': {name:'ダスティピーチ', emoji:'🍑'},
    'あか,みどり,むらさき': {name:'アンバーブラウン', emoji:'🟤'},
    'あお,あか,むらさき': {name:'ロイヤルパープル', emoji:'👑'},
    'くろ,しろ,ピンク': {name:'スモーキーローズ', emoji:'🥀'},
    'あか,きいろ,だいだい': {name:'サンセットオレンジ', emoji:'🌇'},
    'あお,しろ,みどり': {name:'アクアミント', emoji:'💎'},
    'あお,みどり,むらさき': {name:'ディーププラム', emoji:'🍇'},
    'きいろ,くろ,しろ': {name:'アンティークベージュ', emoji:'🧺'},
    'きいろ,くろ,だいだい': {name:'ジンジャーブラウン', emoji:'🫚'}
  };

  // Pastel variants: mixing water into a 2-color blend gives a paler,
  // "watercolor" version with its own name, on top of the ratio-tiered
  // opaque versions above.
  const PASTEL_COMBO_TABLE = {};
  Object.entries(COMBO_TABLE).forEach(([key, base])=>{
    PASTEL_COMBO_TABLE[key] = {name:'パステル'+base.name, emoji:base.emoji};
  });

  // A few entries get swapped for real traditional Japanese color names
  // (the kind you'd find in a wafu-iro dictionary like i-iro.com) plus an
  // animal/food/plant emoji, so finding them feels extra special - e.g.
  // gray becomes 象牙色-flavoured with an elephant, sunflower yellow shows
  // a sunflower, and so on.
  const SPECIAL_DISCOVERY_OVERRIDES = {
    'くろ,しろ,balanced': {name:'はいいろ', emoji:'🐘'},
    'あお,むらさき,あお': {name:'るりいろ', emoji:'💎'},
    'あお,むらさき,むらさき': {name:'ききょういろ', emoji:'🌸'},
    'あか,だいだい,あか': {name:'べにいろ', emoji:'🌺'},
    'きいろ,しろ,きいろ': {name:'とりのこいろ', emoji:'🥚'},
    'きいろ,しろ,しろ': {name:'ぞうげいろ', emoji:'🐘'},
    'きいろ,みどり,みどり': {name:'もえぎいろ', emoji:'🌱'},
    'しろ,ピンク,ピンク': {name:'ときいろ', emoji:'🐦'},
    'あか,ピンク,balanced': {name:'つつじいろ', emoji:'🌷'},
    'きいろ,くろ,きいろ': {name:'ひまわりいろ', emoji:'🌻'},
    'あか,きいろ,balanced': {name:'オレンジ', emoji:'🐯'},
    'あか,しろ,balanced': {name:'ピンク', emoji:'🦩'},
    'あか,くろ,balanced': {name:'えんじいろ', emoji:'🐜'},
    'あか,みどり,balanced': {name:'ちゃいろ', emoji:'🐻'},
    'あお,しろ,balanced': {name:'みずいろ', emoji:'🐳'},
    'しろ,みどり,balanced': {name:'わかくさいろ', emoji:'🐸'},
    'くろ,むらさき,balanced': {name:'なすいろ', emoji:'🍆'}
  };
  Object.entries(SPECIAL_DISCOVERY_OVERRIDES).forEach(([key,val])=>{
    RATIO_COMBO_TABLE[key] = val;
  });

  // A fixed, finite list of "canonical" color codes - one exact hex per
  // named color, computed via the real mixing math at idealized ratios.
  // Discoveries are matched against this list by distance rather than
  // generating a fresh name for literally any resulting color.
  function computeCanonicalHex(ticks){
    const mixed = computeSubtractiveMix(ticks);
    if(!mixed) return '#999999';
    return rgbToHex(mixed.r, mixed.g, mixed.b);
  }
  const CANONICAL_COLORS = [];
  const seenCanonicalNames = new Set();
  function addCanonical(name, emoji, hex){
    if(!name || seenCanonicalNames.has(name)) return;
    seenCanonicalNames.add(name);
    CANONICAL_COLORS.push({name, emoji, hex});
  }
  COLORS.forEach(c=>{
    addCanonical(c.name, c.name==='しろ' ? '🐰' : (c.name==='くろ' ? '🐈\u200d⬛' : '🎨'), c.c);
  });
  Object.entries(RATIO_COMBO_TABLE).forEach(([key,val])=>{
    const parts = key.split(',');
    const n1=parts[0], n2=parts[1], tier=parts[2];
    let ticks;
    if(tier==='balanced') ticks = {[n1]:1,[n2]:1};
    else if(tier===n1) ticks = {[n1]:2.3,[n2]:1};
    else ticks = {[n1]:1,[n2]:2.3};
    addCanonical(val.name, val.emoji, computeCanonicalHex(ticks));
  });
  Object.entries(TRIPLE_COMBO_TABLE).forEach(([key,val])=>{
    const names = key.split(',');
    const ticks = {}; names.forEach(n=>{ ticks[n]=1; });
    addCanonical(val.name, val.emoji, computeCanonicalHex(ticks));
  });
  Object.entries(PASTEL_COMBO_TABLE).forEach(([key,val])=>{
    const [n1,n2] = key.split(',');
    const ticks = {[n1]:1,[n2]:1,'しろ':2.5};
    addCanonical(val.name, val.emoji, computeCanonicalHex(ticks));
  });
  [
    ['すみいろ','🖋️',0.26],['のうねずみ','🐭',0.42],
    ['ねずみいろ','🐭',0.58],['はいじろ','☁️',0.74],['ぎんねず','🥈',0.88]
  ].forEach(([name,emoji,l])=>{
    const rgb = hslToRgb(0.02,0.03,l);
    addCanonical(name, emoji, rgbToHex(rgb.r,rgb.g,rgb.b));
  });

  function colorDistance(hexA, hexB){
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2);
  }
  function findNearestCanonical(hex){
    let best=null, bestDist=Infinity;
    CANONICAL_COLORS.forEach(c=>{
      const d = colorDistance(hex, c.hex);
      if(d<bestDist){ bestDist=d; best=c; }
    });
    return {entry:best, dist:bestDist};
  }

  let discoveredColors = [];
  try{
    const saved = localStorage.getItem('yubisaki_discoveries');
    if(saved) discoveredColors = JSON.parse(saved);
  }catch(e){}
  function saveDiscoveries(){
    try{ localStorage.setItem('yubisaki_discoveries', JSON.stringify(discoveredColors)); }catch(e){}
  }

  let selectedColor = null;
  let selectedColorName = null;
  let selectedPaletteIndex = 0;
  let brushColor = null;
  let brushHasGlitter = false;
  let selectedTubeReady = false;

  function hexToRgb(hex){
    const h = hex.replace('#','');
    const v = h.length===3 ? h.split('').map(x=>x+x).join('') : h;
    const n = parseInt(v,16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function rgbToHex(r,g,b){
    const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
    return '#'+c(r)+c(g)+c(b);
  }
  function lighten(hex, amt){ const c=hexToRgb(hex); return rgbToHex(c.r+(255-c.r)*amt, c.g+(255-c.g)*amt, c.b+(255-c.b)*amt); }
  function darken(hex, amt){ const c=hexToRgb(hex); return rgbToHex(c.r*(1-amt), c.g*(1-amt), c.b*(1-amt)); }
  function dist(p1,p2){ return Math.hypot(p1.x-p2.x, p1.y-p2.y); }

  function rgbToHsl(r,g,b){
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h=0, s=0; const l=(max+min)/2;
    const d = max-min;
    if(d>0){
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case r: h = (g-b)/d + (g<b?6:0); break;
        case g: h = (b-r)/d + 2; break;
        case b: h = (r-g)/d + 4; break;
      }
      h/=6;
    }
    return {h,s,l};
  }
  function hslToRgb(h,s,l){
    if(s===0){ const v=l*255; return {r:v,g:v,b:v}; }
    const hue2rgb=(p,q,t)=>{
      if(t<0) t+=1; if(t>1) t-=1;
      if(t<1/6) return p+(q-p)*6*t;
      if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    return {
      r: hue2rgb(p,q,h+1/3)*255,
      g: hue2rgb(p,q,h)*255,
      b: hue2rgb(p,q,h-1/3)*255
    };
  }

  // Procedural naming: a guaranteed fallback so ANY resulting color - from
  // any number of pigments, in any ratio - can still be discovered, not
  // just the curated pair/triple combos above. The hue wheel is split into
  // 16 named bands, each with muted/dark/plain/pale variants, plus a
  // separate grayscale ladder for near-neutral results. Curated names
  // always take priority when they match; this only fills in the rest.
  // 24 hue names spanning the color wheel, drawn from real Japanese
  // traditional color vocabulary (confirmed via search of i-iro.com's own
  // category listings, since the site itself blocks direct fetching).
  const HUE_NAMES = ['あか','べに','しゅいろ','だいだい','こがねいろ','きいろ','わかば','もえぎ','みどり','わかくさ','せいじ','あおたけ','みずいろ','あさぎ','そらいろ','あお','るり','こんいろ','あいいろ','ふじいろ','むらさき','ぼたん','さくら','なでしこ'];
  const HUE_EMOJI  = ['🍎','🌹','🦀','🥕','🌕','🍋','🌿','🍏','🥬','🐸','🦚','🎋','💧','🌊','☁️','🐳','💎','🌌','🌌','💐','🍇','🌺','🌸','🌸'];
  // A PCCS-style tone system - i-iro.com itself organizes its ~600 colors
  // this exact way (see its "鮮やかな色・あかるい色・つよい色・こい色・
  // うすい色・やわらかい色・くすんだ色・暗い色" categories), combining a
  // saturation/lightness "tone" word with a hue name. Using the same
  // authentic vocabulary here instead of made-up modifiers.
  function getTone(s, l){
    if(l > 0.8) return 'うすい';
    if(s < 0.25){
      if(l < 0.35) return 'くらい';
      return 'くすんだ';
    }
    if(s < 0.48){
      if(l < 0.35) return 'こい';
      if(l > 0.65) return 'やわらかい';
      return '';
    }
    if(l < 0.35) return 'つよい';
    if(l > 0.65) return 'あかるい';
    return 'あざやかな';
  }
  function getProceduralColorName(r,g,b){
    const hsl = rgbToHsl(r,g,b);
    const s = hsl.s, l = hsl.l;
    if(s < 0.1){
      if(l<0.14) return {name:'くろ', emoji:'🐈\u200d⬛'};
      if(l<0.3) return {name:'すみいろ', emoji:'🖋️'};
      if(l<0.48) return {name:'のうねずみ', emoji:'🐭'};
      if(l<0.66) return {name:'ねずみいろ', emoji:'🐭'};
      if(l<0.82) return {name:'はいじろ', emoji:'☁️'};
      if(l<0.94) return {name:'ぎんねず', emoji:'🥈'};
      return {name:'しろ', emoji:'🐰'};
    }
    const segIdx = Math.floor((((hsl.h*360)+7.5)%360)/15) % 24;
    const baseName = HUE_NAMES[segIdx];
    const baseEmoji = HUE_EMOJI[segIdx];
    const tone = getTone(s,l);
    const name = tone ? tone+baseName : baseName;
    return {name, emoji: baseEmoji};
  }
  // Pre-list every procedural name so the encyclopedia can show them as
  // discoverable "?" slots even before they're found.
  const PROCEDURAL_ENTRIES = [];
  (function buildProceduralEntries(){
    const seen = new Set();
    const add = (r,g,b)=>{
      const e = getProceduralColorName(r,g,b);
      if(!seen.has(e.name)){
        seen.add(e.name);
        PROCEDURAL_ENTRIES.push({name:e.name, emoji:e.emoji, hex:rgbToHex(r,g,b)});
      }
    };
    for(let l=4; l<100; l+=5){
      add(...Object.values(hslToRgb(0.02, 0.04, l/100))); // grayscale ladder
    }
    // One explicit (s,l) target per tone, chosen to both match getTone()'s
    // classification and actually look like that tone - e.g. "うすい"
    // (pale) uses real saturation at high lightness, not near-zero
    // saturation, which would just look gray no matter the hue.
    const toneTargets = [
      {s:0.18, l:0.22}, // くらい
      {s:0.18, l:0.50}, // くすんだ
      {s:0.38, l:0.25}, // こい
      {s:0.38, l:0.50}, // (plain)
      {s:0.38, l:0.72}, // やわらかい
      {s:0.75, l:0.25}, // つよい
      {s:0.80, l:0.50}, // あざやかな
      {s:0.70, l:0.72}, // あかるい
      {s:0.50, l:0.85}  // うすい
    ];
    for(let hue=0; hue<360; hue+=15){
      toneTargets.forEach(({s,l})=>{
        add(...Object.values(hslToRgb(hue/360, s, l)));
      });
    }
  })();
  PROCEDURAL_ENTRIES.forEach(e=> addCanonical(e.name, e.emoji, e.hex));

  // A big batch of playful, made-up color names - not formal color theory,
  // just fun everyday things kids would recognize. Each one also gets a
  // "story" variant when darkened or lightened - どろあそびしたきりんいろ
  // (a giraffe that played in mud) for a darker giraffe-yellow,
  // せんたくしたきりんいろ (a freshly-washed giraffe) for a lighter one,
  // こげたたこやきいろ (burnt takoyaki) vs なまのたこやきいろ (raw takoyaki),
  // and so on - so there's always another fun discovery to make by nudging
  // the same color a little darker or lighter.
  const HUMOR_STORY = {
    food:   { dark:'こげた',       light:'なまの' },
    fruit:  { dark:'じゅくした',   light:'まだあおい' },
    animal: { dark:'どろあそびした', light:'せんたくした' },
    nature: { dark:'よふけの',     light:'あさもやの' },
    object: { dark:'つかいこんだ', light:'あたらしい' }
  };
  function addHumorGroup(list, category){
    const story = HUMOR_STORY[category];
    list.forEach(([name,emoji,hex])=>{
      addCanonical(name, emoji, hex);
      addCanonical(story.dark+name, emoji, darken(hex,0.32));
      addCanonical(story.light+name, emoji, lighten(hex,0.32));
    });
  }

  const HUMOR_FOOD = [
    ['たこやきいろ','🐙','#a9683a'],
    ['からあげいろ','🍗','#d98a2b'],
    ['たいやきいろ','🐟','#c97b2e'],
    ['ラーメンいろ','🍜','#e0a840'],
    ['カレーいろ','🍛','#c8791f'],
    ['なっとういろ','🫘','#b89a3c'],
    ['しょうゆいろ','🍶','#3b2415'],
    ['みそしるいろ','🍲','#8a5a2e'],
    ['めだまやきいろ','🍳','#ffe9a8'],
    ['ぷりんいろ','🍮','#e8b262'],
    ['わらびもちいろ','🍡','#c9a87c'],
    ['だいふくいろ','🍡','#f5f0e8'],
    ['どらやきいろ','🥞','#d9a441'],
    ['あんこいろ','🫘','#6b3226'],
    ['きなこいろ','🌾','#d4a857'],
    ['カステラいろ','🍰','#f2c14e'],
    ['ようかんいろ','🍫','#5c2a1f'],
    ['チョコレートいろ','🍫','#4a2e1a'],
    ['わたあめいろ','🍭','#f5b8d0'],
    ['アイスクリームいろ','🍦','#f5ecd0'],
    ['ソーダいろ','🥤','#3ab5e0'],
    ['ガムいろ','🍬','#f288b0'],
    ['あめいろ','🍬','#d98a1f'],
    ['クッキーいろ','🍪','#c68a4e'],
    ['マシュマロいろ','🍡','#fdf4ee'],
    ['ホットケーキいろ','🥞','#e3a94a'],
    ['グラタンいろ','🧀','#f0c95a'],
    ['たまごやきいろ','🍳','#f7c948'],
    ['おでんいろ','🍢','#c9a45a'],
    ['やきいもいろ','🍠','#a04a2e'],
    ['ちくわいろ','🐡','#f2ddb8'],
    ['こむぎいろ','🌾','#e3c07a'],
    ['おこのみやきいろ','🥞','#a8672e'],
    ['やきそばいろ','🍝','#8a5c2a'],
    ['ぎょうざいろ','🥟','#c9903a'],
    ['すしいろ','🍣','#f5f0e0'],
    ['おにぎりいろ','🍙','#f7f2e5'],
    ['みたらしだんごいろ','🍡','#c9832a'],
    ['ずんだいろ','🫛','#7ab04a'],
    ['ういろういろ','🍡','#e8d5c0'],
    ['せんべいいろ','🍘','#c9975a'],
    ['ポップコーンいろ','🍿','#f5e8b8'],
    ['ホットドッグいろ','🌭','#a8452a'],
    ['ピザいろ','🍕','#d9622a'],
    ['はちみついろ','🍯','#e8a428'],
    ['バターいろ','🧈','#f2d878'],
    ['チーズいろ','🧀','#f2c93e'],
    ['ヨーグルトいろ','🥛','#f8f4ec'],
    ['ぎゅうにゅういろ','🥛','#faf8f2'],
    ['こおりいろ','🧊','#d5eaf2']
  ];
  const HUMOR_FRUIT = [
    ['みかんいろ','🍊','#f5941f'],
    ['ぶどういろ','🍇','#6b3fa0'],
    ['なしいろ','🍐','#e8dfa0'],
    ['くりいろ','🌰','#6b3e26'],
    ['とうもろこしいろ','🌽','#f2d347'],
    ['ピーマンいろ','🫑','#4a8c3f'],
    ['トマトいろ','🍅','#e33b2e'],
    ['きゅうりいろ','🥒','#6ba33f'],
    ['にんじんいろ','🥕','#e8781f'],
    ['ブルーベリーいろ','🫐','#4a4a7a'],
    ['バナナいろ','🍌','#f5e042'],
    ['パイナップルいろ','🍍','#f2c230'],
    ['メロンいろ','🍈','#b8d98a'],
    ['さくらんぼいろ','🍒','#d1263b'],
    ['キウイいろ','🥝','#8bb33f'],
    ['アボカドいろ','🥑','#7a9a4a'],
    ['なつめやしいろ','🌴','#7a3e1a'],
    ['すいかいろ','🍉','#ef4d5e'],
    ['れもんいろ','🍋','#fbe54a'],
    ['いちごいろ','🍓','#e8384a'],
    ['すもものいろ','🍑','#c9538a'],
    ['グレープフルーツいろ','🍊','#f2836a'],
    ['れんこんいろ','🥗','#ede0c8'],
    ['じゃがいもいろ','🥔','#c9a468'],
    ['たまねぎいろ','🧅','#e8dce0'],
    ['だいこんいろ','🥬','#f5f2e8'],
    ['ほうれんそういろ','🥬','#2f6b2a'],
    ['なのはないろ','🌼','#f2d020'],
    ['まめいろ','🫛','#8fb054'],
    ['さつまいもいろ','🍠','#8a3a2a'],
    ['かぼちゃいろ','🎃','#e07a1f']
  ];
  const HUMOR_ANIMAL = [
    ['きりんいろ','🦒','#e8b84a'],
    ['らいおんいろ','🦁','#d4a044'],
    ['ぺんぎんいろ','🐧','#2a2a30'],
    ['ふくろういろ','🦉','#8a6b4a'],
    ['かばいろ','🦛','#8a7a8a'],
    ['きつねいろ','🦊','#c9642e'],
    ['うさぎいろ','🐰','#f5f0ea'],
    ['ひよこいろ','🐤','#f5d93f'],
    ['かえるいろ','🐸','#5a9e4a'],
    ['てんとうむしいろ','🐞','#e0342e'],
    ['みつばちいろ','🐝','#f2c022'],
    ['ふらみんごいろ','🦩','#f2708c'],
    ['くじゃくいろ','🦚','#1f8a8a'],
    ['いるかいろ','🐬','#6a8a9a'],
    ['さめいろ','🦈','#6a7480'],
    ['かたつむりいろ','🐌','#8a6a4a'],
    ['ぞうさんいろ','🐘','#9a9a95'],
    ['ひつじいろ','🐑','#eee8de'],
    ['くまいろ','🐻','#7a5232'],
    ['とらいろ','🐯','#e8821f'],
    ['しかいろ','🦌','#9a6a3e'],
    ['りすいろ','🐿️','#b0703a'],
    ['かめいろ','🐢','#5a7a4a'],
    ['かにいろ','🦀','#d8402a'],
    ['たこいろ','🐙','#c94a8a'],
    ['はむすたーいろ','🐹','#d9a66b'],
    ['ぱんだいろ','🐼','#e8e6e0'],
    ['こあらいろ','🐨','#a8a9a3'],
    ['きんぎょいろ','🐠','#ff5a3c'],
    ['たぬきいろ','🦝','#7a5c3e'],
    ['あひるいろ','🦆','#f2c830'],
    ['こうもりいろ','🦇','#2a2530'],
    ['はりねずみいろ','🦔','#8a6a4e'],
    ['おうむいろ','🦜','#4aa848'],
    ['らくだいろ','🐫','#c9a05a'],
    ['かんがるーいろ','🦘','#a87a4a'],
    ['いんこいろ','🦜','#5ab088'],
    ['やもりいろ','🦎','#7a9a6a'],
    ['くらげいろ','🎐','#d8ecf2'],
    ['もぐらいろ','🐾','#5a4a42'],
    ['あざらしいろ','🦭','#8a8880'],
    ['こねこいろ','🐱','#e0a868'],
    ['こいぬいろ','🐶','#c9985a'],
    ['にわとりいろ','🐔','#f0d848'],
    ['やぎいろ','🐐','#e8e2d0'],
    ['うしいろ','🐄','#3a342e'],
    ['うまいろ','🐴','#6a4028'],
    ['ぶたいろ','🐷','#f5b8b0']
  ];
  const HUMOR_NATURE = [
    ['ゆうやけいろ','🌇','#f2601f'],
    ['あさやけいろ','🌅','#f5a05c'],
    ['あまぞらいろ','🌧️','#8a9aa8'],
    ['はれのそらいろ','☀️','#4aa8e8'],
    ['よぞらいろ','🌌','#1a2440'],
    ['あさぎりいろ','🌫️','#dde4e0'],
    ['ほしぞらいろ','✨','#1c2a52'],
    ['こもれびいろ','🌳','#d9e0a0'],
    ['しんりょくいろ','🌿','#4fa83a'],
    ['こうよういろ','🍁','#d9622a'],
    ['なみのいろ','🌊','#2a8a9a'],
    ['まぐまいろ','🌋','#d92a1a'],
    ['きりのいろ','🌁','#c9d2d5'],
    ['つゆぞらいろ','☔','#9aa8ad'],
    ['あさひいろ','🌄','#ffcf6b'],
    ['たそがれいろ','🌆','#8a5a7a'],
    ['おひさまいろ','☀️','#ffd23f'],
    ['つきよいろ','🌙','#2c3b5e'],
    ['もりのいろ','🌲','#2f6b3a'],
    ['つゆのしずくいろ','💧','#dcecf0'],
    ['さんごしょういろ','🪸','#f2826a'],
    ['どうくついろ','🕳️','#4a4238'],
    ['かざんばいいろ','🌋','#5a5450'],
    ['おおぞらいろ','🌤️','#4a9ce0'],
    ['しんかいのいろ','🌊','#0f2440'],
    ['さばくのいろ','🏜️','#d9b878'],
    ['ひょうがいろ','🧊','#c8e4ee'],
    ['たきのいろ','💦','#bde0ea'],
    ['どうくつのいずみいろ','🫧','#7ec4d6'],
    ['やまのいろ','⛰️','#7a8a6a'],
    ['たいようのいろ','🔆','#ffb020']
  ];
  const HUMOR_OBJECT = [
    ['らんどせるいろ','🎒','#c9282e'],
    ['こくばんいろ','🖍️','#1f4a2e'],
    ['ふうせんいろ','🎈','#f2405c'],
    ['しゃぼんだまいろ','🫧','#cfe8f0'],
    ['はなびいろ','🎆','#f2c020'],
    ['おばけいろ','👻','#eef0f2'],
    ['みずたまりいろ','💧','#7a8a95'],
    ['どろんこいろ','🟤','#5a4530'],
    ['きゅうしょくいろ','🍱','#e8b25a'],
    ['プールいろ','🏊','#3ec4e0'],
    ['はなびらいろ','🌸','#f7c9d8'],
    ['てるてるぼうずいろ','👻','#fdfcf6'],
    ['おりがみいろ','📄','#f28ba0'],
    ['くつしたいろ','🧦','#e0574a'],
    ['ランドリーいろ','🧺','#c7d8e0'],
    ['たいようのたまごいろ','🥚','#ffdd6b'],
    ['ゆきだるまいろ','⛄','#f5f8fb'],
    ['ほっぺいろ','😊','#ffb3ba'],
    ['ぞうきんいろ','🧽','#9c9488'],
    ['ふとんいろ','🛏️','#cfe0e8'],
    ['にじいろ','🌈','#ff9ecb'],
    ['くれよんいろ','🖍️','#e85a3a'],
    ['けしごむいろ','🧼','#f0c4cc'],
    ['じてんしゃいろ','🚲','#d9282e'],
    ['さっかーぼーるいろ','⚽','#f0f0ee'],
    ['おりがみつるいろ','🕊️','#f5a8c0'],
    ['くつのいろ','👟','#8a5a38'],
    ['かさいろ','☂️','#f2c020'],
    ['ぼうしいろ','👒','#d9b878'],
    ['てんといろ','⛺','#4a7a4a'],
    ['キャンプファイヤーいろ','🔥','#f2621f'],
    ['ふでばこいろ','✏️','#3a6ea8'],
    ['らんどせるのなかみいろ','📚','#e0d0b8'],
    ['じょうろいろ','🪴','#5a9a6a'],
    ['すなばいろ','🏖️','#e8d4a0'],
    ['ぶらんこいろ','🎪','#c9682e'],
    ['じゃんぐるじむいろ','🧗','#7a8a3a']
  ];
  addHumorGroup(HUMOR_FOOD, 'food');
  addHumorGroup(HUMOR_FRUIT, 'fruit');
  addHumorGroup(HUMOR_ANIMAL, 'animal');
  addHumorGroup(HUMOR_NATURE, 'nature');
  addHumorGroup(HUMOR_OBJECT, 'object');

  // A few bespoke drink/powder-themed variants where "burnt/raw" doesn't
  // quite fit as well as "added milk" or "brewed strong" - matches the
  // まっちゃ example directly.
  const HUMOR_DRINK_OVERRIDES = [
    ['まっちゃいろ','🍵','#7a9b3e', 'ちょこをいれた', 'ミルクをいれた'],
    ['ラーメンいろ','🍜','#e0a840', 'あじがこゆい', 'スープをうすめた'],
    ['みそしるいろ','🍲','#8a5a2e', 'あじがこゆい', 'おゆをたした'],
    ['カレーいろ','🍛','#c8791f', 'いちやねかせた', 'クリームをいれた'],
    ['ソーダいろ','🥤','#3ab5e0', 'こおりがとけた', 'かきごおりにした']
  ];
  HUMOR_DRINK_OVERRIDES.forEach(([name,emoji,hex,darkStory,lightStory])=>{
    addCanonical(name, emoji, hex);
    addCanonical(darkStory+name, emoji, darken(hex,0.3));
    addCanonical(lightStory+name, emoji, lighten(hex,0.3));
  });

  // Plain RGB averaging tends to look muddy (e.g. red+blue -> near-gray),
  // because opposite hues cancel out in linear RGB space.
  // IMPORTANT: when the channels are nearly equal (mixing toward white/black/
  // gray), there is no meaningful hue to preserve - rgbToHsl would either
  // return hue 0 (red) or a noisy near-random hue from dividing by a tiny
  // number, and forcing saturation up in that case injects a fake color tint
  // that has nothing to do with the paints mixed. So: only vivify colors that
  // actually have a real hue signal; leave true neutrals alone.
  // ALSO IMPORTANT: mixing in white should make a color paler, and mixing in
  // black should make it darker - lightness is left alone. And critically:
  // only colors that are ALREADY quite desaturated (the muddy-gray-from-
  // hue-cancellation case) get lifted. A red+black mix keeps a naturally
  // fairly high saturation from averaging alone (black doesn't cancel red's
  // hue, it just darkens it) - boosting that further made shades look
  // artificially vivid instead of properly dark. So colors that are already
  // reasonably colorful are left completely untouched.
  function boostSaturation(r,g,b, targetSat){
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    if(max - min < 14){
      return {r, g, b};
    }
    const hsl = rgbToHsl(r,g,b);
    if(hsl.s >= targetSat){
      return {r, g, b};
    }
    const taper = Math.max(0, 1 - Math.abs(hsl.l - 0.5) / 0.42);
    const newSat = hsl.s + (targetSat - hsl.s) * taper;
    const rgb = hslToRgb(hsl.h, newSat, hsl.l);
    return rgb;
  }

  function showToast(){
    // instruction toasts removed per request
  }

  // ---- screen toggle (one button, shows where tapping will take you) ----
  const screens = { screenMix: document.getElementById('screenMix'), screenDraw: document.getElementById('screenDraw') };
  const toprowEl = document.querySelector('.toprow');
  const modeToggleBtn = document.getElementById('modeToggleBtn');
  const modeToggleIcon = document.getElementById('modeToggleIcon');
  const modeToggleLabel = document.getElementById('modeToggleLabel');
  let currentScreen = 'screenMix';

  function closeAllDropdowns(){
    document.querySelectorAll('.dropdown-panel').forEach(p=> p.classList.remove('show'));
  }

  function goToScreen(screenKey){
    currentScreen = screenKey;
    Object.keys(screens).forEach(key=> screens[key].classList.toggle('active', key===screenKey));
    toprowEl.classList.toggle('on-draw', screenKey==='screenDraw');
    closeAllDropdowns();
    const miniPaletteEl = document.getElementById('miniPalette');
    if(screenKey==='screenDraw'){
      modeToggleIcon.textContent = '🎨';
      modeToggleLabel.textContent = 'いろへ';
      document.getElementById('palettePanel').appendChild(miniPaletteEl);
      setupDrawCanvas();
    } else {
      modeToggleIcon.textContent = '🖌️';
      modeToggleLabel.textContent = 'おえかきへ';
      document.getElementById('miniPaletteSlot').appendChild(miniPaletteEl);
    }
  }
  modeToggleBtn.addEventListener('click', ()=>{
    goToScreen(currentScreen==='screenMix' ? 'screenDraw' : 'screenMix');
  });

  // ---- tube row (selection only) + stage tube (the big interactive one) ----
  const tubeRow = document.getElementById('tubeRow');
  const tubeSwatches = [];
  const stageTube = document.getElementById('stageTube');
  const stageCap = document.getElementById('stageCap');
  const stageTip = document.getElementById('stageTip');
  const pinchHint = document.getElementById('pinchHint');
  let openTimer = null;

  let selectedIsWater = false;

  TUBE_ITEMS.forEach((col,i)=>{
    const b = document.createElement('button');
    b.className = 'tube-swatch' + (col.isWater ? ' water-swatch' : '');
    b.style.setProperty('--c', col.c);
    b.title = col.name;
    if(col.isWater) b.innerHTML = '<span class="water-drop">💧</span>';
    b.addEventListener('click', ()=> selectColor(i));
    tubeRow.appendChild(b);
    tubeSwatches.push(b);
  });

  function selectColor(i){
    const col = TUBE_ITEMS[i];
    clearTimeout(openTimer);
    selectedTubeReady = false;
    pinchHint.classList.remove('show');

    tubeSwatches.forEach((s,idx)=> s.classList.toggle('selected', idx===i));
    selectedColor = col.c;
    selectedColorName = col.name;
    selectedIsWater = !!col.isWater;
    stageTube.style.setProperty('--c', col.c);
    stageTube.classList.toggle('is-water', selectedIsWater);

    stageTube.classList.remove('flipped','open','squeezing');
    requestAnimationFrame(()=> stageTube.classList.add('flipped'));
    openTimer = setTimeout(()=>{
      stageTube.classList.add('open');
      selectedTubeReady = true;
      pinchHint.classList.add('show');
    }, 380);
  }

  // Loads a color picked up with the dropper from the color encyclopedia -
  // works exactly like picking a tube, so the same pinch gesture drips it
  // into the palette.
  function selectCustomColor(hex, name){
    clearTimeout(openTimer);
    selectedTubeReady = false;
    pinchHint.classList.remove('show');

    tubeSwatches.forEach(s=> s.classList.remove('selected'));
    selectedColor = hex;
    selectedColorName = name;
    selectedIsWater = false;
    stageTube.style.setProperty('--c', hex);
    stageTube.classList.remove('is-water');

    stageTube.classList.remove('flipped','open','squeezing');
    requestAnimationFrame(()=> stageTube.classList.add('flipped'));
    openTimer = setTimeout(()=>{
      stageTube.classList.add('open');
      selectedTubeReady = true;
      pinchHint.classList.add('show');
    }, 380);
    showToast(name + 'をスポイトでとったよ');
  }

  function pulseTubeSqueezeStart(){
    stageTube.classList.add('squeezing');
    pinchHint.classList.remove('show');
  }
  function pulseTubeSqueezeStop(){
    stageTube.classList.remove('squeezing');
    if(stageTube.classList.contains('open')){
      pinchHint.classList.add('show');
    }
  }

  // ---- palettes: 5 storage canvases (data) + 1 big interactive stage canvas ----
  const dishes = [];
  const miniPaletteEl = document.getElementById('miniPalette');
  const miniDishEls = [];

  const stageDish = document.getElementById('stageDish');
  const stageCanvas = document.getElementById('stageCanvas');
  const stageCtx = stageCanvas.getContext('2d');
  const PaintBlobModel = window.YubisakiPaint && window.YubisakiPaint.PaintBlob;
  const PaintRendererModel = window.YubisakiRenderer && window.YubisakiRenderer.PaintRenderer;
  const paintRenderer = PaintRendererModel ? new PaintRendererModel(stageCtx) : null;
  const FingerDynamicsModel = window.YubisakiFinger && window.YubisakiFinger.FingerDynamics;
  const fingerDynamics = FingerDynamicsModel ? new FingerDynamicsModel() : null;
  const stageBadge = document.getElementById('stageDishBadge');
  const stageStar = document.getElementById('stageDishStar');

  // Paint Feel overlay: gives immediate tactile feedback while the pixel
  // simulation catches up. The canvas itself squashes, stretches and rebounds.
  const paintFeelRing = document.createElement('div');
  paintFeelRing.className = 'paint-feel-ring';
  stageDish.appendChild(paintFeelRing);

  // A transparent overlay used for local, non-destructive deformation.  The
  // previous version scaled the whole palette, which felt more like a camera
  // zoom than soft paint.  This overlay samples only the paint beneath the
  // finger and squashes / stretches that patch in place.
  const feelCanvas = document.createElement('canvas');
  feelCanvas.className = 'paint-feel-canvas';
  stageDish.appendChild(feelCanvas);
  const feelCtx = feelCanvas.getContext('2d');
  let feelReleaseTimer = null;
  let lastFeelPoint = null;
  let lastWaterBloomAt = 0;
  let lastHapticAt = 0;

  function resizeFeelCanvas(){
    const rect = stageCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    feelCanvas.width = Math.max(1,Math.round(rect.width*dpr));
    feelCanvas.height = Math.max(1,Math.round(rect.height*dpr));
    feelCanvas.style.width = rect.width+'px';
    feelCanvas.style.height = rect.height+'px';
    feelCtx.setTransform(dpr,0,0,dpr,0,0);
  }

  function clearFeelCanvas(){
    const rect = feelCanvas.getBoundingClientRect();
    feelCtx.clearRect(0,0,rect.width,rect.height);
  }

  function softHaptic(pattern){
    const now=performance.now();
    if(now-lastHapticAt<90) return;
    lastHapticAt=now;
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(_e){}
  }

  function drawLocalDeformation(clientX,clientY,mode='press',dx=0,dy=0){
    const rect=stageCanvas.getBoundingClientRect();
    if(rect.width<2) return;
    resizeFeelCanvas();
    clearFeelCanvas();
    const x=clientX-rect.left, y=clientY-rect.top;
    const dpr=stageDpr || window.devicePixelRatio || 1;
    const radius=mode==='mix' ? 34 : 30;
    const sx=Math.max(0,x-radius), sy=Math.max(0,y-radius);
    const sw=Math.min(radius*2,rect.width-sx), sh=Math.min(radius*2,rect.height-sy);
    if(sw<=1||sh<=1) return;

    const patch=document.createElement('canvas');
    patch.width=Math.max(1,Math.round(sw*dpr));
    patch.height=Math.max(1,Math.round(sh*dpr));
    patch.getContext('2d').drawImage(stageCanvas,
      Math.round(sx*dpr),Math.round(sy*dpr),patch.width,patch.height,
      0,0,patch.width,patch.height);

    feelCtx.save();
    feelCtx.beginPath();
    feelCtx.arc(x,y,radius,0,Math.PI*2);
    feelCtx.clip();
    if(mode==='press'){
      // Flatten the centre and push two small bulges sideways.
      feelCtx.globalAlpha=.96;
      feelCtx.drawImage(patch,0,0,patch.width,patch.height,
        x-radius*1.08,y-radius*.72,radius*2.16,radius*1.44);
      feelCtx.globalAlpha=.42;
      feelCtx.drawImage(patch,0,0,patch.width,patch.height,
        x-radius*1.18,y-radius*.48,radius*.72,radius*.96);
      feelCtx.drawImage(patch,0,0,patch.width,patch.height,
        x+radius*.46,y-radius*.48,radius*.72,radius*.96);
    }else{
      const speed=Math.min(1,Math.hypot(dx,dy)/18);
      const angle=Math.atan2(dy,dx);
      feelCtx.translate(x,y); feelCtx.rotate(angle);
      feelCtx.globalAlpha=.84;
      feelCtx.drawImage(patch,0,0,patch.width,patch.height,
        -radius*(1.0+speed*.42),-radius*.52,radius*(2.0+speed*.84),radius*1.04);
    }
    feelCtx.restore();

    // Wet highlight around the dent makes the displacement read as glossy paint.
    const g=feelCtx.createRadialGradient(x-radius*.28,y-radius*.35,1,x,y,radius);
    g.addColorStop(0,'rgba(255,255,255,.42)');
    g.addColorStop(.45,'rgba(255,255,255,.08)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    feelCtx.fillStyle=g; feelCtx.beginPath();feelCtx.arc(x,y,radius,0,Math.PI*2);feelCtx.fill();
  }

  function setFeelPoint(clientX, clientY){
    const r = stageCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX-r.left));
    const y = Math.max(0, Math.min(r.height, clientY-r.top));
    stageDish.style.setProperty('--ring-x', x+'px');
    stageDish.style.setProperty('--ring-y', y+'px');
    const nx = (x/r.width)-0.5, ny=(y/r.height)-0.5;
    stageDish.style.setProperty('--feel-x', (-nx*5).toFixed(2)+'px');
    stageDish.style.setProperty('--feel-y', (-ny*5).toFixed(2)+'px');
    lastFeelPoint = {x,y};
  }

  function beginPaintPress(clientX, clientY){
    clearTimeout(feelReleaseTimer);
    setFeelPoint(clientX,clientY);
    drawLocalDeformation(clientX,clientY,'press');
    softHaptic(12);
    stageDish.classList.remove('paint-release');
    stageDish.classList.add('paint-press');
    stageDish.style.setProperty('--feel-sx','.992');
    stageDish.style.setProperty('--feel-sy','.982');
  }

  function updatePaintFeel(clientX, clientY, prevX, prevY){
    setFeelPoint(clientX,clientY);
    const dx=clientX-prevX, dy=clientY-prevY;
    const speed=Math.min(1,Math.hypot(dx,dy)/18);
    const angle=Math.atan2(dy,dx)*180/Math.PI;
    drawLocalDeformation(clientX,clientY,'mix',dx,dy);
    if(speed>.42) softHaptic(7);
    stageDish.classList.remove('paint-press');
    stageDish.classList.add('paint-mixing');
    stageDish.style.setProperty('--feel-rot',(Math.sin(angle*Math.PI/180)*.45).toFixed(2)+'deg');
    stageDish.style.setProperty('--feel-sx',(1.002+speed*.012).toFixed(3));
    stageDish.style.setProperty('--feel-sy',(.999-speed*.009).toFixed(3));
  }

  function releasePaintFeel(){
    stageDish.classList.remove('paint-press','paint-mixing');
    stageDish.classList.remove('paint-release');
    void stageDish.offsetWidth;
    stageDish.classList.add('paint-release');
    feelCanvas.classList.remove('feel-releasing');
    void feelCanvas.offsetWidth;
    feelCanvas.classList.add('feel-releasing');
    softHaptic([8,28,5]);
    feelReleaseTimer=setTimeout(()=>{
      stageDish.classList.remove('paint-release');
      feelCanvas.classList.remove('feel-releasing');
      clearFeelCanvas();
    },620);
  }

  function triggerWaterBloom(cx,cy,r){
    const now=performance.now();
    if(now-lastWaterBloomAt<380) return;
    lastWaterBloomAt=now;
    softHaptic([5,45,5]);
    stageDish.style.setProperty('--ring-x',cx+'px');
    stageDish.style.setProperty('--ring-y',cy+'px');
    stageDish.style.setProperty('--ring-size',Math.max(16,r*.55)+'px');
    stageDish.classList.remove('water-bloom');
    void stageDish.offsetWidth;
    stageDish.classList.add('water-bloom');
    setTimeout(()=>stageDish.classList.remove('water-bloom'),1180);
  }
  let STAGE_SIZE = 0;
  let stageDpr = window.devicePixelRatio || 1;

  for(let i=0;i<DISH_COUNT;i++){
    const storage = document.createElement('canvas'); // off-DOM data store, never displayed
    dishes.push({
      storage, storageCtx: null, size: STAGE_SIZE, dpr: stageDpr,
      activeStamp:null, hasPaint:false, currentColor:null, mixProgress:0, fullyMixed:false,
      usedTubeNames:new Set(), hasGlitter:false, paintModel:null
    });

    const btn = document.createElement('button');
    btn.className = 'mini-dish empty' + (i===0 ? ' selected' : '');
    btn.title = 'パレット' + (i+1);
    btn.addEventListener('click', ()=> selectPalette(i));
    miniPaletteEl.appendChild(btn);
    miniDishEls.push(btn);
  }

  function setupStageCanvas(){
    const rect = stageDish.getBoundingClientRect();
    if(rect.width<10) return;
    const dpr = window.devicePixelRatio || 1;
    const newSize = Math.round(rect.width - 16); // minus inset padding
    if(newSize===STAGE_SIZE && dpr===stageDpr) return;

    // preserve current visible paint by scaling old content into the new resolution
    let prevData = null;
    if(stageCanvas.width>0){
      prevData = document.createElement('canvas');
      prevData.width = stageCanvas.width; prevData.height = stageCanvas.height;
      prevData.getContext('2d').drawImage(stageCanvas,0,0);
    }
    STAGE_SIZE = newSize; stageDpr = dpr;
    stageCanvas.width = STAGE_SIZE*dpr;
    stageCanvas.height = STAGE_SIZE*dpr;
    stageCanvas.style.width = STAGE_SIZE+'px';
    stageCanvas.style.height = STAGE_SIZE+'px';
    stageCtx.scale(dpr,dpr);
    if(prevData){ stageCtx.drawImage(prevData,0,0,prevData.width,prevData.height,0,0,STAGE_SIZE,STAGE_SIZE); }

    dishes.forEach(d=>{
      const oldStorage = d.storage;
      const newStorage = document.createElement('canvas');
      newStorage.width = STAGE_SIZE*dpr; newStorage.height = STAGE_SIZE*dpr;
      const nctx = newStorage.getContext('2d');
      nctx.scale(dpr,dpr);
      if(oldStorage.width>0){ nctx.drawImage(oldStorage,0,0,oldStorage.width,oldStorage.height,0,0,STAGE_SIZE,STAGE_SIZE); }
      d.storage = newStorage; d.storageCtx = nctx; d.size = STAGE_SIZE; d.dpr = dpr;
    });
  }
  window.addEventListener('resize', ()=>{ setupStageCanvas(); resizeFeelCanvas(); });

  function selectPalette(index){
    // save current stage pixels into the palette we're leaving
    const prev = dishes[selectedPaletteIndex];
    if(prev.storageCtx){
      prev.storageCtx.clearRect(0,0,prev.size,prev.size);
      prev.storageCtx.drawImage(stageCanvas,0,0,stageCanvas.width,stageCanvas.height,0,0,prev.size,prev.size);
    }

    selectedPaletteIndex = index;
    const dish = dishes[index];
    stageCtx.clearRect(0,0,STAGE_SIZE,STAGE_SIZE);
    if(dish.storageCtx){
      stageCtx.drawImage(dish.storage,0,0,dish.storage.width,dish.storage.height,0,0,STAGE_SIZE,STAGE_SIZE);
    }

    miniDishEls.forEach((el,i)=> el.classList.toggle('selected', i===index));
    stageBadge.textContent = String(index+1);
    stageStar.textContent = DISH_THEMES[index % DISH_THEMES.length].star;
    const theme = DISH_THEMES[index % DISH_THEMES.length];
    stageDish.style.setProperty('--pc1', theme.pc1);
    stageDish.style.setProperty('--pc2', theme.pc2);
    stageDish.style.setProperty('--pc3', theme.pc3);

    if(dish.currentColor){
      brushColor = dish.currentColor;
      updateBrushIndicator();
    }
    brushHasGlitter = !!dish.hasGlitter;
    showToast('パレット' + (index+1) + 'をえらんだよ');
    renderMiniPalette();
  }

  function renderMiniPalette(){
    dishes.forEach((dish,i)=>{
      const el = miniDishEls[i];
      el.classList.toggle('selected', i===selectedPaletteIndex);
      if(dish.currentColor){ el.classList.remove('empty'); el.style.background = dish.currentColor; }
      else { el.classList.add('empty'); el.style.background = ''; }
    });
  }

  function setDishColor(dish, color){
    dish.currentColor = color;
    if(dish === dishes[selectedPaletteIndex]){
      brushColor = color;
      brushHasGlitter = !!dish.hasGlitter;
      updateBrushIndicator();
    }
    renderMiniPalette();
  }

  // ---- paint rendering helpers (organic blob look) ----
  function blobPath(ctx, cx, cy, r, seed){
    const N = 28;
    ctx.beginPath();
    for(let i=0;i<=N;i++){
      const a = (i/N) * Math.PI*2;
      const wob = 1 + 0.018*Math.sin(a*3 + seed) + 0.012*Math.sin(a*5 + seed*1.7);
      const rr = r*wob;
      const x = cx + Math.cos(a)*rr, y = cy + Math.sin(a)*rr;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
  }

  // Real paint is subtractive: pigments absorb light, so mixing two colors
  // should behave like stacking colored filters (browsers do exactly this
  // with the canvas 'multiply' blend mode) rather than RGB-averaging them,
  // which is what LIGHT mixing does, not paint. White paint is the one
  // exception - it's an opaque, reflective pigment that lightens a mixture
  // rather than filtering it, so it still blends normally.
  function isNearWhite(r,g,b){
    return r>222 && g>222 && b>222 && Math.max(r,g,b)-Math.min(r,g,b) < 18;
  }
  function mixBlendMode(color){
    const c = hexToRgb(color);
    return isNearWhite(c.r,c.g,c.b) ? 'source-over' : 'multiply';
  }

  function paintBlobStamp(cx, cy, r, color, paintModel){
    // v1.1.1: all raised-paint rendering now goes through the shared
    // renderer. Keeping this adapter means the gesture code stays simple
    // while Renderer can evolve independently in later releases.
    if(paintRenderer){
      const model = paintModel || (PaintBlobModel ? new PaintBlobModel({color}) : {color, gloss:0.9, wetness:1, viscosity:0.82, height:1});
      model.color = color;
      paintRenderer.drawBlob(model, cx, cy, r, {
        composite: mixBlendMode(color),
        seed: (cx * 0.071 + cy * 0.113 + r * 0.19) % 20
      });
      return;
    }

    // Compatibility fallback for very old browsers where the renderer did
    // not load. It intentionally remains small; normal builds use Renderer.
    const ctx = stageCtx;
    ctx.save();
    ctx.globalCompositeOperation = mixBlendMode(color);
    ctx.shadowColor='rgba(0,0,0,.22)'; ctx.shadowBlur=14; ctx.shadowOffsetY=7;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    const grad = ctx.createRadialGradient(cx-r*.3,cy-r*.35,r*.1,cx,cy,r);
    grad.addColorStop(0,lighten(color,.3)); grad.addColorStop(1,color);
    ctx.fillStyle=grad; ctx.fill();
    ctx.restore();
  }

  function samplePixel(lx, ly){
    const dpr = stageDpr;
    const px = Math.round(lx*dpr), py = Math.round(ly*dpr);
    if(px<0||py<0||px>=stageCanvas.width||py>=stageCanvas.height) return null;
    const d = stageCtx.getImageData(px,py,1,1).data;
    if(d[3]<10) return null;
    return rgbToHex(d[0],d[1],d[2]);
  }

  function samplePatchAverage(lx, ly, radius){
    const dpr = stageDpr;
    const size = Math.max(2, Math.round(radius*2*dpr));
    let px = Math.round(lx*dpr - size/2), py = Math.round(ly*dpr - size/2);
    const cw = stageCanvas.width, ch = stageCanvas.height;
    const x0 = Math.max(0,px), y0 = Math.max(0,py);
    const x1 = Math.min(cw, px+size), y1 = Math.min(ch, py+size);
    const w = x1-x0, h = y1-y0;
    if(w<=0||h<=0) return null;
    const d = stageCtx.getImageData(x0,y0,w,h).data;
    let r=0,g=0,b=0,aSum=0,count=0;
    for(let i=0;i<d.length;i+=4){
      const a = d[i+3];
      if(a>10){ r+=d[i]*a; g+=d[i+1]*a; b+=d[i+2]*a; aSum+=a; count++; }
    }
    if(count===0 || aSum===0) return null;
    return { r: r/aSum, g: g/aSum, b: b/aSum };
  }

  function announceDiscovery(dish){
    if(!dish.currentColor) return;
    const { entry, dist } = findNearestCanonical(dish.currentColor);
    if(!entry) return;
    const EXACT_THRESHOLD = 11;
    const isExact = dist < EXACT_THRESHOLD;

    const isNew = !discoveredColors.some(d=>d.name===entry.name);
    if(isNew){
      discoveredColors.push({name:entry.name, emoji:entry.emoji, hex:dish.currentColor});
      saveDiscoveries();
      renderEncyclopedia();
    }
    if(isNew && isExact){
      playDiscoveryFanfare();
    } else if(!isNew && isExact){
      playRecreatedChime();
    } else {
      playMixCompleteSound();
    }
    showDiscoveryCard(entry, isNew, isExact);
    const voiceLine = isExact
      ? (isNew ? entry.name+'になったね' : entry.name+'をさいげんできたね')
      : entry.name+'っぽいいろになったね';
    speakCute(voiceLine, 1.05);
  }

  function spawnConfetti(container, count){
    const colors = ['#ff6f91','#ffb703','#3aa1e0','#57b463','#9463c2','#ff9f1c','#3ec9a7'];
    const shapes = ['50%','30%','4px'];
    for(let i=0;i<(count||28);i++){
      const el = document.createElement('span');
      el.className = 'confetti-piece';
      const angle = Math.random()*Math.PI*2;
      const dist = 70 + Math.random()*90;
      const dx = Math.cos(angle)*dist;
      const dy = Math.sin(angle)*dist - 30;
      const rot = (Math.random()*720-360)+'deg';
      el.style.setProperty('--dx', dx+'px');
      el.style.setProperty('--dy', dy+'px');
      el.style.setProperty('--rot', rot);
      el.style.background = colors[Math.floor(Math.random()*colors.length)];
      el.style.borderRadius = shapes[Math.floor(Math.random()*shapes.length)];
      el.style.width = (5+Math.random()*5)+'px';
      el.style.height = (5+Math.random()*5)+'px';
      el.style.animationDelay = (Math.random()*0.12)+'s';
      container.appendChild(el);
    }
  }

  function showDiscoveryCard(combo, isNew, isExact){
    const card = document.getElementById('discoveryCard');
    const grand = isNew && isExact;
    const recreated = !isNew && isExact;
    card.className = 'discovery-card'
      + (grand ? ' grand' : '')
      + (recreated ? ' recreated' : '')
      + (isExact ? '' : ' approx');
    const label = isExact ? combo.name : combo.name+'っぽい';
    let topLine = '';
    if(grand) topLine = '<div class="discovery-burst"></div><div class="discovery-new">🎉 はっけん！</div>';
    else if(recreated) topLine = '<div class="discovery-new recreated-label">✨ さいげんできた！</div>';
    else if(isNew) topLine = '<div class="discovery-new subtle">はっけん</div>';
    else if(!isExact) topLine = '<div class="discovery-new subtle">近い色</div>';
    card.innerHTML = topLine +
      '<div class="discovery-emoji">'+combo.emoji+'</div>' +
      '<div class="discovery-name">'+label+'</div>';
    if(grand) spawnConfetti(card, 28);
    else if(recreated) spawnConfetti(card, 12);
    requestAnimationFrame(()=> card.classList.add('show'));
    clearTimeout(showDiscoveryCard._t);
    showDiscoveryCard._t = setTimeout(()=> card.classList.remove('show'), grand ? 3200 : (recreated ? 2400 : 1700));
  }

  function categorizeByHue(hex){
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    if(hsl.s < 0.14) return {key:'gray', icon:'⚪', label:'⚪ むしょくけい', order:8};
    const h = hsl.h*360;
    if(h<16 || h>=345) return {key:'red', icon:'🔴', label:'🔴 あかのなかま', order:0};
    if(h<45) return {key:'orange', icon:'🟠', label:'🟠 だいだいのなかま', order:1};
    if(h<68) return {key:'yellow', icon:'🟡', label:'🟡 きいろのなかま', order:2};
    if(h<160) return {key:'green', icon:'🟢', label:'🟢 みどりのなかま', order:3};
    if(h<200) return {key:'cyan', icon:'💧', label:'💧 みずいろのなかま', order:4};
    if(h<255) return {key:'blue', icon:'🔵', label:'🔵 あおのなかま', order:5};
    if(h<295) return {key:'purple', icon:'🟣', label:'🟣 むらさきのなかま', order:6};
    return {key:'pink', icon:'🌸', label:'🌸 ピンクのなかま', order:7};
  }

  function renderEncyclopedia(){
    const grid = document.getElementById('encyclopediaGrid');
    const nav = document.getElementById('encyclopediaNav');
    if(!grid) return;
    grid.innerHTML = '';
    if(nav) nav.innerHTML = '';
    const seen = new Set();
    const groups = {};
    CANONICAL_COLORS.forEach(entry=>{
      if(seen.has(entry.name)) return;
      seen.add(entry.name);
      const cat = categorizeByHue(entry.hex);
      if(!groups[cat.key]) groups[cat.key] = { key:cat.key, icon:cat.icon, label:cat.label, order:cat.order, items:[] };
      groups[cat.key].items.push(entry);
    });
    const orderedGroups = Object.values(groups).sort((a,b)=>a.order-b.order);
    orderedGroups.forEach(group=>{
      if(nav){
        const navBtn = document.createElement('button');
        navBtn.className = 'ency-nav-btn';
        navBtn.textContent = group.icon;
        navBtn.title = group.label.replace(/^\S+\s*/, '');
        navBtn.addEventListener('click', ()=>{
          const target = document.getElementById('ency-section-'+group.key);
          if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
        });
        nav.appendChild(navBtn);
      }
      const header = document.createElement('div');
      header.className = 'ency-section-header';
      header.id = 'ency-section-'+group.key;
      header.textContent = group.label;
      grid.appendChild(header);
      const sectionGrid = document.createElement('div');
      sectionGrid.className = 'ency-section-grid';
      group.items.forEach(entry=>{
        const found = discoveredColors.find(d=>d.name===entry.name);
        const cell = document.createElement('div');
        cell.className = 'ency-cell' + (found ? '' : ' locked');
        if(found){
          cell.innerHTML = '<div class="ency-swatch" style="background:'+found.hex+'"></div><div class="ency-label">'+entry.emoji+' '+entry.name+'</div>';
          cell.addEventListener('click', ()=>{
            if(currentScreen==='screenDraw'){
              brushColor = found.hex;
              brushHasGlitter = false;
              updateBrushIndicator();
              showToast(found.name + 'を描画色にしたよ');
            } else {
              selectCustomColor(found.hex, found.name);
            }
            encyclopediaOverlay.classList.remove('show');
          });
        } else {
          cell.innerHTML = '<div class="ency-swatch ency-mystery">？</div><div class="ency-label">？？？</div>';
        }
        sectionGrid.appendChild(cell);
      });
      grid.appendChild(sectionGrid);
    });
    document.getElementById('encyclopediaCount').textContent =
      discoveredColors.length + ' / ' + seen.size;
  }

  // Looks up the actual RGB for a color name - either one of the 9 base
  // tube pigments, or a color the player has discovered and dropped in
  // from the encyclopedia (so those mix correctly with other paint too).
  function findPigmentHex(name){
    const base = COLORS.find(c=>c.name===name);
    if(base) return base.c;
    const disc = discoveredColors.find(d=>d.name===name);
    if(disc) return disc.hex;
    return null;
  }

  // Computes the final mixed color directly from the recipe (which tube
  // colors were dispensed, and how many "ticks" of each) rather than by
  // re-sampling canvas pixels. This is what real subtractive mixing math
  // needs: pixel-by-pixel compositing across many drag strokes compounds
  // unpredictably (each stroke re-blends whatever the previous stroke left
  // behind), but computing straight from the clean recipe gives the same
  // answer no matter how the user dragged.
  // Chromatic pigments mix multiplicatively (like stacking colored filters -
  // this is why red+blue paint goes dark and violet, not light gray).
  // White is handled separately: it's an opaque, reflective pigment that
  // lightens a mixture rather than filtering it.
  function computeSubtractiveMix(colorTicks){
    const entries = Object.entries(colorTicks).filter(([,c])=>c>0);
    if(entries.length===0) return null;
    const totalTicks = entries.reduce((s,[,c])=>s+c,0);
    const whiteEntry = entries.find(([n])=>n==='しろ');
    const whiteFrac = whiteEntry ? whiteEntry[1]/totalTicks : 0;
    const chromaticEntries = entries.filter(([n])=>n!=='しろ');

    let mixR=1, mixG=1, mixB=1;
    const chromaticTotal = chromaticEntries.reduce((s,[,c])=>s+c,0);
    const n = chromaticEntries.length;
    chromaticEntries.forEach(([name,count])=>{
      const hex = findPigmentHex(name);
      if(!hex) return;
      const rgb = hexToRgb(hex);
      const rawW = chromaticTotal ? count/chromaticTotal : 1/n;
      // blend the true ratio with an even split so near-50/50 mixes reliably
      // land on the expected blended hue instead of swinging toward
      // whichever color happened to get a few more ticks
      const w = n>1 ? rawW*0.22 + (1/n)*0.78 : rawW;
      mixR *= Math.pow(Math.max(rgb.r,1)/255, w);
      mixG *= Math.pow(Math.max(rgb.g,1)/255, w);
      mixB *= Math.pow(Math.max(rgb.b,1)/255, w);
    });
    if(chromaticEntries.length===0){ mixR=1; mixG=1; mixB=1; }

    let r = mixR*255, g = mixG*255, b = mixB*255;
    if(whiteFrac>0){
      const wAmt = whiteFrac*0.85;
      r = r + (255-r)*wAmt;
      g = g + (255-g)*wAmt;
      b = b + (255-b)*wAmt;
    }
    // Pure multiplicative subtractive mixing can drive a result toward a
    // muddy near-gray when the source colors barely share any channel
    // (e.g. vivid red and vivid blue, both near-zero in the same channel) -
    // real paint still reads as a clear purple there, not dark teal. Only
    // genuinely low-saturation, non-extreme-lightness results get lifted,
    // so legitimate dark shades (black mixed in) are left alone. This is
    // computed fresh from the clean recipe every time, not accumulated
    // stroke by stroke, so it can't compound the way an earlier per-stroke
    // version of this used to.
    if(r+g+b > 3 && chromaticEntries.length >= 2){
      const maxC = Math.max(r,g,b), minC = Math.min(r,g,b);
      if(maxC - minC >= 8){
        const hsl = rgbToHsl(r,g,b);
        const targetSat = 0.55;
        if(hsl.s < targetSat){
          const taper = Math.max(0, 1 - Math.abs(hsl.l-0.5)/0.45);
          const newSat = hsl.s + (targetSat-hsl.s)*taper;
          const boosted = hslToRgb(hsl.h, newSat, hsl.l);
          r = boosted.r; g = boosted.g; b = boosted.b;
        }
      }
    }
    return {r,g,b};
  }

  // A soft, uneven watercolor wash instead of a flat poster-paint fill:
  // pigment pools slightly at the edge (the classic watercolor "bloom"),
  // the boundary bleeds out softly rather than having a hard edge, and a
  // little mottling breaks up the flatness - all things water does to
  // real paint that a plain solid circle doesn't show.
  function renderWatercolorFill(cx, cy, r, hex, alpha){
    const ctx = stageCtx;
    const rgb = hexToRgb(hex);
    const rgbaStr = (a)=> `rgba(${rgb.r|0},${rgb.g|0},${rgb.b|0},${a})`;

    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    grad.addColorStop(0, rgbaStr(0.9));
    grad.addColorStop(0.72, rgbaStr(0.85));
    grad.addColorStop(0.9, rgbaStr(0.75));
    grad.addColorStop(1, rgbaStr(0.25));
    ctx.beginPath();
    ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // edge bloom - pigment concentrating near the boundary as water spreads
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.22*alpha;
    ctx.beginPath();
    ctx.arc(cx,cy,r*0.95,0,Math.PI*2);
    ctx.lineWidth = r*0.14;
    ctx.strokeStyle = hex;
    ctx.stroke();
    ctx.restore();

    // gentle mottling so the wash doesn't look perfectly flat
    ctx.save();
    for(let i=0;i<34;i++){
      const a = Math.random()*Math.PI*2;
      const rad = Math.random()*r*0.88;
      const sx = cx+Math.cos(a)*rad, sy = cy+Math.sin(a)*rad;
      const s = r*(0.04+Math.random()*0.09);
      ctx.globalAlpha = (0.05+Math.random()*0.07)*alpha;
      ctx.beginPath();
      ctx.arc(sx,sy,s,0,Math.PI*2);
      ctx.fillStyle = Math.random()>0.5 ? '#ffffff' : hex;
      ctx.fill();
    }
    ctx.restore();
  }

  function finishMixToSingleColor(dish){
    if(dish.fullyMixed) return;
    dish.fullyMixed = true;
    let mixed = computeSubtractiveMix(dish.colorTicks||{});
    const waterTicks = dish.waterTicks||0;
    const pigmentTicks = dish.totalTicks||0;
    if(!mixed){
      if(waterTicks===0) return;
      mixed = {r:210,g:240,b:255}; // just water, nothing mixed into it yet
    }
    // Water dilutes: it lightens the paint (mixing toward the white dish
    // underneath) and makes it more transparent, rather than tinting it.
    const waterFrac = (waterTicks+pigmentTicks) ? waterTicks/(waterTicks+pigmentTicks) : 0;
    let r = mixed.r, g = mixed.g, b = mixed.b;
    if(waterFrac>0){
      const dilute = Math.min(0.75, waterFrac*0.9);
      r = r + (255-r)*dilute;
      g = g + (255-g)*dilute;
      b = b + (255-b)*dilute;
    }
    const fillAlpha = Math.max(0.4, 1 - waterFrac*0.55);
    const hex = rgbToHex(r,g,b);
    stageCtx.clearRect(0,0,STAGE_SIZE,STAGE_SIZE);
    if(waterFrac > 0.15){
      renderWatercolorFill(STAGE_SIZE/2, STAGE_SIZE/2, STAGE_SIZE/2, hex, fillAlpha);
    } else {
      const cx = STAGE_SIZE/2, cy = STAGE_SIZE/2, rad = STAGE_SIZE*0.36;
      if(!dish.paintModel && PaintBlobModel) dish.paintModel = new PaintBlobModel({color:hex});
      if(dish.paintModel){
        dish.paintModel.color = hex;
        dish.paintModel.mixLevel = 1;
        dish.paintModel.height = Math.min(1.75, 0.9 + Math.min(14, pigmentTicks) * 0.045);
        dish.paintModel.wetness = Math.max(0.35, 1-waterFrac*0.55);
        dish.paintModel.gloss = Math.max(0.35, 0.94-waterFrac*0.25);
        dish.paintModel.viscosity = Math.max(0.2, 0.84-waterFrac*0.5);
      }
      stageCtx.save();
      stageCtx.globalAlpha = fillAlpha;
      if(paintRenderer) paintRenderer.drawBlob(dish.paintModel || {color:hex}, cx, cy, rad, {seed:selectedPaletteIndex+3});
      else {
        stageCtx.beginPath(); stageCtx.arc(cx,cy,rad,0,Math.PI*2); stageCtx.fillStyle=hex; stageCtx.fill();
      }
      stageCtx.restore();
    }
    stageDish.classList.remove('mixpulse'); void stageDish.offsetWidth; stageDish.classList.add('mixpulse');
    setDishColor(dish, hex);
    announceDiscovery(dish);
  }

 function smudgeStep(fromX, fromY, toX, toY, motion = {}) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.15) return false;

    const radius = Math.max(18, Math.min(34, motion.radius || 26));
    const ribbonAlpha = Math.max(0.22, Math.min(0.72, motion.marbleAlpha || 0.52));
    const blendAlpha = Math.max(0.08, Math.min(0.30, motion.blendAlpha || 0.18));
    const ribbonWidth = Math.max(2.2, Math.min(6, motion.ribbonWidth || 4));
    const dpr = stageDpr || window.devicePixelRatio || 1;

    // Copy real pixels from the point under the finger.  We deliberately use
    // source-over throughout: multiply repeatedly darkened the same pixels and
    // produced the black track reported on mobile devices.
    const sxCss = Math.max(0, fromX - radius);
    const syCss = Math.max(0, fromY - radius);
    const swCss = Math.min(radius * 2, STAGE_SIZE - sxCss);
    const shCss = Math.min(radius * 2, STAGE_SIZE - syCss);
    if (swCss <= 1 || shCss <= 1) return false;

    const patch = document.createElement('canvas');
    patch.width = Math.max(1, Math.round(swCss * dpr));
    patch.height = Math.max(1, Math.round(shCss * dpr));
    const pctx = patch.getContext('2d');
    pctx.drawImage(
      stageCanvas,
      Math.round(sxCss * dpr), Math.round(syCss * dpr),
      patch.width, patch.height,
      0, 0, patch.width, patch.height
    );

    // Reject an empty patch so touching bare porcelain does not paint a trail.
    const probe = pctx.getImageData(0, 0, patch.width, patch.height).data;
    let hasPaint = false;
    for (let i = 3; i < probe.length; i += 16) {
      if (probe[i] > 18) { hasPaint = true; break; }
    }
    if (!hasPaint) return false;

    const len = distance || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const angle = Math.atan2(dy, dx);

    stageCtx.save();
    stageCtx.globalCompositeOperation = 'source-over';
    stageCtx.imageSmoothingEnabled = true;

    // Three offset ribbons pull different neighbouring pigments along the
    // gesture.  Slow movement leaves stronger, narrower ribbons; fast movement
    // spreads them wider and blends them sooner.
    [-0.34, 0, 0.34].forEach((ratio, index) => {
      const offset = radius * ratio;
      const cx = toX + nx * offset;
      const cy = toY + ny * offset;
      const major = radius * (index === 1 ? 1.05 : 0.82);
      const minor = ribbonWidth * (index === 1 ? 1.45 : 1.0);

      stageCtx.save();
      stageCtx.globalAlpha = ribbonAlpha * (index === 1 ? 0.88 : 0.68);
      stageCtx.beginPath();
      stageCtx.ellipse(cx, cy, major, minor, angle, 0, Math.PI * 2);
      stageCtx.clip();
      stageCtx.drawImage(
        patch,
        0, 0, patch.width, patch.height,
        cx - radius, cy - radius, radius * 2, radius * 2
      );
      stageCtx.restore();
    });

    // A soft connector avoids dotted gaps while preserving the coloured
    // ribbons.  It uses the sampled colour, never black or multiply blending.
    const picked = samplePatchAverage(fromX, fromY, 7) || samplePatchAverage(toX, toY, 7);
    if (picked) {
      stageCtx.globalAlpha = blendAlpha;
      stageCtx.strokeStyle = `rgb(${picked.r|0},${picked.g|0},${picked.b|0})`;
      stageCtx.lineWidth = Math.max(5, ribbonWidth * 2.2);
      stageCtx.lineCap = 'round';
      stageCtx.lineJoin = 'round';
      stageCtx.beginPath();
      stageCtx.moveTo(fromX, fromY);
      stageCtx.quadraticCurveTo(
        (fromX + toX) / 2 + nx * radius * 0.15,
        (fromY + toY) / 2 + ny * radius * 0.15,
        toX, toY
      );
      stageCtx.stroke();
    }

    stageCtx.restore();
    playMixSound();
    return true;
  }

  function spawnDrip(originRect, destX, destY, color){
    const drip = document.createElement('div');
    drip.style.cssText = 'position:fixed;width:18px;height:23px;border-radius:50% 50% 50% 0;transform:rotate(45deg);pointer-events:none;z-index:999;box-shadow:0 2px 4px rgba(0,0,0,.3);';
    drip.style.background = color;
    const startX = originRect.left + originRect.width/2 - 9;
    const startY = originRect.top + originRect.height*0.08;
    drip.style.left = startX + 'px';
    drip.style.top = startY + 'px';
    document.body.appendChild(drip);
    const dx = destX - startX, dy = destY - startY;
    const anim = drip.animate([
      { transform:'translate(0,0) rotate(45deg) scale(1)', opacity:1 },
      { transform:`translate(${dx*0.9}px, ${dy}px) rotate(45deg) scale(.7)`, opacity:1, offset:.85 },
      { transform:`translate(${dx}px, ${dy}px) rotate(45deg) scale(.4)`, opacity:0 }
    ], { duration: 340, easing:'cubic-bezier(.5,0,.8,.4)' });
    anim.onfinish = ()=> drip.remove();
  }

  function waterBlobStamp(cx, cy, r){
    const ctx = stageCtx;
    triggerWaterBloom(cx,cy,r);

    // A short time-based bloom: pigment is sampled at the drop point and
    // carried outward in soft translucent rings instead of appearing at once.
    const sampled = samplePatchAverage(cx,cy,Math.max(8,r*.35));
    const pigment = sampled || {r:210,g:240,b:255};
    const started = performance.now();
    const duration = 1050;
    function frame(now){
      const t=Math.min(1,(now-started)/duration);
      const eased=1-Math.pow(1-t,3);
      const rr=Math.max(3,r*(.18+eased*.95));
      ctx.save();
      ctx.globalCompositeOperation='source-over';
      const alpha=(1-t)*.075;
      const grad=ctx.createRadialGradient(cx,cy,rr*.12,cx,cy,rr);
      grad.addColorStop(0,`rgba(${pigment.r|0},${pigment.g|0},${pigment.b|0},${alpha*.25})`);
      grad.addColorStop(.62,`rgba(${pigment.r|0},${pigment.g|0},${pigment.b|0},${alpha})`);
      grad.addColorStop(1,`rgba(${pigment.r|0},${pigment.g|0},${pigment.b|0},0)`);
      ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();
      // pale wet center keeps the visible water cue without blue paint
      ctx.globalAlpha=(1-t)*.12;
      ctx.beginPath();ctx.arc(cx,cy,rr*.45,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();
      ctx.restore();
      if(t<1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Keeps a palette's total "amount" of paint (all pigment ticks + water
  // ticks) at a constant cap. Without this, mixing the same dish over many
  // rounds would make each new color's contribution shrink relative to the
  // ever-growing history, making it feel harder and harder to change the
  // color - like the dish's memory of every past color never fades. This
  // rescales everything proportionally once the cap is hit, the same way a
  // real palette only holds so much paint before old paint gets pushed out
  // by new paint.
  const MAX_DISH_AMOUNT = 14;
  function capDishAmount(dish){
    const colorSum = Object.values(dish.colorTicks||{}).reduce((a,b)=>a+b,0);
    const total = colorSum + (dish.waterTicks||0);
    if(total <= MAX_DISH_AMOUNT) return;
    const scale = MAX_DISH_AMOUNT / total;
    Object.keys(dish.colorTicks).forEach(k=>{ dish.colorTicks[k] *= scale; });
    dish.totalTicks = colorSum * scale;
    if(dish.whiteTicks) dish.whiteTicks *= scale;
    if(dish.waterTicks) dish.waterTicks *= scale;
  }

  function dispenseTick(){
    const dish = dishes[selectedPaletteIndex];
    if(!dish.activeStamp){
      const cx = STAGE_SIZE/2, cy = STAGE_SIZE/2;
      const R = STAGE_SIZE*0.22;
      const angle = Math.random()*Math.PI*2;
      const rad = Math.random()*R;
      dish.activeStamp = { x: cx+Math.cos(angle)*rad, y: cy+Math.sin(angle)*rad, r: STAGE_SIZE*0.09 };
    } else {
      // clear this stamp's previous render first - otherwise each tick's
      // 'multiply' blend would stack on top of its own earlier paint and
      // progressively darken it, instead of just growing as one blob
      const clearCtx = stageCtx;
      clearCtx.save();
      clearCtx.globalCompositeOperation = 'destination-out';
      clearCtx.beginPath();
      clearCtx.arc(dish.activeStamp.x, dish.activeStamp.y, dish.activeStamp.r*1.2, 0, Math.PI*2);
      clearCtx.fillStyle = 'rgba(0,0,0,1)';
      clearCtx.fill();
      clearCtx.restore();
      dish.activeStamp.r = Math.min(STAGE_SIZE*0.24, dish.activeStamp.r + STAGE_SIZE*0.018);
    }

    if(selectedIsWater){
      waterBlobStamp(dish.activeStamp.x, dish.activeStamp.y, dish.activeStamp.r);
      dish.waterTicks = (dish.waterTicks||0) + 1;
      if(dish.paintModel && dish.paintModel.addWater) dish.paintModel.addWater(0.055);
      dish.mixProgress = 0;
      dish.fullyMixed = false;
      capDishAmount(dish);
      // water alone doesn't give a paint color to pick up as brush color,
      // but if there's already a mixed color, keep it selected/current
    } else {
      if(!dish.paintModel && PaintBlobModel){
        dish.paintModel = new PaintBlobModel({color:selectedColor, amount:0.8, wetness:1, viscosity:0.84, gloss:0.96});
      } else if(dish.paintModel){
        dish.paintModel.addPaint(selectedColor, 0.18);
        dish.paintModel.color = selectedColor;
        dish.paintModel.wetness = Math.min(1, dish.paintModel.wetness + 0.025);
        dish.paintModel.gloss = Math.min(1, dish.paintModel.gloss + 0.025);
      }
      paintBlobStamp(dish.activeStamp.x, dish.activeStamp.y, dish.activeStamp.r, selectedColor, dish.paintModel);
      dish.hasPaint = true;
      dish.mixProgress = 0;
      dish.fullyMixed = false;
      dish.usedTubeNames.add(selectedColorName);
      dish.colorTicks = dish.colorTicks || {};
      dish.colorTicks[selectedColorName] = (dish.colorTicks[selectedColorName]||0) + 1;
      dish.totalTicks = (dish.totalTicks||0) + 1;
      if(selectedColorName==='しろ') dish.whiteTicks = (dish.whiteTicks||0) + 1;
      capDishAmount(dish);
      setDishColor(dish, selectedColor);
    }
    playDispenseSound();

    if(stageTube.classList.contains('flipped')){
      const originRect = stageTube.getBoundingClientRect();
      const dishRect = stageCanvas.getBoundingClientRect();
      spawnDrip(originRect, dishRect.left+dish.activeStamp.x, dishRect.top+dish.activeStamp.y, selectedColor);
    }
    pulseTubeSqueezeStart();
  }

  function handleStageDishTap(clientX, clientY){
    const rect = stageCanvas.getBoundingClientRect();
    const scaleX = STAGE_SIZE / rect.width, scaleY = STAGE_SIZE / rect.height;
    const lx = (clientX - rect.left) * scaleX, ly = (clientY - rect.top) * scaleY;
    const picked = samplePixel(lx, ly);
    if(picked){
      setDishColor(dishes[selectedPaletteIndex], picked);
      showToast('筆に色をつけたよ');
    }
  }

  function updateBrushIndicator(){
    // current color is shown via the mini palette's selected swatch
  }

  function washActiveDish(){
    const dish = dishes[selectedPaletteIndex];
    stageCtx.clearRect(0,0,STAGE_SIZE,STAGE_SIZE);
    dish.activeStamp=null; dish.hasPaint=false; dish.currentColor=null; dish.mixProgress=0; dish.fullyMixed=false; dish.paintModel=null;
    dish.usedTubeNames = new Set(); dish.hasGlitter = false;
    dish.colorTicks = {}; dish.totalTicks = 0; dish.whiteTicks = 0; dish.waterTicks = 0;
    if(dish.storageCtx) dish.storageCtx.clearRect(0,0,dish.size,dish.size);
    brushColor = null;
    brushHasGlitter = false;
    updateBrushIndicator();
    renderMiniPalette();
    showToast('パレットをあらったよ');
  }
  document.getElementById('washDishBtn').addEventListener('click', washActiveDish);

  function drawSparkleStar(ctx, x, y, size, color, rotation){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rotation||0);
    ctx.beginPath();
    ctx.moveTo(0,-size);
    ctx.quadraticCurveTo(size*0.18,-size*0.18, size,0);
    ctx.quadraticCurveTo(size*0.18,size*0.18, 0,size);
    ctx.quadraticCurveTo(-size*0.18,size*0.18, -size,0);
    ctx.quadraticCurveTo(-size*0.18,-size*0.18, 0,-size);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  document.getElementById('sparkleBtn').addEventListener('click', ()=>{
    const dish = dishes[selectedPaletteIndex];
    if(!dish.hasPaint) return;
    dish.hasGlitter = true;
    brushHasGlitter = true;
    const ctx = stageCtx;
    const glitterColors = ['rgba(255,255,255,0.95)','rgba(255,223,120,0.9)','rgba(255,182,213,0.9)','rgba(179,224,255,0.9)','rgba(230,200,255,0.9)'];
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    // little round dust specks for density
    for(let i=0;i<22;i++){
      const a = Math.random()*Math.PI*2;
      const rad = Math.random()*STAGE_SIZE*0.42;
      const gx = STAGE_SIZE/2 + Math.cos(a)*rad;
      const gy = STAGE_SIZE/2 + Math.sin(a)*rad;
      const s = 0.8 + Math.random()*1.3;
      ctx.beginPath();
      ctx.arc(gx, gy, s, 0, Math.PI*2);
      ctx.fillStyle = glitterColors[Math.floor(Math.random()*glitterColors.length)];
      ctx.fill();
    }
    // bigger 4-point sparkle stars for that cute twinkly look
    for(let i=0;i<16;i++){
      const a = Math.random()*Math.PI*2;
      const rad = Math.random()*STAGE_SIZE*0.4;
      const gx = STAGE_SIZE/2 + Math.cos(a)*rad;
      const gy = STAGE_SIZE/2 + Math.sin(a)*rad;
      const s = 3 + Math.random()*4.5;
      drawSparkleStar(ctx, gx, gy, s, glitterColors[Math.floor(Math.random()*glitterColors.length)], Math.random()*Math.PI);
    }
    ctx.restore();
    playMixCompleteSound();
  });

  const encyclopediaOverlay = document.getElementById('encyclopediaOverlay');
  function openEncyclopedia(){
    renderEncyclopedia();
    document.getElementById('encyclopediaHint').textContent = currentScreen==='screenDraw'
      ? '見つけた色をタップすると、その色で描けるよ'
      : '見つけた色をタップすると、その色をパレットに出せるよ';
    encyclopediaOverlay.classList.add('show');
    closeAllDropdowns();
  }
  document.getElementById('encyclopediaBtn').addEventListener('click', openEncyclopedia);
  document.getElementById('settingsEncyclopediaBtn').addEventListener('click', openEncyclopedia);
  document.getElementById('encyclopediaCloseBtn').addEventListener('click', ()=>{
    encyclopediaOverlay.classList.remove('show');
  });
  const encyclopediaResetBtn = document.getElementById('encyclopediaResetBtn');
  const resetConfirmOverlay = document.getElementById('resetConfirmOverlay');
  let resetHoldTimer = null;
  function startResetHold(){
    encyclopediaResetBtn.classList.add('holding');
    resetHoldTimer = setTimeout(()=>{
      encyclopediaResetBtn.classList.remove('holding');
      resetConfirmOverlay.classList.add('show');
    }, 3000);
  }
  function cancelResetHold(){
    clearTimeout(resetHoldTimer);
    encyclopediaResetBtn.classList.remove('holding');
  }
  encyclopediaResetBtn.addEventListener('pointerdown', startResetHold);
  encyclopediaResetBtn.addEventListener('pointerup', cancelResetHold);
  encyclopediaResetBtn.addEventListener('pointerleave', cancelResetHold);
  encyclopediaResetBtn.addEventListener('pointercancel', cancelResetHold);
  document.getElementById('resetConfirmYes').addEventListener('click', ()=>{
    discoveredColors = [];
    saveDiscoveries();
    renderEncyclopedia();
    resetConfirmOverlay.classList.remove('show');
    showToast('ずかんをリセットしたよ');
  });
  document.getElementById('resetConfirmNo').addEventListener('click', ()=>{
    resetConfirmOverlay.classList.remove('show');
  });
  encyclopediaOverlay.addEventListener('click', e=>{
    if(e.target === encyclopediaOverlay) encyclopediaOverlay.classList.remove('show');
  });

  // ---- gesture handling ----
  const stageEl = document.getElementById('stage');
  const pointers = new Map();
  let didDrag = false;

  function smudgeSegment(fx, fy, tx, ty){
    const distance = Math.hypot(tx-fx, ty-fy);
    const motion = fingerDynamics ? fingerDynamics.measure(distance) : {
      radius:28, blendAlpha:0.28, marbleAlpha:0.5, ribbonWidth:4, progressMultiplier:1
    };
    const spacing = Math.max(4, motion.radius*0.24);
    const steps = Math.max(1, Math.ceil(distance/spacing));
    let ok = false;
    for(let i=1;i<=steps;i++){
      const t0=(i-1)/steps, t1=i/steps;
      const stepX = fx+(tx-fx)*t1, stepY = fy+(ty-fy)*t1;
      const stepFromX = fx+(tx-fx)*t0, stepFromY = fy+(ty-fy)*t0;
      if(smudgeStep(stepFromX, stepFromY, stepX, stepY, motion)) ok = true;
    }
    if(ok){
      didDrag = true;
      const dish = dishes[selectedPaletteIndex];
      dish.mixProgress += distance * motion.progressMultiplier;
      if(dish.paintModel){
        dish.paintModel.mixLevel = Math.min(1, dish.mixProgress/(STAGE_SIZE*3.0));
        dish.paintModel.viscosity = Math.max(0.22, dish.paintModel.viscosity - motion.speed01*0.0025);
      }
      if(dish.mixProgress > STAGE_SIZE*3.0 && !dish.fullyMixed){
        finishMixToSingleColor(dish);
      }
    }
    return ok;
  }

  function isOnStageDish(el){ return el && el.closest && el.closest('#stageDish'); }

  // mouse-only smudge (desktop testing); real touch handled via native TouchEvent below
  stageEl.addEventListener('pointerdown', e=>{
    if(e.pointerType==='touch') return;
    pointers.set(e.pointerId, { x:e.clientX, y:e.clientY, onDish: isOnStageDish(e.target) });
    if(fingerDynamics) fingerDynamics.reset();
    didDrag = false;
    if(isOnStageDish(e.target)) beginPaintPress(e.clientX,e.clientY);
  });
  stageEl.addEventListener('pointermove', e=>{
    if(e.pointerType==='touch') return;
    const p = pointers.get(e.pointerId);
    if(!p) return;
    const prevX=p.x, prevY=p.y; p.x=e.clientX; p.y=e.clientY;
    if(p.onDish) updatePaintFeel(e.clientX,e.clientY,prevX,prevY);
    if(pointers.size===1 && p.onDish ){
      const rect = stageCanvas.getBoundingClientRect();
      const scaleX = STAGE_SIZE/rect.width, scaleY = STAGE_SIZE/rect.height;
      smudgeSegment((prevX-rect.left)*scaleX,(prevY-rect.top)*scaleY,(p.x-rect.left)*scaleX,(p.y-rect.top)*scaleY);
    }
  });
  function endPointer(e){
    if(e.pointerType==='touch') return;
    if(didDrag){ showToast('いろがまざったよ！'); didDrag=false; }
    pointers.delete(e.pointerId);
    releasePaintFeel();
  }
  stageEl.addEventListener('pointerup', endPointer);
  stageEl.addEventListener('pointercancel', endPointer);

  // tap-to-pick-color on the stage dish (mouse click / simple tap)
  stageDish.addEventListener('click', e=>{
    if(didDrag){ didDrag=false; return; }
    handleStageDishTap(e.clientX, e.clientY);
  });

  // native touch: pinch-to-dispense (2 fingers, anywhere on the mix screen)
  // and one-finger smudge-mix on the stage dish
  let touchPts = null;
  let pinchMaxDist = null;
  let pinchLoopId = null;
  let lastSingleTouch = null;

  function checkPinchTouch(){
    if(!touchPts || pinchMaxDist===null) return;
    const d = Math.hypot(touchPts[0].x-touchPts[1].x, touchPts[0].y-touchPts[1].y);
    if(d>pinchMaxDist) pinchMaxDist = d;
    const shrunkEnough = d < pinchMaxDist*0.9 || d < 120;
    if(shrunkEnough){ if(selectedTubeReady) dispenseTick(); }
    else { pulseTubeSqueezeStop(); dishes[selectedPaletteIndex].activeStamp = null; }
  }

  function updateTouchPts(e){
    if(document.body.classList.contains('locked')) return;
    if(!screens.screenMix.classList.contains('active')) return;

    if(e.touches.length===2){
      lastSingleTouch = null;
      touchPts = [
        {x:e.touches[0].clientX, y:e.touches[0].clientY},
        {x:e.touches[1].clientX, y:e.touches[1].clientY}
      ];
      const d = Math.hypot(touchPts[0].x-touchPts[1].x, touchPts[0].y-touchPts[1].y);
      if(pinchMaxDist===null || d>pinchMaxDist) pinchMaxDist = d;
      if(!pinchLoopId){
        dishes[selectedPaletteIndex].activeStamp = null;
        checkPinchTouch();
        pinchLoopId = setInterval(checkPinchTouch, 100);
      }
    } else if(e.touches.length===1){
      touchPts = null; pinchMaxDist = null;
      if(pinchLoopId){ clearInterval(pinchLoopId); pinchLoopId=null; }
      pulseTubeSqueezeStop();

      const t = e.touches[0];
      const target = document.elementFromPoint(t.clientX, t.clientY);
      const onDish = isOnStageDish(target);
      if(onDish && !lastSingleTouch) beginPaintPress(t.clientX,t.clientY);
      if(onDish && lastSingleTouch){
        updatePaintFeel(t.clientX,t.clientY,lastSingleTouch.x,lastSingleTouch.y);
        const dish = dishes[selectedPaletteIndex];
        if(!dish.fullyMixed){
          const rect = stageCanvas.getBoundingClientRect();
          const scaleX = STAGE_SIZE/rect.width, scaleY = STAGE_SIZE/rect.height;
          const moveDist = Math.hypot(t.clientX-lastSingleTouch.x, t.clientY-lastSingleTouch.y);
          if(moveDist>0.4){
            smudgeSegment(
              (lastSingleTouch.x-rect.left)*scaleX, (lastSingleTouch.y-rect.top)*scaleY,
              (t.clientX-rect.left)*scaleX, (t.clientY-rect.top)*scaleY
            );
          }
        }
      }
      if(!lastSingleTouch && fingerDynamics) fingerDynamics.reset();
      lastSingleTouch = { x:t.clientX, y:t.clientY };
    } else {
      lastSingleTouch = null;
      if(didDrag){ showToast('いろがまざったよ！'); didDrag=false; }
      touchPts = null; pinchMaxDist = null;
      if(pinchLoopId){ clearInterval(pinchLoopId); pinchLoopId=null; }
      pulseTubeSqueezeStop();
      dishes.forEach(d=> d.activeStamp=null);
      releasePaintFeel();
    }
  }
  document.addEventListener('touchstart', updateTouchPts, {passive:true});
  document.addEventListener('touchmove', updateTouchPts, {passive:true});
  document.addEventListener('touchend', updateTouchPts, {passive:true});
  document.addEventListener('touchcancel', updateTouchPts, {passive:true});

  // ---- draw screen ----
  const drawCanvas = document.getElementById('drawCanvas');
  const dctx = drawCanvas.getContext('2d');
  let drawing = false;
  let lastPt = null;
  let lastW = 0, lastH = 0;
  let brushSize = 14;

  function setupDrawCanvas(){
    const rect = drawCanvas.getBoundingClientRect();
    if(rect.width<10 || rect.height<10) return;
    const dpr = window.devicePixelRatio || 1;
    if(Math.abs(rect.width-lastW)<2 && Math.abs(rect.height-lastH)<2) return;
    lastW = rect.width; lastH = rect.height;
    drawCanvas.width = rect.width*dpr;
    drawCanvas.height = rect.height*dpr;
    dctx.scale(dpr,dpr);
    dctx.lineCap='round'; dctx.lineJoin='round';
  }
  window.addEventListener('resize', setupDrawCanvas);

  // ---- toprow dropdown menus (palette / brush / settings) ----
  function toggleDropdown(panel, btn){
    const willShow = !panel.classList.contains('show');
    closeAllDropdowns();
    if(willShow){ panel.classList.add('show'); }
  }
  const palettePanel = document.getElementById('palettePanel');
  const brushPanel = document.getElementById('brushPanel');
  const settingsPanel = document.getElementById('settingsPanel');
  document.getElementById('paletteMenuBtn').addEventListener('click', e=>{
    e.stopPropagation();
    toggleDropdown(palettePanel);
  });
  document.getElementById('brushMenuBtn').addEventListener('click', e=>{
    e.stopPropagation();
    toggleDropdown(brushPanel);
  });
  document.getElementById('settingsMenuBtn').addEventListener('click', e=>{
    e.stopPropagation();
    toggleDropdown(settingsPanel);
  });
  document.addEventListener('click', e=>{
    if(!e.target.closest('.dropdown-panel') && !e.target.closest('.lock-btn') && !e.target.closest('.toprow-pill')){
      closeAllDropdowns();
    }
  });

  brushPanel.querySelectorAll('.size-opt').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      brushSize = Number(btn.dataset.size);
      brushPanel.querySelectorAll('.size-opt').forEach(b=> b.classList.toggle('selected', b===btn));
    });
  });

  // ---- undo ----
  const undoBtn = document.getElementById('undoBtn');
  let undoStack = [];
  function updateUndoButton(){ undoBtn.disabled = undoStack.length===0; }
  function pushUndoState(){
    try{
      undoStack.push(drawCanvas.toDataURL());
      if(undoStack.length>25) undoStack.shift();
      updateUndoButton();
    }catch(e){}
  }
  function undo(){
    if(undoStack.length===0) return;
    const dataUrl = undoStack.pop();
    const img = new Image();
    img.onload = ()=>{
      dctx.save();
      dctx.setTransform(1,0,0,1,0,0);
      dctx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
      dctx.drawImage(img,0,0,drawCanvas.width,drawCanvas.height);
      dctx.restore();
    };
    img.src = dataUrl;
    updateUndoButton();
  }
  undoBtn.addEventListener('click', undo);
  updateUndoButton();

  const glitterDrawColors = ['rgba(255,255,255,0.95)','rgba(255,223,120,0.9)','rgba(255,182,213,0.9)','rgba(179,224,255,0.9)'];
  function sprinkleGlitter(x, y, spread){
    const count = 2 + Math.floor(Math.random()*2);
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const rad = Math.random()*spread;
      const gx = x + Math.cos(a)*rad, gy = y + Math.sin(a)*rad;
      const color = glitterDrawColors[Math.floor(Math.random()*glitterDrawColors.length)];
      if(Math.random()>0.5){
        const s = 1.6 + Math.random()*2.2;
        drawSparkleStar(dctx, gx, gy, s, color, Math.random()*Math.PI);
      } else {
        const s = 0.7 + Math.random()*1.1;
        dctx.save();
        dctx.beginPath();
        dctx.arc(gx, gy, s, 0, Math.PI*2);
        dctx.fillStyle = color;
        dctx.fill();
        dctx.restore();
      }
    }
  }

  function startStroke(x, y){
    if(!brushColor) return false;
    pushUndoState();
    drawing = true;
    lastPt = {x, y};
    dctx.beginPath(); dctx.arc(x, y, brushSize/2, 0, Math.PI*2);
    dctx.fillStyle = brushColor; dctx.fill();
    if(brushHasGlitter) sprinkleGlitter(x, y, brushSize*0.5);
    return true;
  }
  function continueStroke(x, y){
    if(!drawing) return;
    dctx.strokeStyle = brushColor; dctx.lineWidth = brushSize;
    dctx.beginPath(); dctx.moveTo(lastPt.x, lastPt.y); dctx.lineTo(x, y); dctx.stroke();
    if(brushHasGlitter) sprinkleGlitter(x, y, brushSize*0.5);
    lastPt = {x, y};
  }
  function stopDraw(){ drawing=false; lastPt=null; }

  // mouse (desktop testing) via Pointer Events
  drawCanvas.addEventListener('pointerdown', e=>{
    if(e.pointerType==='touch') return;
    const rect = drawCanvas.getBoundingClientRect();
    if(startStroke(e.clientX-rect.left, e.clientY-rect.top)) drawCanvas.setPointerCapture(e.pointerId);
  });
  drawCanvas.addEventListener('pointermove', e=>{
    if(e.pointerType==='touch') return;
    const rect = drawCanvas.getBoundingClientRect();
    continueStroke(e.clientX-rect.left, e.clientY-rect.top);
  });
  drawCanvas.addEventListener('pointerup', e=>{ if(e.pointerType!=='touch') stopDraw(); });
  drawCanvas.addEventListener('pointercancel', e=>{ if(e.pointerType!=='touch') stopDraw(); });

  // real touch: native TouchEvent (single finger draws reliably here)
  drawCanvas.addEventListener('touchstart', e=>{
    if(e.touches.length!==1) return;
    const rect = drawCanvas.getBoundingClientRect();
    const t = e.touches[0];
    startStroke(t.clientX-rect.left, t.clientY-rect.top);
  }, {passive:true});
  drawCanvas.addEventListener('touchmove', e=>{
    if(!drawing || e.touches.length!==1) return;
    const rect = drawCanvas.getBoundingClientRect();
    const t = e.touches[0];
    continueStroke(t.clientX-rect.left, t.clientY-rect.top);
  }, {passive:true});
  drawCanvas.addEventListener('touchend', stopDraw, {passive:true});
  drawCanvas.addEventListener('touchcancel', stopDraw, {passive:true});

  document.getElementById('clearCanvasBtn').addEventListener('click', ()=>{
    pushUndoState();
    dctx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
    showToast('画用紙をきれいにしたよ');
  });

  // ---- export drawing as an image ----
  document.getElementById('exportBtn').addEventListener('click', ()=>{
    drawCanvas.toBlob((blob)=>{
      const dataUrl = drawCanvas.toDataURL('image/png');
      // try the standard download first - works in regular mobile/desktop
      // browsers, but is unreliable inside some in-app webviews
      if(blob){
        try{
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = 'yubisaki-atelier-' + Date.now() + '.png';
          link.href = url;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(()=> URL.revokeObjectURL(url), 2000);
        }catch(e){}
      }
      // always also show the image directly, so saving works everywhere -
      // even where the download attribute is ignored, a long-press on a
      // plain <img> triggers the device's native "save image" option
      document.getElementById('exportImage').src = dataUrl;
      document.getElementById('exportOverlay').classList.add('show');
    }, 'image/png');
  });
  document.getElementById('exportCloseBtn').addEventListener('click', ()=>{
    document.getElementById('exportOverlay').classList.remove('show');
  });
  document.getElementById('exportOverlay').addEventListener('click', e=>{
    if(e.target.id==='exportOverlay') document.getElementById('exportOverlay').classList.remove('show');
  });

  // ---- screen lock ----
  // Note: a web page can't block the phone's home button, app-switcher, or
  // notification shade - only the OS's own "Guided Access" (iOS) / "screen
  // pinning" (Android) can do that. This lock does everything a page can:
  // hides the browser UI via fullscreen, blocks the back gesture, and blocks
  // all touches in the app except the unlock tap.
  const lockBtn = document.getElementById('lockBtn');
  const lockOverlay = document.getElementById('lockOverlay');

  function requestFS(){
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if(req){ try{ req.call(el); }catch(e){} }
  }
  function exitFS(){
    const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    if(!isFS) return;
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if(exit){ try{ exit.call(document); }catch(e){} }
  }

  function lockScreen(){
    document.body.classList.add('locked');
    requestFS();
    history.pushState({locked:true}, '', location.href);
    closeAllDropdowns();
  }
  function unlockScreen(){
    document.body.classList.remove('locked');
    exitFS();
  }
  lockBtn.addEventListener('click', lockScreen);
  document.getElementById('settingsLockBtn').addEventListener('click', lockScreen);
  lockOverlay.addEventListener('click', unlockScreen);

  // keep the back gesture/button from leaving the page while locked
  window.addEventListener('popstate', ()=>{
    if(document.body.classList.contains('locked')){
      history.pushState({locked:true}, '', location.href);
    }
  });
  document.addEventListener('contextmenu', e=>{
    if(document.body.classList.contains('locked')) e.preventDefault();
  });

  renderMiniPalette();
  renderEncyclopedia();
  setTimeout(()=>{ setupStageCanvas(); setupDrawCanvas(); selectPalette(0); }, 60);
})();
