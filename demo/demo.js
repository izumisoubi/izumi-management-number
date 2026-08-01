(function(){
  'use strict';

  const DEMO_EMAIL='demo@izumi-system.jp';
  const DEMO_PASSWORD_HASH='afb6e2833e720bc80bb5a91e2900f33a871502ad6b6432f68a600bb418f1dfd5';
  const SESSION_KEY='izumi_sales_demo_session';
  const DATA_KEY='izumi_sales_demo_projects_v2';
  const seed=globalThis.IZUMI_DEMO_DATA;
  const $=id=>document.getElementById(id);
  const yen=value=>'¥'+Math.round(Number(value)||0).toLocaleString('ja-JP');
  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const isoLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.replace(/-/g,'.'):value;

  let projects=loadProjects();
  let activeProject=null;
  let activeTab='summary';

  function loadProjects(){
    try{
      const stored=JSON.parse(localStorage.getItem(DATA_KEY)||'null');
      if(Array.isArray(stored)&&stored.length===20)return stored;
    }catch(_error){}
    return clone(seed.projects);
  }

  function saveProjects(){localStorage.setItem(DATA_KEY,JSON.stringify(projects))}

  async function sha256(value){
    const bytes=new TextEncoder().encode(value);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }

  function showApp(){
    $('loginScreen').classList.add('hidden');
    $('application').classList.remove('hidden');
    populateFilters();
    render();
    const requestedView=new URLSearchParams(location.search).get('view');
    setView(requestedView==='projects'?'projects':'menu');
  }

  function setView(view){
    const projectsVisible=view==='projects';
    $('menuView').classList.toggle('hidden',projectsVisible);
    $('projectView').classList.toggle('hidden',!projectsVisible);
    document.querySelectorAll('[data-view]').forEach(control=>control.classList.toggle('active',control.dataset.view===view));
    if(projectsVisible)render();
    scrollTo({top:0,behavior:'smooth'});
  }

  document.querySelectorAll('[data-view]').forEach(control=>control.addEventListener('click',event=>{
    event.preventDefault();
    setView(control.dataset.view);
  }));

  function showLogin(){
    $('application').classList.add('hidden');
    $('detailBackdrop').classList.add('hidden');
    $('loginScreen').classList.remove('hidden');
    $('loginPassword').value='';
    setTimeout(()=>$('loginEmail').focus(),0);
  }

  $('loginForm').addEventListener('submit',async event=>{
    event.preventDefault();
    $('loginError').textContent='確認中です…';
    const email=$('loginEmail').value.trim().toLowerCase();
    const passwordHash=await sha256($('loginPassword').value);
    if(email!==DEMO_EMAIL||passwordHash!==DEMO_PASSWORD_HASH){
      $('loginError').textContent='デモ用のメールアドレスまたはパスワードが違います。';
      return;
    }
    sessionStorage.setItem(SESSION_KEY,'active');
    $('loginError').textContent='';
    showApp();
  });

  $('logoutButton').addEventListener('click',()=>{sessionStorage.removeItem(SESSION_KEY);showLogin()});

  function populateFilters(){
    const statuses=[...new Set(projects.map(project=>project.status))];
    const staff=[...new Set(projects.map(project=>project.staff))];
    const statusValue=$('statusFilter').value,staffValue=$('staffFilter').value;
    $('statusFilter').innerHTML='<option value="">すべて</option>'+statuses.map(value=>`<option>${esc(value)}</option>`).join('');
    $('staffFilter').innerHTML='<option value="">全担当者</option>'+staff.map(value=>`<option>${esc(value)}</option>`).join('');
    $('statusFilter').value=statuses.includes(statusValue)?statusValue:'';
    $('staffFilter').value=staff.includes(staffValue)?staffValue:'';
  }

  function filteredProjects(){
    const search=$('searchInput').value.trim().toLowerCase();
    const status=$('statusFilter').value,staff=$('staffFilter').value;
    return projects.filter(project=>{
      const haystack=[project.managementNo,project.staff,project.customer,project.property,project.room,project.work].join(' ').toLowerCase();
      return (!search||haystack.includes(search))&&(!status||project.status===status)&&(!staff||project.staff===staff);
    });
  }

  function statusClass(status){
    if(status==='入金済')return 'paid';
    if(status==='請求済')return 'invoice';
    if(status==='工事完了')return 'done';
    if(['工事中','発注済'].includes(status))return 'active';
    return 'estimate';
  }

  function renderStats(rows){
    const sum=key=>rows.reduce((total,row)=>total+Number(row[key]||0),0);
    $('statCount').textContent=`${rows.length}件`;
    $('statSales').textContent=yen(sum('salesEx'));
    $('statCost').textContent=yen(sum('costEx')+sum('selfLabor')+sum('selfMaterial'));
    $('statProfit').textContent=yen(sum('grossProfit'));
    $('statUnpaid').textContent=`${rows.filter(row=>row.paymentStatus==='未入金').length}件`;
  }

  function render(){
    const rows=filteredProjects();
    renderStats(rows);
    $('projectRows').innerHTML=rows.map(project=>`<tr>
      <td><span class="management-no">${esc(project.managementNo)}</span><span class="subtext">${esc(project.accountingMonth)}計上</span></td>
      <td>${esc(isoLabel(project.receptionDate))}</td>
      <td>${esc(project.staff)}</td>
      <td><span class="property">${esc(project.property)} ${esc(project.room)}</span><span class="subtext">${esc(project.address)}</span></td>
      <td>${esc(project.work)}</td>
      <td><span class="status ${statusClass(project.status)}">${esc(project.status)}</span></td>
      <td>${esc(project.customer)}<span class="subtext">${esc(project.customerContact)}</span></td>
      <td class="money sale">${yen(project.salesEx)}</td>
      <td class="money cost">${yen(project.costEx+project.selfLabor+project.selfMaterial)}</td>
      <td class="money profit">${yen(project.grossProfit)}<span class="subtext">${project.margin}%</span></td>
      <td><span class="status ${project.paymentStatus==='入金済'?'paid':'invoice'}">${esc(project.paymentStatus)}</span></td>
      <td><span class="row-actions"><button class="button small" type="button" data-open="${esc(project.id)}">詳細</button><a class="button small primary" href="estimate/?managementNo=${encodeURIComponent(project.managementNo)}">見積を開く</a></span></td>
    </tr>`).join('');
    $('emptyState').classList.toggle('hidden',rows.length>0);
  }

  ['searchInput','statusFilter','staffFilter'].forEach(id=>$(id).addEventListener(id==='searchInput'?'input':'change',render));

  $('projectRows').addEventListener('click',event=>{
    const button=event.target.closest('[data-open]');
    if(!button)return;
    openDetail(button.dataset.open);
  });

  document.querySelectorAll('[data-locked]').forEach(button=>button.addEventListener('click',()=>alert('デモ環境ではこの機能をロックしています。管理者設定・新規登録は本番環境だけで利用できます。')));

  $('resetButton').addEventListener('click',()=>{
    if(!confirm('デモで変更した内容を消し、20件の初期データへ戻しますか？'))return;
    projects=clone(seed.projects);
    saveProjects();
    populateFilters();
    render();
  });

  const tabs=[['summary','基本情報'],['estimate','見積'],['order','発注'],['cost','原価'],['invoice','請求・入金'],['completion','完了報告']];

  function openDetail(id){
    activeProject=projects.find(project=>project.id===id);
    if(!activeProject)return;
    activeTab='summary';
    $('detailHeading').textContent=`${activeProject.managementNo}｜${activeProject.property} ${activeProject.room}`;
    $('detailSubheading').textContent=`${activeProject.customer}　／　${activeProject.work}　／　担当 ${activeProject.staff}`;
    $('openFullEstimate').href=`estimate/?managementNo=${encodeURIComponent(activeProject.managementNo)}`;
    $('detailBackdrop').classList.remove('hidden');
    document.body.style.overflow='hidden';
    renderDetail();
  }

  function closeDetail(){
    $('detailBackdrop').classList.add('hidden');
    document.body.style.overflow='';
    activeProject=null;
  }

  $('closeDetail').addEventListener('click',closeDetail);
  $('detailBackdrop').addEventListener('click',event=>{if(event.target===$('detailBackdrop'))closeDetail()});
  addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('detailBackdrop').classList.contains('hidden'))closeDetail()});

  function renderTabs(){
    $('detailTabs').innerHTML=tabs.map(([key,label])=>`<button type="button" class="tab ${activeTab===key?'active':''}" data-tab="${key}">${label}</button>`).join('');
  }

  $('detailTabs').addEventListener('click',event=>{
    const tab=event.target.closest('[data-tab]');
    if(!tab)return;
    activeTab=tab.dataset.tab;
    renderDetail();
  });

  function definition(entries){return `<dl class="definition">${entries.map(([term,value])=>`<dt>${esc(term)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>`}

  function profitFlow(project){return `<div class="profit-flow">
    <div class="flow-card sales"><span>売上（税抜）</span><strong>${yen(project.salesEx)}</strong><small>税込 ${yen(project.salesIn)}</small></div>
    <div class="flow-card cost"><span>明細原価</span><strong>${yen(project.costEx)}</strong><small>売上比 ${Math.round(project.costEx/project.salesEx*1000)/10}%</small></div>
    <div class="flow-card"><span>自社原価・紹介料</span><strong>${yen(project.selfLabor+project.selfMaterial+project.referralFee)}</strong><small>人工・資材・紹介料</small></div>
    <div class="flow-card profit"><span>粗利益</span><strong>${yen(project.grossProfit)}</strong><small>利益率 ${project.margin}%</small></div>
  </div>`}

  function lineTable(project,mode='estimate'){
    const customer=mode!=='order';
    return `<table class="detail-table"><thead><tr><th>No.</th><th>名称</th><th>仕様</th><th>数量</th><th>単位</th>${customer?'<th class="r">客先金額</th>':''}<th class="r">原価・発注額</th><th>業者</th><th>備考</th></tr></thead><tbody>${project.lines.map(line=>`<tr><td>${line.no}</td><td>${esc(line.name)}</td><td>${esc(line.spec)}</td><td class="r">${line.quantity}</td><td>${esc(line.unit)}</td>${customer?`<td class="r">${yen(line.customerAmount)}</td>`:''}<td class="r">${yen(line.costAmount)}</td><td>${esc(line.vendor)}</td><td>${esc(line.note)}</td></tr>`).join('')}</tbody></table>`;
  }

  function timeline(project){
    const order=['見積作成','見積承認','発注済','工事中','工事完了','請求済','入金済'];
    const current=Math.max(0,order.indexOf(project.status));
    return `<div class="timeline">${order.slice(0,6).map((label,index)=>`<div class="timeline-step ${index<=current?'complete':''}">${label}</div>`).join('')}</div>`;
  }

  function summaryHtml(project){return `<div class="summary-grid"><div class="card"><h3>案件・基本情報</h3>${definition([
    ['管理番号',project.managementNo],['受付日',isoLabel(project.receptionDate)],['工事担当者',project.staff],['取引先',`${project.customer}　${project.customerContact}`],['物件',`${project.property} ${project.room}`],['現場住所',project.address],['作業件名',project.work],['工期',`${isoLabel(project.startDate)} ～ ${isoLabel(project.endDate)}`],['備考',project.note]
  ])}</div><div><div class="card"><h3>進捗</h3>${timeline(project)}<div style="padding:0 13px 13px"><label class="control"><span style="display:block;font-size:10px;font-weight:800;color:#65738a;margin-bottom:4px">デモ操作：進捗を変更</span><select id="demoStatusEdit" style="width:100%;padding:9px;border:1px solid #c4d1e2;border-radius:8px">${[...new Set(projects.map(row=>row.status))].map(status=>`<option ${status===project.status?'selected':''}>${esc(status)}</option>`).join('')}</select></label></div></div><div class="callout" style="margin-top:12px">この変更はデモ端末内だけに保存されます。「初期状態へ戻す」で20案件を復元できます。本番データには一切反映されません。</div></div></div><div class="card" style="margin-top:14px"><h3>利益の構成</h3>${profitFlow(project)}</div>`}

  function renderDetail(){
    if(!activeProject)return;
    renderTabs();
    const project=activeProject;
    let html='';
    if(activeTab==='summary')html=summaryHtml(project);
    if(activeTab==='estimate')html=`<div class="card"><h3>${esc(project.estimateNo)}　見積日 ${esc(isoLabel(project.estimateDate))}</h3>${lineTable(project)}</div><div class="card" style="margin-top:12px"><h3>見積条件</h3>${definition([['有効期限',project.estimateValidity],['支払条件',project.paymentTerms],['施工条件',project.constructionCondition],['写真撮り',project.photoInstruction]])}</div>`;
    if(activeTab==='order')html=`<div class="card"><h3>発注情報</h3>${definition([['発注番号',project.orderNo],['発注状態',project.orderStatus],['主な業者',project.vendor],['工期',`${isoLabel(project.startDate)} ～ ${isoLabel(project.endDate)}`],['施工条件',project.constructionCondition]])}</div><div class="card" style="margin-top:12px"><h3>発注明細</h3>${lineTable(project,'order')}</div>`;
    if(activeTab==='cost')html=`<div class="card"><h3>売上原価管理</h3>${profitFlow(project)}</div><div class="summary-grid" style="margin-top:12px"><div class="card"><h3>自社原価</h3>${definition([['自社人工',yen(project.selfLabor)],['自社資材',yen(project.selfMaterial)],['紹介料',yen(project.referralFee)],['合計',yen(project.selfLabor+project.selfMaterial+project.referralFee)]])}</div><div class="card"><h3>発注・業者請求</h3>${definition([['発注番号',project.orderNo],['主な業者',project.vendor],['発注額',yen(project.costEx)],['差異','¥0（確認済み）']])}</div></div>`;
    if(activeTab==='invoice')html=`<div class="summary-grid"><div class="card"><h3>請求情報</h3>${definition([['請求番号',project.invoiceNo],['発行日',isoLabel(project.invoiceDate)],['振込期日',isoLabel(project.dueDate)],['請求先',project.customer],['請求金額（税抜）',yen(project.salesEx)],['消費税',yen(project.tax)],['請求金額（税込）',yen(project.salesIn)]])}</div><div class="card"><h3>入金情報</h3>${definition([['状態',project.paymentStatus],['入金日',isoLabel(project.paidDate)],['入金額',project.paymentStatus==='入金済'?yen(project.salesIn):'¥0'],['未入金額',project.paymentStatus==='未入金'?yen(project.salesIn):'¥0'],['計上月',project.accountingMonth]])}</div></div>`;
    if(activeTab==='completion')html=`<div class="summary-grid"><div class="card"><h3>完了報告書</h3>${definition([['管理番号',project.managementNo],['物件・部屋',`${project.property} ${project.room}`],['工事名',project.work],['工期',`${isoLabel(project.startDate)} ～ ${isoLabel(project.endDate)}`],['完了日',isoLabel(project.completedDate)],['作成状況',project.completionStatus]])}</div><div class="card"><h3>写真・確認</h3>${definition([['施工前写真','4枚登録済み'],['施工中写真','6枚登録済み'],['施工後写真','5枚登録済み'],['受領確認',project.completedDate==='未完了'?'工事完了後に確認':'確認済み'],['備考',project.note]])}</div></div>`;
    $('detailBody').innerHTML=html;
    $('demoStatusEdit')?.addEventListener('change',event=>{
      project.status=event.target.value;
      saveProjects();
      populateFilters();
      render();
      renderDetail();
    });
  }

  function printDocument(type,project){
    const labels={estimate:'御　見　積　書',invoice:'請　求　書',completion:'完　了　報　告　書'};
    const company=seed.company;
    const isCompletion=type==='completion';
    const totals=type==='invoice'||type==='estimate';
    const rows=project.lines.map(line=>`<tr><td>${line.no}</td><td>${esc(line.name)}</td><td>${esc(line.spec)}</td><td class="r">${line.quantity}</td><td>${esc(line.unit)}</td><td class="r">${yen(line.customerAmount)}</td></tr>`).join('');
    const detail=isCompletion?`<table><tr><th>管理番号</th><td>${esc(project.managementNo)}</td><th>完了日</th><td>${esc(isoLabel(project.completedDate))}</td></tr><tr><th>工事名</th><td colspan="3">${esc(project.work)}</td></tr><tr><th>工期</th><td colspan="3">${esc(isoLabel(project.startDate))} ～ ${esc(isoLabel(project.endDate))}</td></tr></table><section class="demo-photo-grid">${['施工前','施工中','施工後'].map(label=>`<div><b>${label}</b><span>デモ写真イメージ</span></div>`).join('')}</section>`:`<table><thead><tr><th>No.</th><th>名称</th><th>仕様</th><th>数量</th><th>単位</th><th>金額</th></tr></thead><tbody>${rows}</tbody></table>${totals?`<table class="demo-document-totals"><tr><th>小計</th><td>${yen(project.salesEx)}</td></tr><tr><th>消費税</th><td>${yen(project.tax)}</td></tr><tr><th>合計（税込）</th><td>${yen(project.salesIn)}</td></tr></table>`:''}`;
    $('printPreviewHeading').textContent=`${labels[type]}　デモ印刷プレビュー`;
    $('printRoot').innerHTML=`<article class="demo-sheet"><div class="demo-watermark"><span>DEMO　サンプル</span><span>業務利用不可</span><span>DEMO　サンプル</span><span>業務利用不可</span></div><div class="demo-document-content"><div class="demo-document-box">DEMONSTRATION DOCUMENT ／ 本書はサンプルのため業務には使用できません</div><div class="demo-document-meta">管理番号 ${esc(project.managementNo)}　発行日 2026.08.01</div><h1 class="demo-document-title">${labels[type]}</h1><div class="demo-document-to">${esc(project.customer)}　${esc(project.customerContact)}　御中</div><div class="demo-document-project">件名：${esc(project.work)}<br>物件：${esc(project.property)} ${esc(project.room)}<br>住所：${esc(project.address)}</div>${detail}<div class="demo-document-notes">${esc(project.note)}<br><br>※この帳票は販売先向けデモ環境で生成されたサンプルです。</div><div class="demo-document-issuer">${esc(company.name)}<br>〒${esc(company.zip)}　${esc(company.address)}<br>TEL ${esc(company.tel)}　登録番号 ${esc(company.invoiceNo)}</div></div></article>`;
    $('printPreview').classList.remove('hidden');
  }

  $('executePrint').addEventListener('click',()=>window.print());
  $('closePrintPreview').addEventListener('click',()=>$('printPreview').classList.add('hidden'));

  $('printEstimate').addEventListener('click',()=>activeProject&&printDocument('estimate',activeProject));
  $('printInvoice').addEventListener('click',()=>activeProject&&printDocument('invoice',activeProject));
  $('printCompletion').addEventListener('click',()=>activeProject&&printDocument('completion',activeProject));

  $('loginEmail').value=DEMO_EMAIL;
  if(sessionStorage.getItem(SESSION_KEY)==='active')showApp();else showLogin();
})();
