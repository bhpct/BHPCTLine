// admin.js - 專屬於後台的輕量化邏輯，嚴格隔離以確保資訊安全

const myLiffId = '2009444508-qaGGdlps'; // 🚨 務必確認與前台相同
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwa4MCwa6_Uky7EkbUcghr-_ikexNIbdYZY23U3oysE4Kv6jendZafVbyXB1_2Cpqo-/exec';

let currentUID = ""; 
let adminData = null;

// 全域變數庫
let currentModalList = []; 
let currentReportData = [];
let memberModalInstance = null;

// 第三階段新增：全教會名單與管理員快取
let allMembersCache = [];
let adminRolesCache = [];

// ====== 【修復：相容動態載入的啟動機制】 ======
function initAdminSystem() {
  const loadingEl = document.getElementById('loading');
  if (!myLiffId) { Swal.fire('系統錯誤', '未設定 LIFF ID！', 'error'); loadingEl.style.display = 'none'; return; }

  liff.init({ liffId: myLiffId }).then(() => {
    if (!liff.isLoggedIn()) { window.location.href = 'index.html'; } 
    else {
      liff.getProfile().then(profile => {
        currentUID = profile.userId;
        verifyAdminAuth(currentUID); 
      }).catch(err => Swal.fire('錯誤', '無法取得 LINE 帳號資料', 'error'));
    }
  }).catch((err) => Swal.fire('錯誤', 'LIFF 啟動失敗', 'error'));
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initAdminSystem);
} else {
    initAdminSystem(); 
}
// ==========================================

window.forceAdminRefresh = function() {
  Swal.fire({ title: '重新載入中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  window.location.href = window.location.pathname + '?t=' + new Date().getTime();
};

function verifyAdminAuth(uid) {
  console.log("🛡️ 向伺服器驗證管理員權限中...");
  fetch(`${GAS_URL}?action=getUser&uid=${uid}`)
    .then(async res => {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch(e) {
        throw new Error("<span style='color:red; font-size:0.85rem;'>伺服器回傳異常：</span><br>" + text.substring(0, 150).replace(/</g, "&lt;"));
      }
    })
    .then(response => {
      if (response.isAdmin) {
        adminData = response;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('ui-adminName').innerText = `${response.name} (${response.adminLevel})`;
        applyRBAC(); 
      } else {
        document.getElementById('loading').style.display = 'none';
        Swal.fire({
          title: '門禁管制', text: '抱歉，您沒有進入管理後台的權限喔！', icon: 'error',
          confirmButtonColor: '#8e44ad', confirmButtonText: '返回首頁', allowOutsideClick: false
        }).then(() => { window.location.href = 'index.html'; });
      }
    }).catch(err => {
      document.getElementById('loading').style.display = 'none';
      Swal.fire({ title: '資料庫連線失敗', html: err.message, icon: 'error' });
    });
}

// ==========================================
// RBAC (角色基礎存取控制) 介面渲染引擎
// ==========================================
function applyRBAC() {
  const lvl = adminData.adminLevel;
  console.log("當前管理員身分：", lvl);

  loadBroadcastForm();
  loadAdminEventList();

  if (lvl === "超級管理員") {
    document.getElementById('nav-tab-roles').classList.remove('auth-hidden');
    document.getElementById('finance-upload-section').classList.remove('auth-hidden');
    document.getElementById('btn-toggle-create').classList.remove('auth-hidden'); // 允許新增活動
    loadDashboard();
    loadSystemSettings();
    loadAllMembers();
    loadAdminRoles();
    
  } else if (lvl === "最高管理員") {
    document.getElementById('finance-upload-section').classList.remove('auth-hidden');
    document.getElementById('btn-toggle-create').classList.remove('auth-hidden'); // 允許新增活動
    loadDashboard();
    loadSystemSettings();
    loadAllMembers();
    
  } else if (lvl === "活動管理員") {
    document.getElementById('nav-tab-dashboard').classList.add('auth-hidden');
    document.getElementById('nav-tab-settings').classList.add('auth-hidden');
    document.getElementById('nav-tab-members').classList.add('auth-hidden');
    document.getElementById('btn-toggle-create').classList.remove('auth-hidden'); // 允許新增活動
    switchAdminTab(null, 'events'); 
    
  } else if (lvl === "財務管理員") {
    document.getElementById('nav-tab-dashboard').classList.add('auth-hidden');
    document.getElementById('nav-tab-events').classList.add('auth-hidden');
    document.getElementById('nav-tab-broadcast').classList.add('auth-hidden');
    document.getElementById('nav-tab-settings').classList.add('auth-hidden');
    document.getElementById('member-management-section').style.display = 'none';
    document.getElementById('finance-upload-section').classList.remove('auth-hidden');
    switchAdminTab(null, 'members'); 
    
  } else {
    document.getElementById('nav-tab-events').classList.add('auth-hidden');
    document.getElementById('nav-tab-settings').classList.add('auth-hidden');
    loadDashboard();
    loadAllMembers();
  }
}

function switchAdminTab(event, tabId) {
  if (event) event.preventDefault(); 
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  } else {
    const navEl = document.getElementById('nav-tab-' + tabId);
    if (navEl) {
      const linkEl = navEl.querySelector('.nav-link');
      if (linkEl) linkEl.classList.add('active');
    }
  }
  
  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tabId);
  if (tabEl) tabEl.classList.add('active');
}

