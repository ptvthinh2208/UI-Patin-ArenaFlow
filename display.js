let forcedMode = null;

window.setDisplayMode = function(mode) {
  forcedMode = mode;
  document.getElementById('display-mode-modal').classList.remove('active');
  
  // Re-render based on last state if exists
  const lastStateStr = localStorage.getItem('patin_display_state');
  if (lastStateStr) {
    try {
      updateDisplay(JSON.parse(lastStateStr));
    } catch (e) {}
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const channel = new BroadcastChannel('patin_arena_channel');

  // Hide modal if already selected
  if (forcedMode) {
    document.getElementById('display-mode-modal').classList.remove('active');
  }

  // Khôi phục trạng thái gần nhất nếu có (phòng khi F5 màn hình hiển thị)
  const lastStateStr = localStorage.getItem('patin_display_state');
  if (lastStateStr) {
    try {
      updateDisplay(JSON.parse(lastStateStr));
    } catch (e) { }
  }

  channel.onmessage = (event) => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'STATE_UPDATE') {
      updateDisplay(data.payload);
      // Lưu lại trạng thái để nếu màn hình F5 vẫn giữ được
      localStorage.setItem('patin_display_state', JSON.stringify(data.payload));
    }
  };

  function updateDisplay(state) {
    if (!state) return;

    // 1. Update Title
    document.getElementById('display-title').innerText = 'MÀN HÌNH KẾT QUẢ';

    // 2. Layout Mode (solo vs pk)
    const lanesWrap = document.getElementById('lanes-container');
    let shouldBeSolo = false;

    if (forcedMode === '1') {
      shouldBeSolo = true;
    } else if (forcedMode === '2') {
      shouldBeSolo = false;
    } else {
      // Auto mode
      shouldBeSolo = (state.layoutMode === 'solo');
    }

    if (shouldBeSolo) {
      lanesWrap.classList.add('solo-mode');
    } else {
      lanesWrap.classList.remove('solo-mode');
    }

    // 3. Update Lane 1
    updateLane('l1', state.lane1);

    // 4. Update Lane 2
    if (state.layoutMode !== 'solo') {
      updateLane('l2', state.lane2);
    }

    // 5. Update Round Indicators
    const currentRound = state.currentRound || 1;
    const updateDots = (dots) => {
      dots.forEach((dot, idx) => {
        if (idx + 1 === currentRound) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    };
    updateDots(document.querySelectorAll('#lane-1 .round-dot'));
    updateDots(document.querySelectorAll('#lane-2 .round-dot'));
  }

  function updateLane(laneId, laneData) {
    if (!laneData) return;

    // Name and DOB
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = laneData.name;
    if (tempDiv.childNodes.length > 1) {
      const nameText = tempDiv.childNodes[0].textContent;
      const dobText = tempDiv.childNodes[1].textContent;
      document.getElementById(`${laneId}-name`).innerHTML = `${nameText} <div class="racer-dob">${dobText}</div>`;
    } else {
      document.getElementById(`${laneId}-name`).innerHTML = tempDiv.textContent;
    }

    // Time
    const timeEl = document.getElementById(`${laneId}-time`);
    const msEl = document.getElementById(`${laneId}-ms`);
    
    if (timeEl.firstChild) {
      timeEl.firstChild.textContent = laneData.timeMain;
    }
    if (msEl) {
      msEl.textContent = laneData.timeMs;
    }

    // Penalty
    const penEl = document.getElementById(`${laneId}-pen`);
    if (penEl) {
      penEl.innerText = laneData.penalty;
      if (laneData.penalty === 'DQ') {
        penEl.classList.add('dq');
      } else {
        penEl.classList.remove('dq');
      }
    }

    // Status (Decoupled from control panel styles)
    const statusEl = document.getElementById(`${laneId}-status`);
    if (statusEl) {
      const statusText = laneData.statusText.toUpperCase();
      let color = '#f59e0b'; let bg = 'rgba(245,158,11,0.15)'; let border = 'rgba(245,158,11,0.4)'; let shadow = 'rgba(245,158,11,0.2)';
      
      if (statusText.includes('ĐANG CHẠY')) {
        color = '#10b981'; bg = 'rgba(16,185,129,0.15)'; border = 'rgba(16,185,129,0.4)'; shadow = 'rgba(16,185,129,0.3)';
      } else if (statusText.includes('TẠM DỪNG')) {
        color = '#ef4444'; bg = 'rgba(239,68,68,0.15)'; border = 'rgba(239,68,68,0.4)'; shadow = 'rgba(239,68,68,0.3)';
      }

      statusEl.innerText = statusText;
      statusEl.style.color = color;
      statusEl.style.background = bg;
      statusEl.style.borderColor = border;
      statusEl.style.boxShadow = `0 0 40px ${shadow}`;
    }
  }
});
