const state = {
  mode: 'disconnected',
  port: null,
  reader: null,
  writer: null,
  buffer: '',
  keepReading: false,
  mockInterval: null,
  packetCount: 0,
  samples: [],
  maxSamples: 120,
  current: { ph: null, ntu: null, temp_c: null, do_mgL: null, timestamp: null },
  prev: { ph: null, ntu: null, temp_c: null, do_mgL: null },
  endpoint: '—',
};

const $ = (id) => document.getElementById(id);
const els = {
  navButtons: [...document.querySelectorAll('.nav button')],
  screens: [...document.querySelectorAll('.screen')],
  statusChip: $('statusChip'),
  statusText: $('statusText'),
  baudRate: $('baudRate'),
  customBaud: $('customBaud'),
  connectBtn: $('connectBtn'),
  disconnectBtn: $('disconnectBtn'),
  mockBtn: $('mockBtn'),
  packetCount: $('packetCount'),
  transportText: $('transportText'),
  endpointText: $('endpointText'),
  liveTransport: $('liveTransport'),
  liveEndpoint: $('liveEndpoint'),
  sampleCount: $('sampleCount'),
  lastTimestamp: $('lastTimestamp'),
  phValue: $('phValue'),
  ntuValue: $('ntuValue'),
  tempValue: $('tempValue'),
  doValue: $('doValue'),
  phTrend: $('phTrend'),
  ntuTrend: $('ntuTrend'),
  tempTrend: $('tempTrend'),
  doTrend: $('doTrend'),
  phTime: $('phTime'),
  ntuTime: $('ntuTime'),
  tempTime: $('tempTime'),
  doTime: $('doTime'),
  plotMetric: $('plotMetric'),
  chartCanvas: $('chartCanvas'),
  clearLogBtn: $('clearLogBtn'),
  logOutput: $('logOutput'),
  diagBox: $('diagBox'),
};

function log(message, type = 'info') {
  const ts = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '[ERR]' : type === 'tx' ? '[TX]' : type === 'rx' ? '[RX]' : '[SYS]';
  els.logOutput.textContent += `${ts} ${prefix} ${message}\n`;
  els.logOutput.scrollTop = els.logOutput.scrollHeight;
}

function setDiag(message) {
  els.diagBox.textContent = message;
}

function switchScreen(name) {
  els.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.screen === name));
  els.screens.forEach(screen => screen.classList.toggle('active', screen.id === `screen-${name}`));
}

function setMode(mode, transportLabel = 'None', endpoint = '—') {
  state.mode = mode;
  state.endpoint = endpoint;
  els.statusChip.className = 'status-chip';
  if (mode === 'serial') els.statusChip.classList.add('serial');
  if (mode === 'mock') els.statusChip.classList.add('mock');
  els.statusText.textContent = mode === 'serial' ? 'USB Serial' : mode === 'mock' ? 'Mock Mode' : 'Disconnected';
  els.transportText.textContent = transportLabel;
  els.endpointText.textContent = endpoint;
  els.liveTransport.textContent = transportLabel;
  els.liveEndpoint.textContent = endpoint;
  els.disconnectBtn.disabled = mode === 'disconnected';
  els.mockBtn.textContent = mode === 'mock' ? 'Stop mock mode' : 'Start mock mode';
}

function updateBaudUi() {
  els.customBaud.disabled = els.baudRate.value !== 'custom';
}