// ==========================================
// 載入與渲染儀表板數據 (Tab 1)
// ==========================================
function loadDashboard() {
  const dashContainer = document.getElementById('tab-dashboard');
  fetch(`${GAS_URL}?action=getAdminDashboard&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      if (res.success) renderDashboard(res);
      else dashContainer.innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
    }).catch(err => dashContainer.innerHTML = `<div class="alert alert-danger">連線失敗：${err.message}</div>`);
}

function renderDashboard(data) {
  let html = `
    <div class="row mb-3">
      <div class="col-6">
        <div class="card p-3 text-center border-0 shadow-sm h-100" style="border-left: 4px solid #3498db !important;">
          <h6 class="text-muted mb-1" style="font-size: 0.8rem;"><i class="fas fa-user-plus text-primary"></i> 本月新增會友</h6>
          <h3 class="fw-bold text-dark mb-0">${data.stats.newMembersThisMonth} <span style="font-size:0.8rem">人</span></h3>
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

    <h6 class="fw-bold text-dark mb-3"><i class="fas fa-file-invoice-dollar text-success"></i> 待處理財務開通申請 <span class="badge bg-danger rounded-pill">${data.stats.pendingFinanceCount}</span></h6>
    <div class="list-group shadow-sm border-0 mb-4">
  `;

  if (data.pendingFinanceRequests && data.pendingFinanceRequests.length > 0) {
      data.pendingFinanceRequests.forEach(f => {
          html += `
            <div class="list-group-item p-3 border-0 border-bottom">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-bold text-success" style="font-size: 1.1rem;">${f.name}</span>
                <small class="text-muted">${f.applyTime} 申請</small>
              </div>
              <div class="mb-3 text-dark" style="font-size: 0.9rem;">
                <i class="fas fa-phone-alt w-20px text-muted"></i> ${f.phone}
              </div>
              <button class="btn btn-sm btn-outline-success rounded-pill w-100 fw-bold py-2" onclick="approveFinanceAccess('${f.uid}', '${f.name}')">
                <i class="fas fa-user-check"></i> 處理並一鍵開通 (升級 Tier 2)
              </button>
            </div>`;
      });
  } else {
      html += `<div class="list-group-item p-4 text-center text-muted border-0">目前無待開通的財務申請 💰</div>`;
  }
  html += `</div>`;
    
  html += `<h6 class="fw-bold text-dark mb-3"><i class="fas fa-praying-hands text-warning"></i> 待處理代禱事項 <span class="badge bg-danger rounded-pill">${data.stats.pendingPrayerCount}</span></h6>
    <div class="list-group shadow-sm border-0 mb-4">`;
  
  if (data.pendingPrayers && data.pendingPrayers.length > 0) {
      data.pendingPrayers.forEach(p => {
          let badge = p.isPublic === "公開" ? `<span class="badge bg-info">公開</span>` : `<span class="badge bg-secondary">保密</span>`;
          html += `
            <div class="list-group-item p-3 border-0 border-bottom">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-bold text-primary" style="font-size: 1.1rem;">${p.name}</span>
                <small class="text-muted">${p.time}</small>
              </div>
              <div class="mb-2 text-dark" style="font-size: 0.9rem;">${badge} <strong class="ms-1">對象：</strong>${p.target}</div>
              <div class="mb-3 p-3 bg-light rounded text-dark" style="font-size: 0.95rem; white-space: pre-wrap; border-left: 3px solid #f39c12;">${p.content}</div>
              <div class="mt-2">
                <textarea id="reply-${p.rowId}" class="form-control mb-2" rows="2" placeholder="牧者勉勵回覆... (送出後推播給會友)"></textarea>
                <button class="btn btn-sm btn-success rounded-pill w-100 fw-bold py-2" onclick="markPrayerDone(${p.rowId})">
                  <i class="fas fa-check"></i> 標記已代禱 (並發送通知)
                </button>
              </div>
            </div>`;
      });
  } else {
      html += `<div class="list-group-item p-4 text-center text-muted border-0">目前沒有未處理的代禱事項 🙏</div>`;
  }
  document.getElementById('tab-dashboard').innerHTML = html + `</div>`;
}

function approveFinanceAccess(targetUid, targetName) {
  Swal.fire({
    title: `核准開通：${targetName}`,
    html: `
      <div class="text-start mt-2">
        <p class="text-muted mb-3" style="font-size:0.85rem;">請輸入該會友的「奉獻代碼」，系統將自動擷取「家庭編號」並將其升級為 Tier 2。</p>
        <label class="form-label fw-bold text-success">奉獻代碼</label>
        <input type="text" id="finance-code-input" class="form-control mb-3" placeholder="例如：0198-1">
      </div>
    `,
    showCancelButton: true, confirmButtonText: '確定開通', cancelButtonText: '取消', confirmButtonColor: '#28a745',
    preConfirm: () => {
      const code = document.getElementById('finance-code-input').value.trim();
      if (!code) Swal.showValidationMessage('請輸入奉獻代碼！');
      return code;
    }
  }).then((result) => {
    if (result.isConfirmed) {
      const dCode = result.value;
      const fId = dCode.split('-')[0]; 
      
      Swal.fire({ title: '處理中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'approveFinanceAccess', adminUid: currentUID, targetUid: targetUid, donationCode: dCode, familyId: fId }) 
      })
      .then(res => res.json()).then(res => {
        if (res.success) Swal.fire('開通成功', `已將 ${targetName} 升級為 Tier 2！`, 'success').then(() => loadDashboard());
        else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function markPrayerDone(rowId) {
  const replyText = document.getElementById(`reply-${rowId}`).value.trim();
  Swal.fire({
    title: '確認處理完畢？', html: replyText ? `即將標記為已處理，並將勉勵推播。` : `目前無填寫勉勵，將直接標記為已代禱。`,
    icon: 'question', showCancelButton: true, confirmButtonColor: '#28a745', confirmButtonText: '是的，已處理'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'markPrayerDone', uid: currentUID, rowId: rowId, replyText: replyText }) })
        .then(res => res.json()).then(res => {
          if(res.success) { Swal.fire('成功', res.message, 'success').then(()=>loadDashboard()); } 
          else { Swal.fire('錯誤', res.message, 'error'); }
        }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function getMemberModal() {
  if (!memberModalInstance) memberModalInstance = new bootstrap.Modal(document.getElementById('memberListModal'));
  return memberModalInstance;
}
function showMemberList(filterType) {
  document.getElementById('memberListModalLabel').innerHTML = filterType === 'Birthday' ? '🎂 本月壽星名單' : `📊 ${filterType} 名單`;
  document.getElementById('member-list-tbody').innerHTML = '';
  document.getElementById('modal-loading').style.display = 'block';
  getMemberModal().show();

  fetch(`${GAS_URL}?action=getAdminMemberList&uid=${currentUID}&filter=${filterType}`)
    .then(res => res.json())
    .then(res => {
      document.getElementById('modal-loading').style.display = 'none';
      if (res.success) { currentModalList = res.list; renderMemberListTable(res.list, filterType); } 
      else document.getElementById('member-list-tbody').innerHTML = `<tr><td colspan="3" class="text-danger">${res.message}</td></tr>`;
    }).catch(err => document.getElementById('member-list-tbody').innerHTML = `<tr><td colspan="3" class="text-danger">撈取失敗</td></tr>`);
}
function renderMemberListTable(list, currentFilter) {
  const tbody = document.getElementById('member-list-tbody');
  if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">無符合條件的會友</td></tr>'; return; }
  
  let html = '';
  list.forEach((user, index) => {
    let badgeClass = user.tier === 'Tier 2' ? 'success' : (user.tier === 'Tier 1' ? 'primary' : 'secondary');
    html += `<tr>
      <td class="text-start"><div class="fw-bold text-dark">${user.name}</div><div class="text-muted" style="font-size:0.8rem">${user.phone}</div></td>
      <td><span class="badge bg-${badgeClass} mb-1">${user.tier}</span><br><span class="text-muted" style="font-size:0.75rem">${user.service || '無服事'} / ${user.groups || '無團契'}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary mb-1" onclick="editUserSimple(${index}, '${currentFilter}')"><i class="fas fa-edit"></i> 簡易修改</button>
        <button class="btn btn-sm btn-outline-info mb-1" onclick="directMessageUser('${user.uid}', '${user.name}')"><i class="fas fa-comment-dots"></i> 私訊</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function editUserSimple(index, currentFilter) {
  getMemberModal().hide();
  let user = currentModalList[index];
  Swal.fire({
    title: `快速調整等級：${user.name}`,
    html: `
      <div class="text-start mt-2">
        <label class="form-label fw-bold text-primary">帳號等級</label>
        <select id="edit-tier" class="form-select mb-3">
          <option value="Tier 0" ${user.tier === 'Tier 0' ? 'selected' : ''}>Tier 0 (一般未綁定)</option>
          <option value="Tier 1" ${user.tier === 'Tier 1' ? 'selected' : ''}>Tier 1 (已綁定)</option>
          <option value="Tier 2" ${user.tier === 'Tier 2' ? 'selected' : ''}>Tier 2 (財務驗證)</option>
        </select>
        <div class="alert alert-light text-muted p-2" style="font-size:0.85rem;">
          <i class="fas fa-info-circle text-primary"></i> 若需調整團契或服事單位，請前往「會友」分頁使用完整編輯功能。
        </div>
      </div>`,
    showCancelButton: true, confirmButtonText: '儲存', cancelButtonText: '取消', confirmButtonColor: '#28a745'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify({ 
          action: 'adminUpdateUser', adminUid: currentUID, targetUid: user.uid, 
          tier: document.getElementById('edit-tier').value, 
          service: user.service, 
          groups: user.groups 
        }) 
      })
      .then(res => res.json()).then(res => {
        if (res.success) Swal.fire('成功', '資料已更新', 'success').then(() => showMemberList(currentFilter));
        else Swal.fire('錯誤', res.message, 'error').then(() => getMemberModal().show());
      });
    } else getMemberModal().show();
  });
}

