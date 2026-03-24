// admin.js - 專屬於後台的輕量化邏輯，嚴格隔離以確保資訊安全

const myLiffId = '2009444508-qaGGdlps'; // 🚨 務必確認與前台相同
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwa4MCwa6_Uky7EkbUcghr-_ikexNIbdYZY23U3oysE4Kv6jendZafVbyXB1_2Cpqo-/exec';

let currentUID = ""; 
let adminData = null;

// 【第二階段新增】全域變數，供報表與名單操作使用
let currentModalList = []; 
let currentReportData = [];
let memberModalInstance = null;

document.addEventListener("DOMContentLoaded", function() {
  const loadingEl = document.getElementById('loading');
  
  if (!myLiffId) {
    Swal.fire('系統錯誤', '未設定 LIFF ID！', 'error');
    loadingEl.style.display = 'none';
    return;
  }

  liff.init({ liffId: myLiffId })
    .then(() => {
      if (!liff.isLoggedIn()) {
        window.location.href = 'index.html';
      } else {
        liff.getProfile().then(profile => {
          currentUID = profile.userId;
          verifyAdminAuth(currentUID); 
        }).catch(err => {
          Swal.fire('錯誤', '無法取得 LINE 帳號資料', 'error');
        });
      }
    })
    .catch((err) => {
      Swal.fire('錯誤', 'LIFF 啟動失敗', 'error');
    });
});

function verifyAdminAuth(uid) {
  console.log("🛡️ 向伺服器驗證管理員權限中...");
  
  fetch(`${GAS_URL}?action=getUser&uid=${uid}`)
    .then(response => response.json())
    .then(response => {
      if (response.isAdmin) {
        adminData = response;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('ui-adminName').innerText = `${response.name} (${response.adminLevel})`;
        
        loadDashboard();
        loadBroadcastForm();
        loadAdminEventList(); // 【第二階段新增】載入報表用的活動清單

      } else {
        document.getElementById('loading').style.display = 'none';
        Swal.fire({
          title: '門禁管制',
          text: '抱歉，您沒有進入管理後台的權限喔！',
          icon: 'error',
          confirmButtonColor: '#8e44ad',
          confirmButtonText: '返回首頁',
          allowOutsideClick: false
        }).then(() => {
          window.location.href = 'index.html';
        });
      }
    })
    .catch(error => {
      Swal.fire('錯誤', '資料庫連線失敗！', 'error');
    });
}

function switchAdminTab(event, tabId) {
  event.preventDefault(); 
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
}