function getSelectedBaud() {
  if (els.baudRate.value === 'custom') {
    const n = Number(els.customBaud.value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : NaN;
  }
  return Number(els.baudRate.value);
}

function resetData() {
  state.samples = [];
  state.packetCount = 0;
  state.current = { ph: null, ntu: null, temp_c: null, do_mgL: null, timestamp: null };
  state.prev = { ph: null, ntu: null, temp_c: null, do_mgL: null };
  els.packetCount.textContent = '0';
  els.sampleCount.textContent = '0';
  els.lastTimestamp.textContent = '—';
  updateCards();
  drawChart();
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

function trendText(key, current) {
  const prev = state.prev[key];
  if (prev == null || current == null) return 'Waiting for trend';
  const delta = current - prev;
  if (Math.abs(delta) < 0.005) return 'Stable';
  return delta > 0 ? `Rising ${delta.toFixed(3)}` : `Falling ${Math.abs(delta).toFixed(3)}`;
}

function setMetric(el, value, decimals = 2) {
  el.textContent = value == null ? '—' : Number(value).toFixed(decimals);
}

function pushSample(sample) {
  state.prev = { ...state.current };
  state.current = {
    ph: numberOrNull(sample.ph),
    ntu: numberOrNull(sample.ntu),
    temp_c: numberOrNull(sample.temp_c),
    do_mgL: numberOrNull(sample.do_mgL),
    timestamp: sample.timestamp || Date.now(),
  };
  state.samples.push({ ...state.current });
  if (state.samples.length > state.maxSamples) state.samples.shift();
  state.packetCount += 1;
  els.packetCount.textContent = String(state.packetCount);
  els.sampleCount.textContent = String(state.samples.length);
  updateCards();
  drawChart();
}

function updateCards() {
  const c = state.current;
  setMetric(els.phValue, c.ph, 2);
  setMetric(els.ntuValue, c.ntu, 1);
  setMetric(els.tempValue, c.temp_c, 2);
  setMetric(els.doValue, c.do_mgL, 2);
  els.phTrend.textContent = trendText('ph', c.ph);
  els.ntuTrend.textContent = trendText('ntu', c.ntu);
  els.tempTrend.textContent = trendText('temp_c', c.temp_c);
  els.doTrend.textContent = trendText('do_mgL', c.do_mgL);
  const ft = formatTime(c.timestamp);
  els.phTime.textContent = ft;
  els.ntuTime.textContent = ft;
  els.tempTime.textContent = ft;
  els.doTime.textContent = ft;
  els.lastTimestamp.textContent = ft;
}

function parseCsvTelemetry(line) {
  const parts = line.split(',').map(s => s.trim());
  if (parts.length !== 4) return null;
  const ph = numberOrNull(parts[0]);
  const ntu = numberOrNull(parts[1]);
  const temp_c = numberOrNull(parts[2]);
  const do_mgL = numberOrNull(parts[3]);
  if ([ph, ntu, temp_c, do_mgL].some(v => v == null)) return null;
  return { ph, ntu, temp_c, do_mgL, timestamp: Date.now() };
}

function handleIncomingLine(line) {
  log(line, 'rx');
  const parsed = parseCsvTelemetry(line);
  if (parsed) pushSample(parsed);
}

async function disconnectAll(silent = false) {
  if (state.mockInterval) {
    clearInterval(state.mockInterval);
    state.mockInterval = null;
  }
  try {
    state.keepReading = false;
    if (state.reader) {
      await state.reader.cancel();
      state.reader.releaseLock();
      state.reader = null;
    }
  } catch (err) {
    log(`Reader cleanup warning: ${err.message}`, 'error');
  }
  try {
    if (state.writer) {
      state.writer.releaseLock();
      state.writer = null;
    }
  } catch (err) {
    log(`Writer cleanup warning: ${err.message}`, 'error');
  }
  try {
    if (state.port) {
      await state.port.close();
      state.port = null;
    }
  } catch (err) {
    log(`Port close warning: ${err.message}`, 'error');
  }
  state.buffer = '';
  setMode('disconnected');
  if (!silent) log('Disconnected.');
}

async function connectWebSerial() {
  setDiag('Attempting Web Serial connection…');
  if (!('serial' in navigator)) {
    const msg = 'Web Serial API unsupported in this browser. Use Chromium/Chrome/Edge.';
    setDiag(msg);
    log(msg, 'error');
    return;
  }

  const baud = getSelectedBaud();
  if (!Number.isFinite(baud) || baud <= 0) {
    const msg = 'Invalid baud rate.';
    setDiag(msg);
    log(msg, 'error');
    return;
  }

  try {
    await disconnectAll(true);
    resetData();
    log(`Opening port at ${baud} baud…`);
    const port = await navigator.serial.requestPort();
    state.port = port;
    await state.port.open({ baudRate: baud });

    const info = state.port.getInfo ? state.port.getInfo() : {};
    const endpoint = `${info.usbVendorId ?? 'VID?'}:${info.usbProductId ?? 'PID?'}`;
    setMode('serial', `Web Serial @ ${baud}`, endpoint);
    setDiag(`Connected successfully at ${baud} baud.`);
    log(`Opened USB serial at ${baud} baud.`);

    state.keepReading = true;
    if (state.port.readable) {
      state.reader = state.port.readable.getReader();
      readSerialLoop();
    } else {
      log('Port is open but not readable.', 'error');
    }

    if (state.port.writable) {
      state.writer = state.port.writable.getWriter();
    }
  } catch (err) {
    const msg = `Connect failed: ${err && err.message ? err.message : String(err)}`;
    setDiag(msg);
    log(msg, 'error');
    await disconnectAll(true);
  }
}

async function readSerialLoop() {
  const decoder = new TextDecoder();
  try {
    while (state.keepReading && state.reader) {
      const result = await state.reader.read();
      const value = result.value;
      const done = result.done;
      if (done) break;
      if (!value) continue;
      state.buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = state.buffer.indexOf('\n')) >= 0) {
        const line = state.buffer.slice(0, idx).replace(/\r/g, '').trim();
        state.buffer = state.buffer.slice(idx + 1);
        if (line) handleIncomingLine(line);
      }
    }
  } catch (err) {
    const msg = `Serial read stopped: ${err && err.message ? err.message : String(err)}`;
    setDiag(msg);
    log(msg, 'error');
  }
}

