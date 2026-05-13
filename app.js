const app = {
  // ── TRẠNG THÁI (STATE) ──
  state: {
    isAuthenticated: false,
    currentCandidates: [],
    top16: [],
    // Stopwatch state
    swRunning: false,
    swStart: 0,
    swElapsed: 0,
    swRAF: null,
    lapCount: 0
  },

  // ── KHỞI TẠO ──
  init() {
    this.loadState(); // Tải lại dữ liệu cũ nếu có
    this.checkAuth();
    this.startClock();
  },

  loadState() {
    const saved = localStorage.getItem('patin_pro_state');
    if (saved) {
      const data = JSON.parse(saved);
      this.state.currentCandidates = data.candidates || [];
      this.state.top16 = data.top16 || [];
    }
  },

  saveToLocal() {
    const data = {
      candidates: this.state.currentCandidates,
      top16: this.state.top16
    };
    localStorage.setItem('patin_pro_state', JSON.stringify(data));
  },

  // ── 1. MODULE XÁC THỰC ──
  login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    // Gợi ý: admin / 123456
    if (user === 'admin' && pass === '123456') {
      this.state.isAuthenticated = true;
      document.getElementById('login-view').classList.remove('active');
      document.getElementById('main-layout').classList.add('active');
      this.navigate('dashboard');
      this.showToast('Chào mừng Quản trị viên!');
    } else {
      this.showToast('Sai thông tin đăng nhập!');
    }
  },

  logout() {
    this.state.isAuthenticated = false;
    document.getElementById('main-layout').classList.remove('active');
    document.getElementById('login-view').classList.add('active');
    document.getElementById('password').value = '';
    this.showToast('Đã đăng xuất');
  },

  checkAuth() {
    if (!this.state.isAuthenticated) {
      document.getElementById('login-view').classList.add('active');
      document.getElementById('main-layout').classList.remove('active');
    }
  },

  // ── 2. MODULE ĐIỀU HƯỚNG ──
  navigate(pageId, navTarget) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');

    const navId = navTarget || pageId;
    document.querySelectorAll('.bnav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.bnav-item[data-target="${navId}"]`);
    if (activeNav) activeNav.classList.add('active');

    window.scrollTo(0, 0);
  },

  // ── 3. MODULE TIỆN ÍCH (CLOCK & TOAST) ──
  startClock() {
    const update = () => {
      const now = new Date();
      const p = v => String(v).padStart(2, '0');
      const clockEl = document.getElementById('home-clock');
      if (clockEl) clockEl.textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
      const dateEl = document.getElementById('home-date');
      if (dateEl) {
        const options = { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('vi-VN', options);
      }
    };
    setInterval(update, 1000);
    update();
  },

  showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  },

  // ── 4. MODULE RACE VIEW (TẬP LUYỆN & VÒNG LOẠI) ──
  setPenalty(lane, val) {
    document.getElementById(`l${lane}-pen`).innerText = val;
    this.showToast(`Làn ${lane}: Penalty = ${val}`);
    if (this.state.raceMode === 'qualifying') this.saveCurrentDrafts();
  },

  swapLanes() {
    const n1 = document.getElementById('l1-name').innerText;
    const n2 = document.getElementById('l2-name').innerText;
    const p1 = document.getElementById('l1-pen').innerText;
    const p2 = document.getElementById('l2-pen').innerText;
    document.getElementById('l1-name').innerText = n2;
    document.getElementById('l2-name').innerText = n1;
    document.getElementById('l1-pen').innerText = p2;
    document.getElementById('l2-pen').innerText = p1;
    this.showToast('Đã hoán đổi 2 làn');
  },

  openRaceView(mode) {
    this.state.raceMode = mode;
    const navTarget = (mode === 'training') ? 'race-view' : 'pro';
    this.navigate('race-view', navTarget);

    // Reset display
    ['l1', 'l2'].forEach(id => {
      document.getElementById(`${id}-time`).firstChild.textContent = '00:00';
      document.getElementById(`${id}-ms`).textContent = '.00';
      document.getElementById(`${id}-pen`).innerText = '0';
    });

    if (mode === 'training') {
      document.getElementById('rv-title').innerText = 'TẬP LUYỆN';
      document.getElementById('rv-nav-wrap').style.display = 'none';
      document.getElementById('l1-name').innerText = 'VĐV Làn 1';
      document.getElementById('l2-name').innerText = 'VĐV Làn 2';
      document.getElementById('l1-status').innerText = 'Chờ bắt đầu';
      document.getElementById('l2-status').innerText = 'Chờ bắt đầu';
      document.getElementById('btn-custom-lock').style.display = 'flex';
      document.getElementById('btn-rv-next').style.display = 'none';
    } else {
      if (this.state.currentCandidates.length === 0) {
        this.showToast('Danh sách VĐV đang trống! Hãy Import CSV trước.');
        this.navigate('pro'); return;
      }
      document.getElementById('rv-title').innerText = 'VÒNG LOẠI';
      document.getElementById('rv-nav-wrap').style.display = 'flex';
      document.getElementById('btn-custom-lock').style.display = 'flex';
      document.getElementById('btn-rv-next').style.display = 'flex';
      this.state.raceIndex = 0;
      this.state.raceDraft = JSON.parse(localStorage.getItem('qualifying_draft') || '{}');
      this.renderLanes();
    }
  },

  changeCandidate(offset) {
    this.saveCurrentDrafts();
    const maxIdx = this.state.currentCandidates.length;
    let newIdx = this.state.raceIndex + offset;

    if (newIdx < 0) newIdx = 0;
    // Dừng ở maxIdx-1 để cặp cuối vẫn hiển thị được (cần c1 tồn tại)
    if (newIdx >= maxIdx - 1) {
      newIdx = maxIdx - 1;
      this.showToast('Đã đến cặp cuối cùng!');
    }

    this.state.raceIndex = newIdx;
    this.renderLanes();
    this.resetRaceLogic();
  },

  saveCurrentDrafts() {
    if (this.state.raceMode !== 'qualifying' || this.state.currentCandidates.length === 0) return;
    const idx = this.state.raceIndex;

    const tSec = this.state.swElapsed / 1000;
    
    // Đọc điểm penalty (số nguyên) rồi quy đổi sang giây: 1 điểm = 0.2s
    const pen1Raw = document.getElementById('l1-pen').innerText;
    const pen2Raw = document.getElementById('l2-pen').innerText;
    const pen1 = pen1Raw === 'DQ' ? 9999 : Math.round((parseFloat(pen1Raw) || 0) * 0.2 * 100) / 100;
    const pen2 = pen2Raw === 'DQ' ? 9999 : Math.round((parseFloat(pen2Raw) || 0) * 0.2 * 100) / 100;

    if (this.state.currentCandidates[idx]) {
      // Chỉ lưu time nếu có chạy, để tránh đè time = 0 lên time cũ
      if (tSec > 0 || !this.state.raceDraft[idx]) {
        this.state.raceDraft[idx] = { time: tSec, penalty: pen1 };
      } else {
        this.state.raceDraft[idx].penalty = pen1;
      }
    }
    if (this.state.currentCandidates[idx + 1]) {
      if (tSec > 0 || !this.state.raceDraft[idx + 1]) {
        this.state.raceDraft[idx + 1] = { time: tSec, penalty: pen2 };
      } else {
        this.state.raceDraft[idx + 1].penalty = pen2;
      }
    }
    localStorage.setItem('qualifying_draft', JSON.stringify(this.state.raceDraft));
  },

  renderLanes() {
    const idx = this.state.raceIndex;
    const maxIdx = this.state.currentCandidates.length;

    document.getElementById('race-nav-status').innerText = `${idx + 1}-${Math.min(idx + 2, maxIdx)} / ${maxIdx}`;

    const c1 = this.state.currentCandidates[idx];
    const c2 = this.state.currentCandidates[idx + 1];

    const d1 = this.state.raceDraft[idx] || { time: 0, penalty: 0 };
    const d2 = this.state.raceDraft[idx + 1] || { time: 0, penalty: 0 };

    document.getElementById('l1-name').innerText = c1 ? c1.name : '---';
    document.getElementById('l1-pen').innerText = d1.penalty;

    document.getElementById('l2-name').innerText = c2 ? c2.name : '---';
    document.getElementById('l2-pen').innerText = d2.penalty;

    // Nếu có time đã chạy trước đó, set l1-time
    this.updateLaneTimeDisplay('l1', d1.time * 1000);
    this.updateLaneTimeDisplay('l2', d2.time * 1000);
  },

  updateLaneTimeDisplay(laneId, elapsedMs) {
    if (!elapsedMs) elapsedMs = 0;
    const ms = elapsedMs % 1000;
    const s = Math.floor(elapsedMs / 1000) % 60;
    const m = Math.floor(elapsedMs / 60000);
    const display = document.getElementById(`${laneId}-time`);
    if (display) {
      display.firstChild.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      document.getElementById(`${laneId}-ms`).textContent = `.${String(Math.floor(ms / 10)).padStart(2, '0')}`;
    }
  },

  addPenalty(lane, points) {
    const penEl = document.getElementById(`l${lane}-pen`);
    let current = parseFloat(penEl.innerText) || 0;
    const newVal = Math.round((current + points) * 10) / 10;
    penEl.innerText = newVal;
    const secs = (points * 0.2).toFixed(1);
    this.showToast(`Làn ${lane}: +${secs}s (${points} lỗi)`);
    if (this.state.raceMode === 'qualifying') this.saveCurrentDrafts();
  },

  setPenalty(lane, val) {
    const penEl = document.getElementById(`l${lane}-pen`);
    if (val === 'DQ') {
      penEl.innerText = 'DQ';
      this.showToast(`Làn ${lane}: DQ - Loại khỏi vòng đấu!`);
    } else {
      penEl.innerText = 0;
      this.showToast(`Làn ${lane}: Đã xóa penalty`);
    }
    if (this.state.raceMode === 'qualifying') this.saveCurrentDrafts();
  },

  swTick() {
    // KHÔNG đếm giờ ở đây — thời gian sẽ được poll từ ESP32
    // Giữ lại hàm để tương thích, nhưng không gọi requestAnimationFrame
  },

  startRace() {
    // TODO: Gửi lệnh START xuống bảng LED
    console.log('[LED CMD] Đã gửi lệnh START xuống cho bảng LED');
    this.state.swRunning = true;
    this.setStatus('l1', 'ĐANG CHẠY...', '#40ff80', 'rgba(0,180,80,0.2)', 'rgba(0,200,80,0.5)');
    this.setStatus('l2', 'ĐANG CHẠY...', '#40ff80', 'rgba(0,180,80,0.2)', 'rgba(0,200,80,0.5)');
    // TODO: Bắt đầu polling thời gian từ ESP32
    // this.state.pollInterval = setInterval(() => this.pollLEDTime(), 200);
  },

  setStatus(laneId, text, color, bg, border) {
    const el = document.getElementById(`${laneId}-status`);
    if (!el) return;
    el.innerText = text;
    el.style.color = color;
    el.style.background = bg;
    el.style.borderColor = border;
  },

  pollLEDTime() {
    // TODO: Thực thể fetch('/api/time') khi đã kết nối ESP32
    // fetch('/api/time').then(r => r.json()).then(data => { ... }).catch(() => {});
    console.log('[LED POLL] Đang chờ thời gian từ bảng LED...');
  },

  updateLaneTimeDisplay(laneId, timeStr) {
    // timeStr từ ESP32: ví dụ "01:23.45" hoặc số ms
    const display = document.getElementById(`${laneId}-time`);
    const msEl = document.getElementById(`${laneId}-ms`);
    if (!display) return;
    if (typeof timeStr === 'number') {
      const ms = timeStr % 1000;
      const s = Math.floor(timeStr / 1000) % 60;
      const m = Math.floor(timeStr / 60000);
      display.firstChild.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      msEl.textContent = `.${String(Math.floor(ms / 10)).padStart(2, '0')}`;
    } else {
      display.firstChild.textContent = timeStr;
    }
  },

  pauseRace() {
    // TODO: Gửi lệnh PAUSE xuống bảng LED
    console.log('[LED CMD] Đã gửi lệnh PAUSE xuống cho bảng LED');
    this.state.swRunning = false;
    clearInterval(this.state.pollInterval);
    this.setStatus('l1', 'TẠM DỪNG', '#ffcc40', 'rgba(255,190,30,0.18)', 'rgba(255,190,30,0.45)');
    this.setStatus('l2', 'TẠM DỪNG', '#ffcc40', 'rgba(255,190,30,0.18)', 'rgba(255,190,30,0.45)');
    if (this.state.raceMode === 'qualifying') this.saveCurrentDrafts();
  },

  resetRace() {
    document.getElementById('modal-confirm').classList.add('active');
  },

  closeResetModal() {
    document.getElementById('modal-confirm').classList.remove('active');
  },

  confirmReset() {
    this.closeResetModal();
    this.resetRaceLogic();
    this.showToast('Đã Reset dữ liệu trận đấu');
  },

  resetRaceLogic() {
    clearInterval(this.state.pollInterval);
    this.state.swRunning = false;
    this.state.swElapsed = 0;
    
    console.log('[LED CMD] Đã gửi lệnh RESET xuống cho bảng LED');

    ['l1', 'l2'].forEach(id => {
      const el = document.getElementById(`${id}-time`);
      if (el) el.firstChild.textContent = '00:00';
      const ms = document.getElementById(`${id}-ms`);
      if (ms) ms.textContent = '.00';
      this.setStatus(id, 'CHỜ BẮT ĐẦU', '#ffcc40', 'rgba(255,190,30,0.18)', 'rgba(255,190,30,0.45)');
    });
  },

  customLock() {
    if (this.state.raceMode === 'qualifying') {
      // TODO: Gửi lệnh CHỐT xuống bảng LED
      console.log('[LED CMD] Đã gửi lệnh CHỐT xuống cho bảng LED');
      this.completeQualifying();
    } else {
      console.log('[LED CMD] Đã gửi lệnh CHỐT xuống cho bảng LED');
      this.showToast('Đã ghi nhận lệnh CHỐT!');
    }
  },

  completeQualifying() {
    this.saveCurrentDrafts();
    const drafts = this.state.raceDraft;
    let results = [];

    this.state.currentCandidates.forEach((c, index) => {
      const d = drafts[index] || { time: 0, penalty: 0 };
      results.push({ name: c.name, total: d.time + d.penalty, rank: 0 });
    });

    results.forEach(r => { if (r.total === 0) r.total = 9999; });
    results.sort((a, b) => a.total - b.total);

    this.state.top16 = results.slice(0, 16).map((r, i) => {
      r.rank = i + 1;
      return r;
    });

    this.saveToLocal();
    this.showToast('Đã chọn xong Top 16. Đang tạo Bracket...');
    this.navigate('bracket');
    this.generateBracket();
  },

  generateBracket() {
    const container = document.getElementById('bracket-container');
    if (!this.state.top16 || this.state.top16.length === 0) {
      container.innerHTML = `<div class="bk-empty">Chưa có dữ liệu.<br>Vui lòng hoàn thành <b>Vòng loại</b> trước.</div>`;
      return;
    }

    // Pad to 16 if needed
    const seeds = [];
    for (let i = 1; i <= 16; i++) {
      seeds[i] = this.state.top16[i - 1] || { name: '---', rank: i };
    }

    // Standard single-elimination bracket order
    const r16Matches = [
      [seeds[1], seeds[16]], [seeds[8],  seeds[9]],
      [seeds[4], seeds[13]], [seeds[5],  seeds[12]],
      [seeds[3], seeds[14]], [seeds[6],  seeds[11]],
      [seeds[7], seeds[10]], [seeds[2],  seeds[15]],
    ];

    const pm = (p1, p2) => `
      <div class="bk-match" onclick="app.startBracketMatch('${p1.name}', '${p2.name}')">
        <div class="bk-player"><span class="bk-seed">#${p1.rank}</span><span class="bk-name">${p1.name}</span></div>
        <div class="bk-sep"></div>
        <div class="bk-player"><span class="bk-seed">#${p2.rank}</span><span class="bk-name">${p2.name}</span></div>
      </div>`;

    const tbd = () => `
      <div class="bk-match bk-match-tbd" onclick="app.showToast('Vui lòng hoàn thành vòng đấu trước đó!')">
        <div class="bk-player bk-tbd"><span class="bk-name">TBD</span></div>
        <div class="bk-sep"></div>
        <div class="bk-player bk-tbd"><span class="bk-name">TBD</span></div>
      </div>`;

    container.innerHTML = `
      <div class="bwc-bracket bk-std">
        <!-- Vòng 1/16 -->
        <div class="bwc-col bwc-r16">
          <div class="bk-round-label">Vòng 1/16 (Vòng 16)</div>
          <div class="bwc-group bwc-group-left">${pm(...r16Matches[0])}${pm(...r16Matches[1])}</div>
          <div class="bwc-group bwc-group-left">${pm(...r16Matches[2])}${pm(...r16Matches[3])}</div>
          <div class="bwc-group bwc-group-left">${pm(...r16Matches[4])}${pm(...r16Matches[5])}</div>
          <div class="bwc-group bwc-group-left">${pm(...r16Matches[6])}${pm(...r16Matches[7])}</div>
        </div>
        
        <!-- Tứ Kết -->
        <div class="bwc-col bwc-qf">
          <div class="bk-round-label">VÒNG 1/8 (Tứ kết)</div>
          <div class="bwc-group bwc-group-left">${tbd()}${tbd()}</div>
          <div class="bwc-group bwc-group-left">${tbd()}${tbd()}</div>
        </div>
        
        <!-- Bán Kết (Chung kết 1 & 2) -->
        <div class="bwc-col bwc-sf">
          <div class="bk-round-label">BÁN KẾT</div>
          <div class="bwc-group bwc-group-left bwc-sf-group">${tbd()}${tbd()}</div>
        </div>
        
        <!-- Chung Kết -->
        <div class="bwc-col bwc-final">
          <div class="bk-round-label">CHUNG KẾT</div>
          ${tbd()}
        </div>
        
        <!-- Quán Quân -->
        <div class="bwc-col bwc-champ-col">
          <div class="bk-round-label">QUÁN QUÂN</div>
          <div class="bwc-champion">🥇 QUÁN QUÂN</div>
        </div>
      </div>`;
  },

  startBracketMatch(name1, name2) {
    if (name1 === '---' || name2 === '---') {
      this.showToast('Chưa đủ vận động viên cho trận đấu này!');
      return;
    }
    
    // Set candidates manually for this specific match
    this.state.currentCandidates = [
      { name: name1 },
      { name: name2 }
    ];
    this.state.raceIndex = 0;
    
    // Switch to race view
    this.state.raceMode = 'qualifying'; // Reuse qualifying UI
    this.navigate('race-view', 'pro');
    
    // Reset display and set names
    ['l1', 'l2'].forEach(id => {
      document.getElementById(`${id}-time`).firstChild.textContent = '00:00';
      document.getElementById(`${id}-ms`).textContent = '.00';
      document.getElementById(`${id}-pen`).innerText = '0';
      this.setStatus(id, 'waiting');
    });
    
    document.getElementById('rv-title').innerText = 'THI ĐẤU ĐỐI KHÁNG';
    document.getElementById('rv-nav-wrap').style.display = 'none';
    document.getElementById('btn-custom-lock').style.display = 'flex';
    document.getElementById('btn-rv-next').style.display = 'none';
    
    document.getElementById('l1-name').innerText = name1;
    document.getElementById('l2-name').innerText = name2;
    
    this.showToast(`Bắt đầu trận đấu: ${name1} vs ${name2}`);
  },

  // ── 6. MODULE DỮ LIỆU (CSV) ──
  processCSV() {
    const file = document.getElementById('csv-file').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => this.parseCSV(e.target.result);
    reader.readAsText(file, 'UTF-8');
  },

  parseCSV(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) {
      this.showToast("File trống hoặc sai định dạng!");
      return;
    }
    this.state.currentCandidates = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 2) {
        this.state.currentCandidates.push({ name: cols[0].trim(), dob: cols[1].trim() });
      }
    }
    this.renderCSVPreview();
  },

  renderCSVPreview() {
    const tbody = document.querySelector('#candidate-table tbody');
    tbody.innerHTML = this.state.currentCandidates.map((c, i) => `
      <tr><td>${i + 1}</td><td><strong>${c.name}</strong></td><td>${c.dob}</td></tr>
    `).join('');
    document.getElementById('total-candidates').innerText = this.state.currentCandidates.length;
    document.getElementById('csv-preview').classList.remove('hidden');
  },

  saveTournament() {
    let name = document.getElementById('tournament-name').value.trim();
    if (!name) name = "Giải Đấu Cấp Tốc";
    if (this.state.currentCandidates.length === 0) {
      this.showToast('Danh sách VĐV đang trống, hãy Import CSV!');
      return;
    }
    this.saveToLocal();
    // Xóa draft cũ khi load giải mới
    localStorage.removeItem('qualifying_draft');
    this.showToast('Dã lưu! Bắt đầu Vòng loại...');
    this.openRaceView('qualifying');
  },

  saveSettings() {
    this.showToast('Đã lưu cấu hình ESP32!');
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