function directMessageUser(targetUid, targetName) {
  if (memberModalInstance) getMemberModal().hide();
  Swal.fire({
    title: `💬 私訊給 ${targetName}`, input: 'textarea', inputPlaceholder: '支援使用 {name} 變數...',
    showCancelButton: true, confirmButtonText: '確定發送', confirmButtonColor: '#8e44ad',
    preConfirm: (text) => { if (!text || text.trim() === '') Swal.showValidationMessage('內容不能為空喔！'); return text.trim(); }
  }).then((result) => {
    if (result.isConfirmed) {
      let finalMsg = result.value.replace(/{name}/g, targetName);
      Swal.fire({ title: '發送中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'sendBroadcast', uid: currentUID, targetGroup: 'UID:' + targetUid, messageContent: finalMsg, attachEventId: '無' }) })
      .then(res => res.json()).then(res => {
        if (res.success) Swal.fire('發送成功！', `已成功發送給 ${targetName}。`, 'success').then(() => { if (memberModalInstance) getMemberModal().show(); });
        else Swal.fire('發送失敗', res.message, 'error').then(() => { if (memberModalInstance) getMemberModal().show(); });
      });
    } else { if (memberModalInstance) getMemberModal().show(); }
  });
}

// ==========================================
// 全教會名單與進階編輯器 (Tab 5 專用)
// ==========================================
function loadAllMembers() {
  document.getElementById('full-member-loading').style.display = 'block';
  document.getElementById('full-member-list').style.display = 'none';

  const filterGroup = document.getElementById('filter-group');
  filterGroup.innerHTML = '<option value="">所有團契</option>';
  if (adminData.availableGroups) {
    adminData.availableGroups.forEach(g => filterGroup.innerHTML += `<option value="${g}">${g}</option>`);
  }

  fetch(`${GAS_URL}?action=getAllMembers&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      document.getElementById('full-member-loading').style.display = 'none';
      if (res.success) {
        allMembersCache = res.list;
        filterFullMemberList(); 
        
        if (adminData.adminLevel === "超級管理員") {
           const roleSelect = document.getElementById('role-user-select');
           roleSelect.innerHTML = '<option value="">請選擇要升級的會友...</option>';
           allMembersCache.forEach(u => {
              let tail = u.phone.length > 3 ? u.phone.slice(-3) : u.phone;
              roleSelect.innerHTML += `<option value="${u.uid}">${u.name} (尾碼 ${tail})</option>`;
           });
        }
      } else {
        document.getElementById('full-member-list').innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
        document.getElementById('full-member-list').style.display = 'block';
      }
    }).catch(err => {
      document.getElementById('full-member-loading').style.display = 'none';
      document.getElementById('full-member-list').innerHTML = `<div class="alert alert-danger">連線失敗</div>`;
      document.getElementById('full-member-list').style.display = 'block';
    });
}

function filterFullMemberList() {
  const searchInput = document.getElementById('member-search-input').value.trim().toLowerCase();
  const keywords = searchInput ? searchInput.split(/\s+/) : []; 
  const tFilter = document.getElementById('filter-tier').value;
  const gFilter = document.getElementById('filter-group').value;
  const bFilter = document.getElementById('filter-baptism').value;

  const filtered = allMembersCache.filter(u => {
    let match = true;
    if (keywords.length > 0) {
      const searchStr = u.name.toLowerCase() + " " + String(u.phone);
      let allKwMatch = keywords.every(kw => searchStr.includes(kw));
      if (!allKwMatch) match = false;
    }
    if (tFilter && u.tier !== tFilter) match = false;
    if (gFilter && !String(u.groups).includes(gFilter)) match = false;
    if (bFilter && u.baptism !== bFilter) match = false;
    return match;
  });

  document.getElementById('total-member-count').innerText = `共 ${filtered.length} 人`;
  const container = document.getElementById('full-member-list');
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">查無符合條件的會友</div>';
  } else {
    filtered.forEach(u => {
      let bClass = u.tier === 'Tier 2' ? 'success' : (u.tier === 'Tier 1' ? 'primary' : 'secondary');
      container.innerHTML += `
        <div class="list-group-item p-3 border-bottom border-0">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <h6 class="fw-bold text-dark mb-0">${u.name} <span class="badge bg-${bClass} ms-1" style="font-size:0.6rem;">${u.tier}</span></h6>
            <div class="text-muted" style="font-size:0.75rem;">UID: <span style="font-family:monospace;">${u.uid.substring(0,8)}...</span> <i class="fas fa-copy text-primary ms-1" style="cursor:pointer;" onclick="copyUID('${u.uid}')" title="複製完整 UID"></i></div>
          </div>
          <div class="text-muted mb-2" style="font-size:0.85rem;">
            <i class="fas fa-phone-alt w-20px"></i> ${u.phone} | <i class="fas fa-birthday-cake w-20px"></i> ${u.birthday || '未填寫'} <br>
            <i class="fas fa-church w-20px"></i> 團契: ${u.groups || '無'} | 服事: ${u.service || '無'} <br>
            <i class="fas fa-hand-holding-usd w-20px"></i> 奉獻編號: ${u.donationCode || '無'} 
          </div>
          <div class="text-end mt-2">
            <button class="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-sm" onclick='openFullEditModal(${JSON.stringify(u)})'><i class="fas fa-user-edit"></i> 完整編輯</button>
            <button class="btn btn-sm btn-outline-info rounded-pill px-3 shadow-sm" onclick="directMessageUser('${u.uid}', '${u.name}')"><i class="fas fa-paper-plane"></i> 私訊</button>
          </div>
        </div>
      `;
    });
  }
  container.style.display = 'block';
}

function copyUID(uid) {
  navigator.clipboard.writeText(uid).then(() => {
    Swal.fire({title: '已複製 UID', text: uid, icon: 'success', timer: 1500, showConfirmButton: false});
  });
}

function openFullEditModal(userObj) {
  let groupHtml = '';
  if (adminData.availableGroups) {
    let uGrps = (userObj.groups || "").split('、').map(x=>x.trim());
    adminData.availableGroups.forEach((g, idx) => {
      let chk = uGrps.includes(g) ? 'checked' : '';
      groupHtml += `<div class="form-check form-check-inline"><input class="form-check-input fw-group-chk" type="checkbox" value="${g}" id="fgc-${idx}" ${chk}><label class="form-check-label" for="fgc-${idx}">${g}</label></div>`;
    });
  }
  
  let srvHtml = '';
  if (adminData.availableServices) {
    let uSrvs = (userObj.service || "").split('、').map(x=>x.trim());
    adminData.availableServices.forEach((s, idx) => {
      let chk = uSrvs.includes(s) ? 'checked' : '';
      srvHtml += `<div class="form-check form-check-inline"><input class="form-check-input fw-srv-chk" type="checkbox" value="${s}" id="fsc-${idx}" ${chk}><label class="form-check-label" for="fsc-${idx}">${s}</label></div>`;
    });
  }

  Swal.fire({
    title: '編輯完整個資',
    width: '600px',
    html: `
      <div class="text-start" style="font-size:0.9rem;">
        <div class="row g-2 mb-2">
          <div class="col-6"><label class="fw-bold">姓名</label><input type="text" id="fu-name" class="form-control form-control-sm" value="${userObj.name}"></div>
          <div class="col-6"><label class="fw-bold">電話</label><input type="text" id="fu-phone" class="form-control form-control-sm" value="${userObj.phone}"></div>
        </div>
        <div class="row g-2 mb-2">
          <div class="col-6"><label class="fw-bold">生日 (YYYY-MM-DD)</label><input type="text" id="fu-birthday" class="form-control form-control-sm" value="${userObj.birthday}"></div>
          <div class="col-6"><label class="fw-bold">洗禮狀態</label>
            <select id="fu-baptism" class="form-select form-select-sm">
              <option value="慕道友" ${userObj.baptism==='慕道友'?'selected':''}>慕道友</option>
              <option value="小兒洗禮" ${userObj.baptism==='小兒洗禮'?'selected':''}>小兒洗禮</option>
              <option value="堅信禮" ${userObj.baptism==='堅信禮'?'selected':''}>堅信禮</option>
              <option value="成人洗禮" ${userObj.baptism==='成人洗禮'?'selected':''}>成人洗禮</option>
            </select>
          </div>
        </div>
        <div class="row g-2 mb-2">
          <div class="col-6"><label class="fw-bold">帳號等級 (Tier)</label>
            <select id="fu-tier" class="form-select form-select-sm">
              <option value="Tier 0" ${userObj.tier==='Tier 0'?'selected':''}>Tier 0 (一般用戶)</option>
              <option value="Tier 1" ${userObj.tier==='Tier 1'?'selected':''}>Tier 1 (已綁定)</option>
              <option value="Tier 2" ${userObj.tier==='Tier 2'?'selected':''}>Tier 2 (財務驗證)</option>
            </select>
          </div>
          <div class="col-6"><label class="fw-bold">奉獻代碼</label><input type="text" id="fu-donation" class="form-control form-control-sm" value="${userObj.donationCode}"></div>
        </div>
        <div class="row g-2 mb-3">
          <div class="col-6"><label class="fw-bold">家庭編號</label><input type="text" id="fu-family" class="form-control form-control-sm" value="${userObj.familyId}"></div>
          <div class="col-6"><label class="fw-bold">全戶視角權限</label>
            <select id="fu-famView" class="form-select form-select-sm">
              <option value="false" ${String(userObj.familyView)==='false'?'selected':''}>關閉</option>
              <option value="true" ${String(userObj.familyView)==='true'?'selected':''}>開啟 (可看全家奉獻)</option>
            </select>
          </div>
        </div>
        <div class="mb-2"><label class="fw-bold text-primary border-bottom w-100 mb-1">所屬團契/牧區 (可多選)</label><div>${groupHtml}</div></div>
        <div class="mb-2"><label class="fw-bold text-success border-bottom w-100 mb-1">參與服事單位 (可多選)</label><div>${srvHtml}</div></div>
      </div>
    `,
    showCancelButton: true, confirmButtonText: '確定儲存', cancelButtonText: '取消', confirmButtonColor: '#8e44ad'
  }).then((result) => {
    if (result.isConfirmed) {
      let gArr = []; document.querySelectorAll('.fw-group-chk:checked').forEach(c => gArr.push(c.value));
      let sArr = []; document.querySelectorAll('.fw-srv-chk:checked').forEach(c => sArr.push(c.value));
      
      let payload = {
        uid: userObj.uid,
        name: document.getElementById('fu-name').value.trim(),
        phone: document.getElementById('fu-phone').value.trim(),
        birthday: document.getElementById('fu-birthday').value.trim(),
        baptism: document.getElementById('fu-baptism').value,
        tier: document.getElementById('fu-tier').value,
        donationCode: document.getElementById('fu-donation').value.trim(),
        familyId: document.getElementById('fu-family').value.trim(),
        familyView: document.getElementById('fu-famView').value === 'true',
        groups: gArr.join('、'),
        service: sArr.join('、')
      };

      Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'adminUpdateFullUser', adminUid: currentUID, userData: payload }) })
        .then(res => res.json()).then(res => {
          if (res.success) Swal.fire('成功', res.message, 'success').then(() => loadAllMembers());
          else Swal.fire('錯誤', res.message, 'error');
        }).catch(err => Swal.fire('錯誤', err.message, 'error'));
    }
  });
}

function submitFinanceCSV() {
  const text = document.getElementById('finance-csv-input').value.trim();
  if(!text) { Swal.fire('提醒', '請先貼上 CSV 內容！', 'warning'); return; }
  
  Swal.fire({ title: '上傳處理中', text: '正在將資料匯入財務庫...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'uploadFinanceCSV', adminUid: currentUID, csvText: text }) })
    .then(res => res.json()).then(res => {
      if(res.success) { Swal.fire('匯入成功', res.message, 'success'); document.getElementById('finance-csv-input').value = ''; }
      else Swal.fire('匯入失敗', res.message, 'error');
    }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
}

// ==========================================
// 權限管理控管 (Tab 6，僅超級管理員可見)
// ==========================================
function loadAdminRoles() {
  document.getElementById('admin-role-loading').style.display = 'block';
  document.getElementById('admin-role-table').style.display = 'none';

  fetch(`${GAS_URL}?action=getAdminRoles&uid=${currentUID}`)
    .then(res => res.json()).then(res => {
      document.getElementById('admin-role-loading').style.display = 'none';
      if (res.success) {
        adminRolesCache = res.list;
        let tbody = document.getElementById('admin-role-tbody');
        tbody.innerHTML = '';
        res.list.forEach(a => {
          let bClass = a.status === '已啟用' ? 'success' : 'secondary';
          let levelIcon = a.level.includes("最高") ? "🦅" : (a.level.includes("活動") ? "🎟️" : (a.level.includes("財務") ? "💰" : "📋"));
          if(a.level === "超級管理員") levelIcon = "👑";

          let actionHtml = `<i class="fas fa-bell fa-lg text-info mx-2" style="cursor:pointer;" onclick="editAdminNotif('${a.uid}', '${a.name}', '${a.notifications}')" title="設定推播通知"></i>`;
          
          if (a.level !== "超級管理員") {
            let toggleIcon = a.status === '已啟用' ? 'fa-ban text-warning' : 'fa-check-circle text-success';
            actionHtml += `
              <i class="fas ${toggleIcon} fa-lg mx-2" style="cursor:pointer;" onclick="manageAdminRole('${a.uid}', 'toggle')" title="切換狀態"></i>
              <i class="fas fa-trash-alt fa-lg text-danger mx-2" style="cursor:pointer;" onclick="manageAdminRole('${a.uid}', 'remove')" title="刪除權限"></i>
            `;
          } else {
            actionHtml += `<span class="text-muted ms-2" style="font-size:0.7rem;">(預設不可刪)</span>`;
          }

          tbody.innerHTML += `
            <tr>
              <td class="text-start fw-bold text-dark">
                ${a.name}<br>
                <span class="text-muted" style="font-size:0.7rem;"><i class="fas fa-bullhorn"></i> ${a.notifications || '無'}</span>
              </td>
              <td class="text-primary">${levelIcon} ${a.level}</td>
              <td><span class="badge bg-${bClass}">${a.status}</span></td>
              <td>${actionHtml}</td>
            </tr>`;
        });
        document.getElementById('admin-role-table').style.display = 'table';
      }
    });
}

function editAdminNotif(uid, name, currentNotifs) {
  let nArr = currentNotifs ? currentNotifs.split('、') : [];
  let c1 = nArr.includes('新用戶通知') ? 'checked' : '';
  let c2 = nArr.includes('財務驗證通知') ? 'checked' : '';
  let c3 = nArr.includes('代禱通知') ? 'checked' : '';
  let c4 = nArr.includes('活動報名通知') ? 'checked' : '';

  Swal.fire({
    title: `🔔 推播設定：${name}`,
    html: `
      <div class="text-start px-3 mt-3">
        <p class="text-muted mb-3" style="font-size: 0.85rem;">請勾選該同工需要接收的系統即時通知：</p>
        <div class="form-check mb-3"><input class="form-check-input edit-notif-chk shadow-sm" type="checkbox" value="新用戶通知" id="en1" ${c1}><label class="form-check-label fw-bold text-dark" for="en1">新用戶註冊</label></div>
        <div class="form-check mb-3"><input class="form-check-input edit-notif-chk shadow-sm" type="checkbox" value="財務驗證通知" id="en2" ${c2}><label class="form-check-label fw-bold text-dark" for="en2">財務開通申請</label></div>
        <div class="form-check mb-3"><input class="form-check-input edit-notif-chk shadow-sm" type="checkbox" value="代禱通知" id="en3" ${c3}><label class="form-check-label fw-bold text-dark" for="en3">新代禱事項</label></div>
        <div class="form-check mb-3"><input class="form-check-input edit-notif-chk shadow-sm" type="checkbox" value="活動報名通知" id="en4" ${c4}><label class="form-check-label fw-bold text-dark" for="en4">新活動報名</label></div>
      </div>
    `,
    showCancelButton: true, confirmButtonText: '儲存設定', cancelButtonText: '取消', confirmButtonColor: '#8e44ad',
    preConfirm: () => {
      let sel = [];
      document.querySelectorAll('.edit-notif-chk:checked').forEach(c => sel.push(c.value));
      return sel.length > 0 ? sel.join('、') : '無';
    }
  }).then(result => {
    if(result.isConfirmed) {
      Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify({ 
          action: 'manageAdminRole', adminUid: currentUID, targetUid: uid, 
          targetName: '', roleLevel: '', notifications: result.value, manageAction: 'update_notif' 
        }) 
      }).then(res => res.json()).then(res => {
        if(res.success) Swal.fire('成功', res.message, 'success').then(() => loadAdminRoles());
        else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function assignAdminRole() {
  const selectEl = document.getElementById('role-user-select');
  const uid = selectEl.value;
  const nameText = selectEl.options[selectEl.selectedIndex].text.split(' (')[0]; 
  const level = document.getElementById('role-level-select').value;
  
  if (!uid) { Swal.fire('提醒', '請先從清單中選擇一位會友！', 'warning'); return; }
  
  let notifs = [];
  document.querySelectorAll('.role-notif-chk:checked').forEach(c => notifs.push(c.value));
  let notifStr = notifs.length > 0 ? notifs.join('、') : '無';

  Swal.fire({
    title: '指派確認', html: `確定要將 <b>${nameText}</b> 設為 <b class="text-danger">${level}</b> 嗎？<br><small class="text-muted">通知：${notifStr}</small>`, icon: 'question',
    showCancelButton: true, confirmButtonColor: '#c0392b', confirmButtonText: '確定指派'
  }).then(result => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify({ 
          action: 'manageAdminRole', adminUid: currentUID, targetUid: uid, targetName: nameText, 
          roleLevel: level, notifications: notifStr, manageAction: 'add' 
        }) 
      })
      .then(res => res.json()).then(res => {
        if (res.success) Swal.fire('成功', res.message, 'success').then(() => loadAdminRoles());
        else Swal.fire('失敗', res.message, 'error');
      }).catch(err => Swal.fire('錯誤', err.message, 'error'));
    }
  });
}

function manageAdminRole(targetUid, actionType) {
  let title = actionType === 'remove' ? '確定撤銷該同工的後台權限嗎？' : '確定要切換該同工的啟用狀態嗎？';
  Swal.fire({
    title: title, icon: 'warning', showCancelButton: true, confirmButtonColor: '#c0392b', confirmButtonText: '確定執行'
  }).then(result => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'manageAdminRole', adminUid: currentUID, targetUid: targetUid, targetName: '', roleLevel: '', notifications: '', manageAction: actionType }) })
        .then(res => res.json()).then(res => {
          if (res.success) Swal.fire('成功', res.message, 'success').then(() => loadAdminRoles());
          else Swal.fire('失敗', res.message, 'error');
        }).catch(err => Swal.fire('錯誤', err.message, 'error'));
    }
  });
}

// ==========================================
// 【回合 B】活動報表與 ERP 管理引擎 (Tab 2)
// ==========================================

// 切換「名單報表」與「新增活動」面板
function toggleEventView(viewType) {
  document.getElementById('btn-toggle-report').classList.remove('active');
  document.getElementById('btn-toggle-create').classList.remove('active');
  document.getElementById('event-report-view').style.display = 'none';
  document.getElementById('event-create-view').style.display = 'none';
  
  if(viewType === 'report') {
    document.getElementById('btn-toggle-report').classList.add('active');
    document.getElementById('event-report-view').style.display = 'block';
  } else {
    document.getElementById('btn-toggle-create').classList.add('active');
    document.getElementById('event-create-view').style.display = 'block';
  }
}

function loadAdminEventList() {
  fetch(`${GAS_URL}?action=getAdminEventList&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      if (res.success && res.list.length > 0) {
        let sel = document.getElementById('report-event-select');
        res.list.forEach(e => { 
          // 【回合 B 新增】在下拉選單直接顯示目前報名人數與總名額
          sel.innerHTML += `<option value="${e.id}">${e.start} - ${e.name} (${e.status}) [${e.currentRegs}/${e.capacity}]</option>`; 
        });
      }
    });
}

function loadEventReport() {
  let eventId = document.getElementById('report-event-select').value;
  if (!eventId) { Swal.fire('提醒', '請先選擇一個要檢視的活動報表！', 'warning'); return; }
  document.getElementById('print-section').style.display = 'none';
  Swal.fire({ title: '撈取名單中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  fetch(`${GAS_URL}?action=getAdminEventRegistrations&uid=${currentUID}&eventId=${eventId}`)
    .then(res => res.json()).then(res => {
      if (res.success) {
        Swal.close();
        document.getElementById('print-section').style.display = 'block';
        document.getElementById('print-event-name').innerText = res.eventInfo.name;
        document.getElementById('print-event-time').innerText = `活動時間：${res.eventInfo.date} | 報名人數：${res.list.length} 人`;
        let tbody = document.getElementById('report-tbody');
        tbody.innerHTML = ''; currentReportData = res.list;
        
        if (res.list.length === 0) { 
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4 fw-bold">目前尚無人報名此活動</td></tr>'; 
        } else {
          res.list.forEach((reg, index) => {
            let attClass = reg.attendance === '已出席' ? 'text-success' : 'text-danger';
            
            // 【回合 B 新增】將繳費狀態變成視覺標籤，並加入操作按鈕
            let payBadge = reg.payStatus === '已繳費' ? '<span class="badge bg-success">已繳費</span>' : (reg.payStatus === '免繳費' ? '<span class="badge bg-secondary">免繳費</span>' : '<span class="badge bg-warning text-dark">未繳費</span>');
            let payBtnClass = reg.payStatus === '已繳費' ? 'btn-success' : 'btn-outline-warning text-dark';
            let payIcon = reg.payStatus === '已繳費' ? 'fa-check-circle' : 'fa-dollar-sign';

            tbody.innerHTML += `<tr>
              <td class="text-center fw-bold">${index + 1}</td>
              <td class="fw-bold text-primary">${reg.participantName}</td>
              <td class="text-center text-muted">${reg.type}</td>
              <td class="text-center">${reg.phone}</td>
              <td class="text-center">${payBadge}</td>
              <td class="text-center fw-bold ${attClass}">${reg.attendance}</td>
              <td class="text-muted" style="font-size:0.75rem">${reg.extraInfo || ''}</td>
              <td class="text-center no-print">
                <button class="btn btn-sm ${payBtnClass} mb-1" onclick="togglePayment('${reg.regId}', ${index})" title="切換繳費狀態"><i class="fas ${payIcon}"></i></button>
                <button class="btn btn-sm btn-outline-primary mb-1" onclick='openEditRegModal(${index})' title="編輯資料"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger mb-1" onclick="deleteReg('${reg.regId}')" title="刪除報名"><i class="fas fa-trash-alt"></i></button>
              </td>
            </tr>`;
          });
        }
      } else { Swal.fire('錯誤', res.message, 'error'); }
    }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
}

// 【回合 B 新增】一鍵切換繳費狀態
function togglePayment(regId, index) {
  Swal.fire({ title: '更新繳費狀態中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'adminTogglePayment', adminUid: currentUID, regId: regId }) })
    .then(res => res.json()).then(res => {
      if(res.success) { 
        Swal.fire({title: '成功', text: res.message, icon: 'success', timer: 1500, showConfirmButton: false}); 
        loadEventReport(); // 重新載入報表
      }
      else Swal.fire('錯誤', res.message, 'error');
    }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
}

// 【回合 B 新增】手動幫無 LINE 會友建檔報名
function openAddRegModal() {
  let eventId = document.getElementById('report-event-select').value;
  if (!eventId) { Swal.fire('提醒', '請先選擇一個活動！', 'warning'); return; }
  
  Swal.fire({
    title: '新增報名者 (後台代報)',
    html: `
      <div class="text-start mt-2">
        <label class="form-label fw-bold text-dark mb-1">姓名 <span class="text-danger">*</span></label>
        <input type="text" id="ar-name" class="form-control mb-3" placeholder="請輸入參與者姓名">
        
        <label class="form-label fw-bold text-dark mb-1">聯絡電話</label>
        <input type="text" id="ar-phone" class="form-control mb-3" placeholder="選填">
        
        <label class="form-label fw-bold text-dark mb-1">自訂選項 / 備註資訊</label>
        <input type="text" id="ar-extra" class="form-control mb-3" placeholder="例如：便當:葷, 需專車接送">
        
        <label class="form-label fw-bold text-dark mb-1">繳費狀態</label>
        <select id="ar-pay" class="form-select border-primary">
          <option value="未繳費">未繳費</option>
          <option value="已繳費">已繳費 (現場收現)</option>
          <option value="免繳費">免繳費</option>
        </select>
      </div>
    `,
    showCancelButton: true, confirmButtonText: '確定新增', cancelButtonText: '取消', confirmButtonColor: '#2ecc71',
    preConfirm: () => {
      let name = document.getElementById('ar-name').value.trim();
      if(!name) { Swal.showValidationMessage('請務必填寫姓名！'); return false; }
      return {
        name: name, 
        phone: document.getElementById('ar-phone').value.trim(),
        extra: document.getElementById('ar-extra').value.trim(), 
        payStatus: document.getElementById('ar-pay').value
      }
    }
  }).then(res => {
    if(res.isConfirmed) {
      Swal.fire({ title: '寫入資料庫中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      let v = res.value;
      fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'adminAddReg', adminUid: currentUID, eventId: eventId, name: v.name, phone: v.phone, extra: v.extra, payStatus: v.payStatus }) 
      }).then(res => res.json()).then(res => {
          if(res.success) Swal.fire('新增成功', res.message, 'success').then(()=>loadEventReport());
          else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

// 【回合 B 新增】修改現有報名資料
function openEditRegModal(index) {
  let reg = currentReportData[index];
  Swal.fire({
    title: '編輯報名資料',
    html: `
      <div class="text-start mt-2">
        <label class="form-label fw-bold text-dark">參與者姓名</label>
        <input type="text" id="er-name" class="form-control mb-3" value="${reg.participantName}">
        <label class="form-label fw-bold text-dark">聯絡電話</label>
        <input type="text" id="er-phone" class="form-control mb-3" value="${reg.phone}">
        <label class="form-label fw-bold text-dark">自訂選項 / 備註資訊</label>
        <input type="text" id="er-extra" class="form-control mb-2" value="${reg.extraInfo || ''}">
      </div>
    `,
    showCancelButton: true, confirmButtonText: '儲存修改', cancelButtonText: '取消', confirmButtonColor: '#3498db'
  }).then(res => {
    if(res.isConfirmed) {
      Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'adminUpdateReg', adminUid: currentUID, regId: reg.regId, name: document.getElementById('er-name').value.trim(), phone: document.getElementById('er-phone').value.trim(), extra: document.getElementById('er-extra').value.trim() }) 
      }).then(res => res.json()).then(res => {
          if(res.success) Swal.fire('成功', res.message, 'success').then(()=>loadEventReport());
          else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

// 【回合 B 新增】強制刪除報名紀錄 (釋放名額)
function deleteReg(regId) {
  Swal.fire({
    title: '確認強制刪除？', 
    text: '刪除後將無法恢復，且會立即釋出報名名額！', 
    icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#e74c3c', confirmButtonText: '是的，強制刪除！'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '刪除中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'adminDeleteReg', adminUid: currentUID, regId: regId }) })
        .then(res => res.json()).then(res => {
          if(res.success) Swal.fire('已刪除', res.message, 'success').then(()=>loadEventReport());
          else Swal.fire('錯誤', res.message, 'error');
        }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function downloadCSV() {
  if (currentReportData.length === 0) { Swal.fire('提醒', '目前沒有資料可以匯出喔！', 'warning'); return; }
  let eventName = document.getElementById('print-event-name').innerText;
  let csvContent = '\uFEFF'; csvContent += "序號,報名時間,報名類型,姓名,聯絡電話,繳費狀態,出席狀態,自訂備註\n";
  currentReportData.forEach((row, index) => {
    let extra = String(row.extraInfo || '').replace(/"/g, '""'); 
    csvContent += `${index+1},${row.regTime},${row.type},${row.participantName},${row.phone},${row.payStatus},${row.attendance},"${extra}"\n`;
  });
  let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  let link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", `霧峰教會_${eventName}_報名名單.csv`);
  link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ==========================================
// 推播通訊中心邏輯 (Tab 3) 
// ==========================================
function loadBroadcastForm() {
  if (!adminData) return;
  const optGroups = document.getElementById('optgroup-groups');
  if (optGroups && adminData.availableGroups) adminData.availableGroups.forEach(g => optGroups.innerHTML += `<option value="Group:${g}">${g}</option>`);
  const optServices = document.getElementById('optgroup-services');
  if (optServices && adminData.availableServices) adminData.availableServices.forEach(s => optServices.innerHTML += `<option value="Service:${s}">${s}</option>`);
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
  if (!msg) { Swal.fire('提醒', '推播內容不能為空喔！', 'warning'); return; }

  let displayTarget = target;
  if (target.startsWith("Group:")) displayTarget = "團契：" + target.replace("Group:", "");
  else if (target.startsWith("Service:")) displayTarget = "服事單位：" + target.replace("Service:", "");
  else if (target.startsWith("Event:")) displayTarget = "活動報名者 (" + target.replace("Event:", "") + ")";
  else if (target.startsWith("Tier ")) displayTarget = "帳號等級：" + target;

  Swal.fire({ title: '發送確認', html: `您即將對 <b class="text-danger">${displayTarget}</b> 發送推播。<br>確定要發送嗎？`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#8e44ad', confirmButtonText: '確定發送'
  }).then((result) => {
    if (result.isConfirmed) {
      const btn = document.getElementById('btn-send-broadcast'); const originalHtml = btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 系統處理中...'; btn.disabled = true;
      fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'sendBroadcast', uid: currentUID, targetGroup: target, messageContent: msg, attachEventId: eventId }) })
      .then(res => res.json()).then(res => {
        btn.innerHTML = originalHtml; btn.disabled = false;
        if (res.success) { Swal.fire('發送成功！', res.message, 'success'); document.getElementById('broadcast-msg').value = ''; document.getElementById('broadcast-event').value = '無'; } 
        else Swal.fire('發送失敗', res.message, 'error');
      }).catch(err => { btn.innerHTML = originalHtml; btn.disabled = false; Swal.fire('連線錯誤', err.message, 'error'); });
    }
  });
}

// ==========================================
// 系統進階設定 (Tab 4)
// ==========================================
function loadSystemSettings() {
  fetch(`${GAS_URL}?action=getSystemSettings&uid=${currentUID}`)
    .then(res => res.json()).then(res => {
      document.getElementById('settings-loading').style.display = 'none';
      if (res.success) {
        document.getElementById('settings-content').style.display = 'block'; const s = res.settings;
        document.getElementById('set-toggle-birthday').checked = (String(s["自動_生日祝福_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-birthday').value = s["自動_生日祝福_模板"] || "";
        document.getElementById('set-toggle-event7').checked = (String(s["自動_活動提醒7天_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-event7').value = s["自動_活動提醒7天_模板"] || "";
        document.getElementById('set-toggle-event3').checked = (String(s["自動_活動提醒3天_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-event3').value = s["自動_活動提醒3天_模板"] || "";
        document.getElementById('set-toggle-event1').checked = (String(s["自動_活動提醒1天_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-event1').value = s["自動_活動提醒1天_模板"] || "";
        document.getElementById('set-toggle-feedback').checked = (String(s["自動_活動回饋_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-feedback').value = s["自動_活動回饋_模板"] || "";
      } else { document.getElementById('settings-loading').innerHTML = `<div class="alert alert-danger">${res.message}</div>`; }
    }).catch(err => { document.getElementById('settings-loading').innerHTML = `<div class="alert alert-danger">連線失敗：${err.message}</div>`; });
}

function saveSystemSettings() {
  const btn = document.getElementById('btn-save-settings'); const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 儲存中...'; btn.disabled = true;
  const settingsObj = {
    "自動_生日祝福_開關": document.getElementById('set-toggle-birthday').checked ? "TRUE" : "FALSE", "自動_生日祝福_模板": document.getElementById('set-tpl-birthday').value.trim(),
    "自動_活動提醒7天_開關": document.getElementById('set-toggle-event7').checked ? "TRUE" : "FALSE", "自動_活動提醒7天_模板": document.getElementById('set-tpl-event7').value.trim(),
    "自動_活動提醒3天_開關": document.getElementById('set-toggle-event3').checked ? "TRUE" : "FALSE", "自動_活動提醒3天_模板": document.getElementById('set-tpl-event3').value.trim(),
    "自動_活動提醒1天_開關": document.getElementById('set-toggle-event1').checked ? "TRUE" : "FALSE", "自動_活動提醒1天_模板": document.getElementById('set-tpl-event1').value.trim(),
    "自動_活動回饋_開關": document.getElementById('set-toggle-feedback').checked ? "TRUE" : "FALSE", "自動_活動回饋_模板": document.getElementById('set-tpl-feedback').value.trim()
  };
  fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'saveSystemSettings', uid: currentUID, settings: settingsObj }) })
  .then(res => res.json()).then(res => {
    btn.innerHTML = originalHtml; btn.disabled = false;
    if (res.success) Swal.fire({ title: '儲存成功', text: '排程設定已更新！', icon: 'success', timer: 2000, showConfirmButton: false });
    else Swal.fire('儲存失敗', res.message, 'error');
  }).catch(err => { btn.innerHTML = originalHtml; btn.disabled = false; Swal.fire('連線錯誤', err.message, 'error'); });
}