async function toggleMock() {
  if (state.mode === 'mock') {
    await disconnectAll(true);
    setDiag('Mock mode stopped.');
    log('Mock mode stopped.');
    return;
  }
  await disconnectAll(true);
  resetData();
  setMode('mock', 'Simulation', 'Simulated STM32');
  setDiag('Mock mode started.');
  log('Mock mode started.');
  let t = 0;
  state.mockInterval = setInterval(() => {
    t += 1;
    const ph = 6.95 + 0.06 * Math.sin(t / 9) + (Math.random() - 0.5) * 0.02;
    const ntu = 11.7 + 1.2 * Math.sin(t / 8) + (Math.random() - 0.5) * 0.4;
    const temp_c = 22.5 + 0.3 * Math.sin(t / 17) + (Math.random() - 0.5) * 0.05;
    const do_mgL = 8.1 + 0.22 * Math.sin(t / 13) + (Math.random() - 0.5) * 0.06;
    const line = `${ph.toFixed(2)},${ntu.toFixed(1)},${temp_c.toFixed(2)},${do_mgL.toFixed(2)}`;
    handleIncomingLine(line);
  }, 700);
}

function drawChart() {
  const canvas = els.chartCanvas;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const metric = els.plotMetric.value;
  const pad = 34;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0a1325';
  ctx.fillRect(0, 0, width, height);

  const plotted = state.samples.filter(s => s[metric] != null);
  if (plotted.length < 2) {
    ctx.fillStyle = '#a7b4d4';
    ctx.font = '14px sans-serif';
    ctx.fillText('Waiting for data…', 24, 36);
    return;
  }

  let min = Math.min(...plotted.map(s => s[metric]));
  let max = Math.max(...plotted.map(s => s[metric]));
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  min -= range * 0.1;
  max += range * 0.1;

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = pad + (i / 3) * (height - pad * 2);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(pad, pad / 2);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.stroke();

  ctx.fillStyle = '#cfd9ff';
  ctx.font = '11px sans-serif';
  ctx.fillText(max.toFixed(2), 6, pad + 4);
  ctx.fillText(min.toFixed(2), 6, height - pad + 4);
  ctx.fillText(metric, width - 88, 18);

  ctx.strokeStyle = '#6ea8ff';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  plotted.forEach((s, i) => {
    const x = pad + (i / (plotted.length - 1)) * (width - pad * 2);
    const y = height - pad - ((s[metric] - min) / (max - min)) * (height - pad * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const last = plotted[plotted.length - 1];
  const lx = width - pad;
  const ly = height - pad - ((last[metric] - min) / (max - min)) * (height - pad * 2);
  ctx.beginPath();
  ctx.fillStyle = '#6ea8ff';
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fill();
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      log(`Service worker registered: ${reg.scope}`);
    } catch (err) {
      log(`Service worker registration failed: ${err.message}`, 'error');
    }
  }
}

function init() {
  els.navButtons.forEach(btn => btn.addEventListener('click', () => switchScreen(btn.dataset.screen)));
  els.connectBtn.addEventListener('click', () => {
    log('Connect button pressed.');
    connectWebSerial();
  });
  els.disconnectBtn.addEventListener('click', () => disconnectAll(false));
  els.mockBtn.addEventListener('click', toggleMock);
  els.baudRate.addEventListener('change', updateBaudUi);
  els.plotMetric.addEventListener('change', drawChart);
  els.clearLogBtn.addEventListener('click', () => { els.logOutput.textContent = ''; });
  window.addEventListener('beforeunload', () => { disconnectAll(true); });

  updateBaudUi();
  drawChart();
  setDiag('Ready. Press Connect device or Start mock mode.');
  log('HydroSense PWA ready.');
  log('Expected CSV format: pH,NTU,temp_C,do_mgL');
  log('Example: 7.02,12.3,22.48,8.31');
  if (!('serial' in navigator)) {
    const msg = 'Web Serial API unavailable in this browser. Use Chromium/Chrome/Edge.';
    setDiag(msg);
    log(msg, 'error');
  }
  registerServiceWorker();
}

init();