// ==========================================
// 載入與渲染儀表板數據 (Tab 1) 
// ==========================================
function loadDashboard() {
  const dashContainer = document.getElementById('tab-dashboard');
  dashContainer.innerHTML = '<div class="text-center my-5"><div class="spinner-border text-primary" style="color: #8e44ad !important;"></div><p class="mt-2 text-muted">讀取數據中...</p></div>';

  fetch(`${GAS_URL}?action=getAdminDashboard&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      if (res.success) renderDashboard(res);
      else dashContainer.innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
    })
    .catch(err => {
      dashContainer.innerHTML = `<div class="alert alert-danger">連線失敗：${err.message}</div>`;
    });
}

function renderDashboard(data) {
  // 【第二階段新增】幫壽星、Tier 卡片加上 clickable-card 與 onclick 事件
  let html = `
    <div class="row mb-3">
      <div class="col-6">
        <div class="card p-3 text-center border-0 shadow-sm h-100" style="border-left: 4px solid #3498db !important;">
          <h6 class="text-muted mb-1" style="font-size: 0.8rem;"><i class="fas fa-users"></i> 總會友數</h6>
          <h3 class="fw-bold text-dark mb-0">${data.stats.totalMembers} <span style="font-size:0.8rem">人</span></h3>
        </div>
      </div>
      <div class="col-6">
        <div class="card p-3 text-center border-0 shadow-sm h-100 clickable-card" style="border-left: 4px solid #e74c3c !important;" onclick="showMemberList('Birthday')">
          <h6 class="text-muted mb-1" style="font-size: 0.8rem;"><i class="fas fa-birthday-cake text-danger"></i> 本月壽星</h6>
          <h3 class="fw-bold text-dark mb-0">${data.stats.birthdayThisMonth} <span style="font-size:0.8rem">人</span></h3>
        </div>
      </div>
    </div>
    
    <div class="row mb-4">
      <div class="col-4 px-2">
        <div class="card p-2 text-center border-0 shadow-sm h-100 bg-light clickable-card" onclick="showMemberList('Tier 0')">
          <h6 class="text-muted mb-0" style="font-size: 0.75rem;">Tier 0</h6>
          <h5 class="fw-bold text-secondary mb-0 mt-1">${data.stats.tier0Count}</h5>
        </div>
      </div>
      <div class="col-4 px-2">
        <div class="card p-2 text-center border-0 shadow-sm h-100 bg-light clickable-card" onclick="showMemberList('Tier 1')">
          <h6 class="text-muted mb-0" style="font-size: 0.75rem;">Tier 1</h6>
          <h5 class="fw-bold text-primary mb-0 mt-1">${data.stats.tier1Count}</h5>
        </div>
      </div>
      <div class="col-4 px-2">
        <div class="card p-2 text-center border-0 shadow-sm h-100 bg-light clickable-card" onclick="showMemberList('Tier 2')">
          <h6 class="text-muted mb-0" style="font-size: 0.75rem;">Tier 2</h6>
          <h5 class="fw-bold text-success mb-0 mt-1">${data.stats.tier2Count}</h5>
        </div>
      </div>
    </div>
    
    <h6 class="fw-bold text-dark mb-3"><i class="fas fa-praying-hands text-warning"></i> 待處理代禱事項 <span class="badge bg-danger rounded-pill">${data.stats.pendingPrayerCount}</span></h6>
    <div class="list-group shadow-sm border-0 mb-4">
  `;
  
  if (data.pendingPrayers && data.pendingPrayers.length > 0) {
      data.pendingPrayers.forEach(p => {
          let badge = p.isPublic === "公開" ? `<span class="badge bg-info">公開</span>` : `<span class="badge bg-secondary">保密</span>`;
          html += `
            <div class="list-group-item p-3 border-0 border-bottom">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-bold text-primary" style="font-size: 1.1rem;">${p.name}</span>
                <small class="text-muted">${p.time}</small>
              </div>
              <div class="mb-2 text-dark" style="font-size: 0.9rem;">
                ${badge} <strong class="ms-1">對象：</strong>${p.target}
              </div>
              <div class="mb-3 p-3 bg-light rounded text-dark" style="font-size: 0.95rem; white-space: pre-wrap; border-left: 3px solid #f39c12;">${p.content}</div>
              <div class="mt-2">
                <textarea id="reply-${p.rowId}" class="form-control mb-2" rows="2" placeholder="牧者勉勵回覆... (送出後將透過 LINE 推播給會友)"></textarea>
                <button class="btn btn-sm btn-success rounded-pill w-100 fw-bold py-2" onclick="markPrayerDone(${p.rowId})">
                  <i class="fas fa-check"></i> 標記已代禱 (並發送通知)
                </button>
              </div>
            </div>
          `;
      });
  } else {
      html += `<div class="list-group-item p-4 text-center text-muted border-0">目前沒有未處理的代禱事項 🙏</div>`;
  }
  html += `</div>`;
  
  document.getElementById('tab-dashboard').innerHTML = html;
}

function markPrayerDone(rowId) {
  const replyText = document.getElementById(`reply-${rowId}`).value.trim();
  Swal.fire({
    title: '確認處理完畢？',
    html: replyText ? `即將標記為已處理，並將勉勵推播給該會友。` : `目前無填寫勉勵，將直接標記為已代禱。`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#28a745',
    cancelButtonColor: '#6c757d',
    confirmButtonText: '是的，已處理'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', text: '正在更新資料庫與發送推播...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
      fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'markPrayerDone', uid: currentUID, rowId: rowId, replyText: replyText })
      }).then(res => res.json()).then(res => {
        if (res.success) {
          Swal.fire('成功', res.message, 'success').then(() => loadDashboard());
        } else {
          Swal.fire('錯誤', res.message, 'error');
        }
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

// ==========================================
// 【第二階段新增】Modal 名單總覽與個資修改
// ==========================================
function getMemberModal() {
  if (!memberModalInstance) {
    memberModalInstance = new bootstrap.Modal(document.getElementById('memberListModal'));
  }
  return memberModalInstance;
}

function showMemberList(filterType) {
  const modalLabel = filterType === 'Birthday' ? '🎂 本月壽星名單' : `📊 ${filterType} 名單`;
  document.getElementById('memberListModalLabel').innerHTML = modalLabel;
  document.getElementById('member-list-tbody').innerHTML = '';
  document.getElementById('modal-loading').style.display = 'block';
  
  getMemberModal().show();

  fetch(`${GAS_URL}?action=getAdminMemberList&uid=${currentUID}&filter=${filterType}`)
    .then(res => res.json())
    .then(res => {
      document.getElementById('modal-loading').style.display = 'none';
      if (res.success) {
        currentModalList = res.list;
        renderMemberListTable(res.list);
      } else {
        document.getElementById('member-list-tbody').innerHTML = `<tr><td colspan="3" class="text-danger">${res.message}</td></tr>`;
      }
    })
    .catch(err => {
      document.getElementById('modal-loading').style.display = 'none';
      document.getElementById('member-list-tbody').innerHTML = `<tr><td colspan="3" class="text-danger">資料撈取失敗</td></tr>`;
    });
}

function renderMemberListTable(list) {
  const tbody = document.getElementById('member-list-tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">目前沒有符合條件的會友</td></tr>';
    return;
  }
  
  let html = '';
  list.forEach((user, index) => {
    let badgeClass = user.tier === 'Tier 2' ? 'success' : (user.tier === 'Tier 1' ? 'primary' : 'secondary');
    html += `
      <tr>
        <td class="text-start">
          <div class="fw-bold text-dark">${user.name}</div>
          <div class="text-muted" style="font-size:0.8rem">${user.phone}</div>
        </td>
        <td>
          <span class="badge bg-${badgeClass} mb-1">${user.tier}</span><br>
          <span class="text-muted" style="font-size:0.75rem">${user.service || '無服事'} / ${user.groups || '無團契'}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary shadow-sm mb-1" onclick="editUser(${index})"><i class="fas fa-edit"></i> 修改</button>
          <button class="btn btn-sm btn-outline-info shadow-sm mb-1" onclick="directMessageUser('${user.name}')"><i class="fas fa-comment-dots"></i> 私訊</button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function editUser(index) {
  let user = currentModalList[index];
  Swal.fire({
    title: '修改會友資料',
    html: `
      <div class="text-start mt-2">
        <label class="form-label fw-bold text-primary">帳號等級</label>
        <select id="edit-tier" class="form-select mb-3">
          <option value="Tier 0" ${user.tier === 'Tier 0' ? 'selected' : ''}>Tier 0 (一般未綁定)</option>
          <option value="Tier 1" ${user.tier === 'Tier 1' ? 'selected' : ''}>Tier 1 (已綁定)</option>
          <option value="Tier 2" ${user.tier === 'Tier 2' ? 'selected' : ''}>Tier 2 (財務驗證)</option>
        </select>
        <label class="form-label fw-bold text-primary">服事單位</label>
        <input type="text" id="edit-service" class="form-control mb-3" value="${user.service}">
        <label class="form-label fw-bold text-primary">推播頻道/團契</label>
        <input type="text" id="edit-groups" class="form-control" value="${user.groups}">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '儲存修改',
    cancelButtonText: '取消',
    confirmButtonColor: '#28a745'
  }).then((result) => {
    if (result.isConfirmed) {
      let newTier = document.getElementById('edit-tier').value;
      let newService = document.getElementById('edit-service').value.trim();
      let newGroups = document.getElementById('edit-groups').value.trim();

      Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
      
      fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'adminUpdateUser', adminUid: currentUID, targetUid: user.uid,
          tier: newTier, service: newService, groups: newGroups
        })
      }).then(res => res.json()).then(res => {
        if (res.success) {
          Swal.fire('成功', '資料已成功更新', 'success');
          // 重新撈取該層級的名單以更新畫面
          const currentFilter = document.getElementById('memberListModalLabel').innerText.includes('壽星') ? 'Birthday' : user.tier;
          showMemberList(currentFilter); 
        } else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('錯誤', err.message, 'error'));
    }
  });
}

function directMessageUser(name) {
  Swal.fire({
    title: '💬 單獨私訊功能',
    icon: 'info',
    html: `目前正為您準備單獨私訊 <b>${name}</b> 的專屬通道。<br><br><small class="text-muted">（此功能將於下一階段系統更新時解鎖，目前請先使用 Tab 3 的推播通訊中心進行群發喔！）</small>`,
    confirmButtonColor: '#8e44ad',
    confirmButtonText: '我知道了'
  });
}


// ==========================================
// 【第二階段新增】活動報表管理 (Tab 2)
// ==========================================
function loadAdminEventList() {
  fetch(`${GAS_URL}?action=getAdminEventList&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      if (res.success && res.list.length > 0) {
        let sel = document.getElementById('report-event-select');
        res.list.forEach(e => {
          sel.innerHTML += `<option value="${e.id}">${e.start} - ${e.name} (${e.status})</option>`;
        });
      }
    });
}

function loadEventReport() {
  let eventId = document.getElementById('report-event-select').value;
  if (!eventId) {
    Swal.fire('提醒', '請先選擇一個要檢視的活動報表！', 'warning');
    return;
  }
  
  document.getElementById('print-section').style.display = 'none';
  Swal.fire({ title: '撈取名單中', html: '這可能需要幾秒鐘的時間...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

  fetch(`${GAS_URL}?action=getAdminEventRegistrations&uid=${currentUID}&eventId=${eventId}`)
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        Swal.close();
        document.getElementById('print-section').style.display = 'block';
        document.getElementById('print-event-name').innerText = res.eventInfo.name;
        document.getElementById('print-event-time').innerText = `活動時間：${res.eventInfo.date} | 報名人數：${res.list.length} 人`;
        
        let tbody = document.getElementById('report-tbody');
        tbody.innerHTML = '';
        currentReportData = res.list;

        if (res.list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4 fw-bold">目前尚無人報名此活動</td></tr>';
        } else {
          res.list.forEach((reg, index) => {
            let attClass = reg.attendance === '已出席' ? 'text-success' : 'text-danger';
            tbody.innerHTML += `
              <tr>
                <td class="text-center fw-bold">${index + 1}</td>
                <td class="fw-bold">${reg.participantName}</td>
                <td class="text-center text-muted">${reg.type}</td>
                <td class="text-center">${reg.phone}</td>
                <td class="text-center">${reg.payStatus}</td>
                <td class="text-center fw-bold ${attClass}">${reg.attendance}</td>
                <td class="text-muted" style="font-size:0.75rem">${reg.extraInfo || ''}</td>
              </tr>
            `;
          });
        }
      } else {
        Swal.fire('錯誤', res.message, 'error');
      }
    }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
}

function downloadCSV() {
  if (currentReportData.length === 0) {
    Swal.fire('提醒', '目前沒有資料可以匯出喔！', 'warning');
    return;
  }
  
  let eventName = document.getElementById('print-event-name').innerText;
  let csvContent = '\uFEFF'; // BOM 讓 Excel 讀取 UTF-8 不會亂碼
  csvContent += "序號,報名時間,報名類型,姓名,聯絡電話,繳費狀態,出席狀態,自訂備註\n";
  
  currentReportData.forEach((row, index) => {
    // 避免自訂備註裡面的逗號或換行破壞 CSV 格式
    let extra = String(row.extraInfo || '').replace(/"/g, '""'); 
    csvContent += `${index+1},${row.regTime},${row.type},${row.participantName},${row.phone},${row.payStatus},${row.attendance},"${extra}"\n`;
  });

  let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  let link = document.createElement("a");
  let url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `霧峰教會_${eventName}_報名名單.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


// ==========================================
// 推播通訊中心邏輯 (Tab 3) 
// ==========================================
function loadBroadcastForm() {
  if (!adminData) return;

  const optGroups = document.getElementById('optgroup-groups');
  if (optGroups && adminData.availableGroups) {
    adminData.availableGroups.forEach(g => {
      optGroups.innerHTML += `<option value="Group:${g}">${g}</option>`;
    });
  }

  const optServices = document.getElementById('optgroup-services');
  if (optServices && adminData.availableServices) {
    adminData.availableServices.forEach(s => {
      optServices.innerHTML += `<option value="Service:${s}">${s}</option>`;
    });
  }

  const optEvents = document.getElementById('optgroup-events');
  const eventSelect = document.getElementById('broadcast-event'); 
  
  if (adminData.allAdminEvents && adminData.allAdminEvents.length > 0) {
    adminData.allAdminEvents.forEach(e => {
      if (optEvents) optEvents.innerHTML += `<option value="Event:${e.id}">${e.name} (報名者)</option>`;
      if (eventSelect) eventSelect.innerHTML += `<option value="${e.id}">🎟️ [${e.category}] ${e.name}</option>`;
    });
  } else if (adminData.activeEvents) {
     adminData.activeEvents.forEach(e => {
      if (optEvents) optEvents.innerHTML += `<option value="Event:${e.id}">${e.name} (報名者)</option>`;
      if (eventSelect) eventSelect.innerHTML += `<option value="${e.id}">🎟️ [${e.category}] ${e.name}</option>`;
    });
  }
}

function submitBroadcast() {
  const target = document.getElementById('broadcast-target').value;
  const msg = document.getElementById('broadcast-msg').value.trim();
  const eventId = document.getElementById('broadcast-event').value;

  if (!msg) {
    Swal.fire('提醒', '推播內容不能為空喔！', 'warning');
    return;
  }

  let displayTarget = target;
  if (target.startsWith("Group:")) displayTarget = "團契：" + target.replace("Group:", "");
  else if (target.startsWith("Service:")) displayTarget = "服事單位：" + target.replace("Service:", "");
  else if (target.startsWith("Event:")) displayTarget = "活動報名者 (" + target.replace("Event:", "") + ")";
  else if (target.startsWith("Tier ")) displayTarget = "帳號等級：" + target;

  Swal.fire({
    title: '發送確認',
    html: `您即將對 <b class="text-danger">${displayTarget}</b> 發送推播。<br><br>系統將會消耗您的官方帳號推播額度，確定要發送嗎？`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#8e44ad',
    cancelButtonColor: '#6c757d',
    confirmButtonText: '確定發送',
    cancelButtonText: '我再檢查一下'
  }).then((result) => {
    if (result.isConfirmed) {
      const btn = document.getElementById('btn-send-broadcast');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 系統處理中...';
      btn.disabled = true;

      fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'sendBroadcast', uid: currentUID, targetGroup: target, messageContent: msg, attachEventId: eventId })
      })
      .then(res => res.json())
      .then(res => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        if (res.success) {
          Swal.fire('發送成功！', res.message, 'success');
          document.getElementById('broadcast-msg').value = '';
          document.getElementById('broadcast-event').value = '無';
        } else Swal.fire('發送失敗', res.message, 'error');
      })
      .catch(err => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        Swal.fire('連線錯誤', err.message, 'error');
      });
    }
  });
}
