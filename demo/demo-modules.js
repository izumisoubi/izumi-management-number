(function(){
  'use strict';

  const app=globalThis.IZUMI_DEMO_APP;
  if(!app)return;
  const $=id=>document.getElementById(id);
  const {yen,esc,clone}=app;
  const STORE={
    calendar:'izumi_sales_demo_calendar_v1',bank:'izumi_sales_demo_bank_v1',
    changes:'izumi_sales_demo_changes_v1',masters:'izumi_sales_demo_masters_v1',
    payments:'izumi_sales_demo_payments_v1',history:'izumi_sales_demo_history_v1'
  };
  const meta={
    calendar:['予定カレンダー','社員別の予定・休みを登録し、案件の工期と一緒に確認します。'],
    number:['管理番号取得','新しい管理番号を取得し、台帳・見積・請求で共通利用する案件を登録します。'],
    unordered:['工事リスト・未発注','明細ごとに業者を割り当て、案件の発注を確定します。'],
    cost:['工事リスト・原価','業者請求書の金額と支払状況を明細単位で管理します。'],
    billing:['請求管理','案件の請求書発行、入金状況、請求金額を管理します。'],
    outstanding:['未入金リスト','未入金案件を確認します。請求から3か月を超えた案件は薄い赤で表示します。'],
    bank:['銀行入金照合','銀行CSVまたはサンプル明細を管理番号へ割り当て、入金を台帳へ反映します。'],
    payment:['支払通知書','業者別の支払予定額を確認・承認し、支払済みまで管理します。'],
    change:['変更注文・締め管理','追加工事を登録し、承認・却下の状態を管理します。'],
    masters:['マスタ管理','社員・業者・取引先・物件・単位を端末内のデモマスタとして編集します。'],
    workflow:['受注から入金まで','案件がどの工程にあるかを業務の順番で確認します。'],
    history:['操作履歴','このデモで行った登録・変更・入金反映などを時系列で確認します。']
  };
  let activeModule='';

  function read(key,fallback){
    try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??clone(fallback);}catch(_error){return clone(fallback);}
  }
  function write(key,value){localStorage.setItem(key,JSON.stringify(value));}
  function today(){return new Date().toISOString().slice(0,10);}
  function formatDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.replaceAll('-','/'):value||'—';}
  function num(value){return Math.round(Number(String(value??'').replace(/[,￥¥]/g,''))||0);}
  function option(value,label=value,selected=''){return `<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`;}
  function projectOptions(selected='',filter=()=>true){return app.getProjects().filter(filter).map(project=>option(project.id,`${project.managementNo}｜${project.property} ${project.room}`,selected)).join('');}
  function formField(label,control,wide=false){return `<label class="module-field ${wide?'wide':''}"><span>${label}</span>${control}</label>`;}
  function empty(message){return `<div class="module-empty">${esc(message)}</div>`;}
  function recalc(project){
    project.costEx=(project.lines||[]).reduce((sum,line)=>sum+num(line.costAmount),0);
    project.salesEx=(project.lines||[]).reduce((sum,line)=>sum+num(line.customerAmount),0);
    project.tax=Math.round(project.salesEx*.1);project.salesIn=project.salesEx+project.tax;
    project.grossProfit=project.salesEx-project.costEx-num(project.selfLabor)-num(project.selfMaterial)-num(project.referralFee);
    project.margin=project.salesEx?Math.round(project.grossProfit/project.salesEx*1000)/10:0;
  }
  function log(action,detail){
    const rows=read(STORE.history,[]);
    rows.unshift({id:`H-${Date.now()}`,at:new Date().toISOString(),action,detail});
    write(STORE.history,rows.slice(0,200));
  }
  function saveProjects(action,detail){
    app.replaceProjects(app.getProjects());
    if(action)log(action,detail);
  }
  function showNotice(message,type='success'){
    const old=document.querySelector('.module-toast');old?.remove();
    const toast=document.createElement('div');toast.className=`module-toast ${type}`;toast.textContent=message;
    document.body.appendChild(toast);setTimeout(()=>toast.remove(),2600);
  }
  function setModuleBody(html){$('moduleContent').innerHTML=html;}
  function openModule(name){
    if(!meta[name])return;
    activeModule=name;
    $('menuView').classList.add('hidden');$('projectView').classList.add('hidden');$('moduleView').classList.remove('hidden');
    $('moduleTitle').textContent=meta[name][0];$('moduleDescription').textContent=meta[name][1];
    document.querySelectorAll('.system-header-link').forEach(control=>control.classList.toggle('active',control.dataset.module===name));
    renderModule(name);scrollTo({top:0,behavior:'smooth'});
  }
  document.querySelectorAll('[data-module]').forEach(control=>control.addEventListener('click',event=>{event.preventDefault();openModule(control.dataset.module);}));

  function renderNumber(){
    const suffix=Math.max(...app.getProjects().map(project=>num((project.managementNo.match(/(\d+)$/)||[])[1])),26000)+1;
    const managementNo=`DM-${suffix}`;
    const masters=getMasters();
    setModuleBody(`<div class="module-panel"><div class="module-callout"><strong>次の管理番号：${managementNo}</strong><span>登録すると管理番号台帳へ追加され、見積システムの案件選択にも表示されます。</span></div>
      <form id="numberForm" class="module-form-grid">
        ${formField('管理番号',`<input name="managementNo" value="${managementNo}" readonly>`)}
        ${formField('受付日',`<input name="receptionDate" type="date" value="${today()}" required>`)}
        ${formField('工事担当者',`<select name="staff">${masters.staff.map(value=>option(value)).join('')}</select>`)}
        ${formField('進捗',`<select name="status">${['見積作成','見積承認','発注済','工事中'].map(value=>option(value)).join('')}</select>`)}
        ${formField('取引先',`<input name="customer" list="clientList" required><datalist id="clientList">${masters.clients.map(value=>`<option value="${esc(value)}">`).join('')}</datalist>`,true)}
        ${formField('得意先担当者',`<input name="customerContact" placeholder="例：山田様">`)}
        ${formField('物件名',`<input name="property" list="propertyList" required><datalist id="propertyList">${masters.properties.map(value=>`<option value="${esc(value)}">`).join('')}</datalist>`,true)}
        ${formField('部屋番号',`<input name="room" placeholder="例：302">`)}
        ${formField('作業件名',`<input name="work" placeholder="例：原状回復工事" required>`,true)}
        ${formField('現場住所',`<input name="address" placeholder="東京都…">`,true)}
        ${formField('工期（開始）',`<input name="startDate" type="date">`)}
        ${formField('工期（終了）',`<input name="endDate" type="date">`)}
        <div class="module-form-actions"><button class="button primary" type="submit">管理番号を取得して案件を登録</button></div>
      </form></div>`);
    $('numberForm').addEventListener('submit',event=>{
      event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));
      const project={id:`demo-new-${Date.now()}`,managementNo:data.managementNo,receptionDate:data.receptionDate,staff:data.staff,customer:data.customer,customerContact:data.customerContact||'',property:data.property,room:data.room||'',work:data.work,address:data.address||'',phone:'',status:data.status,startDate:data.startDate||'未定',endDate:data.endDate||'未定',completedDate:'未完了',invoiceDate:'未発行',dueDate:'未定',paidDate:'未入金',accountingMonth:`${Number((data.endDate||data.receptionDate).slice(5,7))}月`,estimateNo:`EST-${data.managementNo}`,orderNo:'未発行',invoiceNo:'未発行',salesEx:0,tax:0,salesIn:0,costEx:0,selfLabor:0,selfMaterial:0,referralFee:0,grossProfit:0,margin:0,vendor:'未割当',paymentStatus:'未入金',orderStatus:'未発注',completionStatus:'未完了',estimateDate:data.receptionDate,estimateValidity:'見積日より1か月',paymentTerms:'月末締め翌月末払い',constructionCondition:'作業時間・搬入経路は管理規約に従います',photoInstruction:'施工前・施工中・施工後を同じ画角で撮影',note:'デモで新規登録した案件です',lines:[1,2,3,4].map(no=>({no,name:'',spec:'',quantity:1,unit:'式',customerAmount:0,costAmount:0,vendor:'未割当',ordered:'未発注',note:''}))};
      app.addProject(project);log('管理番号取得',`${project.managementNo} ${project.property} ${project.room}`);showNotice(`${project.managementNo} を登録しました`);app.openProjects();
    });
  }

  function seedCalendar(){return app.getProjects().filter(project=>/^\d{4}-\d{2}-\d{2}$/.test(project.startDate)).slice(0,10).map((project,index)=>({id:`CE-${index}`,date:project.startDate,staff:project.staff,type:'工事',time:'09:00',title:`${project.property} ${project.room}｜${project.work}`,projectId:project.id}));}
  function renderCalendar(){
    let events=read(STORE.calendar,seedCalendar());
    const masters=getMasters();
    setModuleBody(`<div class="module-panel"><form id="calendarForm" class="module-form-grid compact">
      ${formField('日付',`<input name="date" type="date" value="${today()}" required>`)}${formField('担当者',`<select name="staff">${masters.staff.map(value=>option(value)).join('')}</select>`)}
      ${formField('予定種別',`<select name="type">${['立会','現調・見積','工事','完工','休み','午前休','午後休'].map(value=>option(value)).join('')}</select>`)}${formField('開始',`<input name="time" type="time" value="09:00">`)}
      ${formField('予定内容',`<input name="title" placeholder="物件名・用件" required>`,true)}<div class="module-form-actions"><button class="button primary" type="submit">予定を登録</button></div>
      </form></div><div class="module-panel"><div class="module-toolbar"><strong>登録済み予定 ${events.length}件</strong><span>日付・担当者順</span></div>${events.length?`<table class="module-table"><thead><tr><th>日付</th><th>担当者</th><th>種別</th><th>開始</th><th>予定内容</th><th></th></tr></thead><tbody>${events.sort((a,b)=>(a.date+a.staff).localeCompare(b.date+b.staff)).map(row=>`<tr><td>${formatDate(row.date)}</td><td><strong>${esc(row.staff)}</strong></td><td><span class="module-tag">${esc(row.type)}</span></td><td>${esc(row.time||'—')}</td><td>${esc(row.title)}</td><td><button class="button small" data-calendar-delete="${esc(row.id)}">削除</button></td></tr>`).join('')}</tbody></table>`:empty('予定はありません。')}</div>`);
    $('calendarForm').addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));events.push({id:`CE-${Date.now()}`,...data});write(STORE.calendar,events);log('予定登録',`${data.date} ${data.staff} ${data.title}`);showNotice('予定を登録しました');renderCalendar();});
    document.querySelectorAll('[data-calendar-delete]').forEach(button=>button.addEventListener('click',()=>{events=events.filter(row=>row.id!==button.dataset.calendarDelete);write(STORE.calendar,events);log('予定削除',button.dataset.calendarDelete);renderCalendar();}));
  }

  function getMasters(){
    const projects=app.getProjects();
    const derived={staff:[...new Set(projects.map(row=>row.staff).filter(Boolean))],vendors:[...new Set(projects.flatMap(row=>(row.lines||[]).map(line=>line.vendor)).filter(value=>value&&value!=='自社'&&value!=='未割当'))],clients:[...new Set(projects.map(row=>row.customer).filter(Boolean))],properties:[...new Set(projects.map(row=>row.property).filter(Boolean))],units:['式','㎡','m','台','箇所','枚','本']};
    const stored=read(STORE.masters,null);
    if(!stored)return derived;
    Object.keys(derived).forEach(key=>stored[key]=[...new Set([...(stored[key]||[]),...derived[key]])]);
    return stored;
  }
  function renderUnordered(){
    const masters=getMasters();
    const rows=app.getProjects().flatMap(project=>(project.lines||[]).map((line,index)=>({project,line,index}))).filter(({project,line})=>project.orderNo==='未発行'||!line.vendor||line.vendor==='未割当'||line.ordered==='未発注');
    setModuleBody(`<div class="module-summary-row"><div><span>要発注明細</span><strong>${rows.length}件</strong></div><div><span>対象案件</span><strong>${new Set(rows.map(row=>row.project.id)).size}件</strong></div></div><div class="module-panel">${rows.length?`<table class="module-table"><thead><tr><th>管理番号</th><th>物件・工事</th><th>明細</th><th>数量</th><th>発注額</th><th>業者割当</th><th>発注</th></tr></thead><tbody>${rows.map(({project,line,index})=>`<tr><td><strong>${esc(project.managementNo)}</strong></td><td>${esc(project.property)} ${esc(project.room)}<small>${esc(project.work)}</small></td><td>${esc(line.name||'名称未入力')}<small>${esc(line.spec||'')}</small></td><td>${esc(line.quantity)} ${esc(line.unit)}</td><td class="module-money cost">${yen(line.costAmount)}</td><td><select data-vendor-project="${esc(project.id)}" data-line="${index}">${option('未割当','未割当',line.vendor)}${masters.vendors.map(value=>option(value,value,line.vendor)).join('')}</select></td><td><button class="button small primary" data-order-line="${esc(project.id)}" data-line="${index}">発注確定</button></td></tr>`).join('')}</tbody></table>`:empty('未発注明細はありません。')}</div>`);
    document.querySelectorAll('[data-vendor-project]').forEach(select=>select.addEventListener('change',()=>{const project=app.getProjects().find(row=>row.id===select.dataset.vendorProject);const line=project?.lines[num(select.dataset.line)];if(!line)return;line.vendor=select.value;project.vendor=select.value;saveProjects('業者割当',`${project.managementNo} ${line.name} → ${select.value}`);showNotice('業者を割り当てました');}));
    document.querySelectorAll('[data-order-line]').forEach(button=>button.addEventListener('click',()=>{const project=app.getProjects().find(row=>row.id===button.dataset.orderLine);const line=project?.lines[num(button.dataset.line)];if(!line)return;if(!line.vendor||line.vendor==='未割当'){showNotice('先に業者を選択してください','error');return;}line.ordered='発注済';if(project.lines.filter(row=>row.vendor!=='自社').every(row=>row.ordered==='発注済'||row.costAmount===0)){project.orderNo=`PO-${project.managementNo.replace('DM-','D')}`;project.orderStatus='発注済';if(['見積作成','見積承認'].includes(project.status))project.status='発注済';}saveProjects('発注確定',`${project.managementNo} ${line.name}`);showNotice('発注を確定しました');renderUnordered();}));
  }

  function renderCost(){
    const rows=app.getProjects().flatMap(project=>(project.lines||[]).map((line,index)=>({project,line,index}))).filter(({line})=>line.vendor&&line.vendor!=='自社'&&line.vendor!=='未割当');
    const estimate=rows.reduce((sum,row)=>sum+num(row.line.costAmount),0),actual=rows.reduce((sum,row)=>sum+num(row.line.vendorInvoiceAmount||row.line.costAmount),0);
    setModuleBody(`<div class="module-summary-row"><div><span>発注原価</span><strong class="cost">${yen(estimate)}</strong></div><div><span>業者請求</span><strong>${yen(actual)}</strong></div><div><span>差異</span><strong>${yen(actual-estimate)}</strong></div></div><div class="module-panel"><table class="module-table"><thead><tr><th>管理番号</th><th>業者</th><th>明細</th><th>発注額</th><th>業者請求額</th><th>差異</th><th>支払</th></tr></thead><tbody>${rows.map(({project,line,index})=>{const invoice=num(line.vendorInvoiceAmount||line.costAmount);return `<tr><td>${esc(project.managementNo)}</td><td>${esc(line.vendor)}</td><td>${esc(line.name)}</td><td class="module-money cost">${yen(line.costAmount)}</td><td><input class="money-input" data-cost-project="${esc(project.id)}" data-line="${index}" value="${invoice}"></td><td class="module-money ${invoice-num(line.costAmount)>0?'negative':''}">${yen(invoice-num(line.costAmount))}</td><td><label class="check-label"><input type="checkbox" data-paid-project="${esc(project.id)}" data-line="${index}" ${line.vendorPaid?'checked':''}> 支払済</label></td></tr>`;}).join('')}</tbody></table></div>`);
    document.querySelectorAll('[data-cost-project]').forEach(input=>input.addEventListener('change',()=>{const project=app.getProjects().find(row=>row.id===input.dataset.costProject);const line=project?.lines[num(input.dataset.line)];if(!line)return;line.vendorInvoiceAmount=num(input.value);saveProjects('業者請求原価入力',`${project.managementNo} ${line.name} ${yen(line.vendorInvoiceAmount)}`);renderCost();}));
    document.querySelectorAll('[data-paid-project]').forEach(input=>input.addEventListener('change',()=>{const project=app.getProjects().find(row=>row.id===input.dataset.paidProject);const line=project?.lines[num(input.dataset.line)];if(!line)return;line.vendorPaid=input.checked;saveProjects('外注支払更新',`${project.managementNo} ${line.name} ${input.checked?'支払済':'未払'}`);showNotice('支払状況を更新しました');}));
  }

  function renderBilling(){
    const rows=app.getProjects();
    setModuleBody(`<div class="module-summary-row"><div><span>請求済</span><strong>${rows.filter(row=>row.invoiceNo!=='未発行').length}件</strong></div><div><span>入金済</span><strong>${rows.filter(row=>row.paymentStatus==='入金済').length}件</strong></div><div><span>請求総額</span><strong class="sale">${yen(rows.reduce((sum,row)=>sum+num(row.salesIn),0))}</strong></div></div><div class="module-panel"><table class="module-table"><thead><tr><th>管理番号</th><th>請求先・物件</th><th>請求額（税込）</th><th>請求番号</th><th>発行日</th><th>状態</th><th>操作</th></tr></thead><tbody>${rows.map(project=>`<tr><td><strong>${esc(project.managementNo)}</strong></td><td>${esc(project.customer)}<small>${esc(project.property)} ${esc(project.room)}</small></td><td class="module-money sale">${yen(project.salesIn)}</td><td><input data-invoice-no="${esc(project.id)}" value="${esc(project.invoiceNo==='未発行'?'':project.invoiceNo)}" placeholder="未発行"></td><td><input type="date" data-invoice-date="${esc(project.id)}" value="${/^\d{4}-/.test(project.invoiceDate)?project.invoiceDate:''}"></td><td><span class="module-tag ${project.paymentStatus==='入金済'?'green':''}">${esc(project.paymentStatus)}</span></td><td><button class="button small primary" data-issue="${esc(project.id)}">請求発行</button> <button class="button small" data-billing-paid="${esc(project.id)}">入金反映</button></td></tr>`).join('')}</tbody></table></div>`);
    document.querySelectorAll('[data-issue]').forEach(button=>button.addEventListener('click',()=>{const project=app.getProjects().find(row=>row.id===button.dataset.issue);const no=document.querySelector(`[data-invoice-no="${CSS.escape(project.id)}"]`),date=document.querySelector(`[data-invoice-date="${CSS.escape(project.id)}"]`);project.invoiceNo=no.value||`INV-${project.managementNo}`;project.invoiceDate=date.value||today();project.paymentStatus='未入金';project.status='請求済';saveProjects('請求書発行',`${project.managementNo} ${project.invoiceNo}`);showNotice('請求を発行しました');renderBilling();}));
    document.querySelectorAll('[data-billing-paid]').forEach(button=>button.addEventListener('click',()=>markPaid(button.dataset.billingPaid,'請求管理')));
  }

  function isOverdue(project){if(!/^\d{4}-/.test(project.invoiceDate)||project.paymentStatus==='入金済')return false;const limit=new Date(project.invoiceDate+'T00:00:00');limit.setMonth(limit.getMonth()+3);return new Date()>=limit;}
  function markPaid(id,source){const project=app.getProjects().find(row=>row.id===id);if(!project)return;project.paymentStatus='入金済';project.paidDate=today();project.status='入金済';saveProjects('入金反映',`${source}｜${project.managementNo} ${yen(project.salesIn)}`);showNotice(`${project.managementNo} を入金済みにしました`);renderModule(activeModule);}
  function renderOutstanding(){
    const rows=app.getProjects().filter(project=>project.paymentStatus!=='入金済'&&project.invoiceNo!=='未発行');
    setModuleBody(`<div class="module-summary-row"><div><span>未入金</span><strong>${rows.length}件</strong></div><div><span>未入金額</span><strong class="sale">${yen(rows.reduce((sum,row)=>sum+num(row.salesIn),0))}</strong></div><div><span>3か月超過</span><strong class="negative">${rows.filter(isOverdue).length}件</strong></div></div><div class="module-panel">${rows.length?`<table class="module-table"><thead><tr><th>管理番号</th><th>請求先・物件</th><th>請求日</th><th>支払期日</th><th>未入金額</th><th>経過</th><th></th></tr></thead><tbody>${rows.map(project=>`<tr class="${isOverdue(project)?'overdue':''}"><td><strong>${esc(project.managementNo)}</strong></td><td>${esc(project.customer)}<small>${esc(project.property)} ${esc(project.room)}</small></td><td>${formatDate(project.invoiceDate)}</td><td>${formatDate(project.dueDate)}</td><td class="module-money sale">${yen(project.salesIn)}</td><td>${isOverdue(project)?'<span class="module-tag red">3か月超過</span>':'確認中'}</td><td><button class="button small primary" data-outstanding-paid="${esc(project.id)}">入金反映</button></td></tr>`).join('')}</tbody></table>`:empty('未入金案件はありません。')}</div>`);
    document.querySelectorAll('[data-outstanding-paid]').forEach(button=>button.addEventListener('click',()=>markPaid(button.dataset.outstandingPaid,'未入金リスト')));
  }

  function seedBank(){const unpaid=app.getProjects().filter(project=>project.paymentStatus!=='入金済'&&project.invoiceNo!=='未発行').slice(0,4);return unpaid.map((project,index)=>({id:`BT-${index+1}`,date:`2026-08-${String(index+1).padStart(2,'0')}`,description:`振込 サンプル${index+1}`,amount:project.salesIn,projectId:'',matched:false}));}
  function renderBank(){
    let rows=read(STORE.bank,seedBank());
    setModuleBody(`<div class="module-panel"><div class="module-toolbar"><div><strong>銀行CSV取込</strong><span>日付・摘要・金額を含むCSVを選択できます。実ファイルはこの端末内でのみ読み込みます。</span></div><label class="button primary file-button">CSVを選択<input id="bankCsv" type="file" accept=".csv,text/csv"></label><button id="bankSampleReset" class="button">サンプル明細を再読込</button></div></div><div class="module-panel"><table class="module-table"><thead><tr><th>入金日</th><th>摘要</th><th>金額</th><th>照合する案件</th><th>状態</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr><td>${formatDate(row.date)}</td><td>${esc(row.description)}</td><td class="module-money sale">${yen(row.amount)}</td><td><select data-bank-project="${esc(row.id)}"><option value="">管理番号を選択</option>${projectOptions(row.projectId,project=>project.paymentStatus!=='入金済')}</select></td><td>${row.matched?'<span class="module-tag green">反映済</span>':'未照合'}</td><td><button class="button small primary" data-bank-match="${esc(row.id)}" ${row.matched?'disabled':''}>入金反映</button></td></tr>`).join('')}</tbody></table></div>`);
    document.querySelectorAll('[data-bank-project]').forEach(select=>select.addEventListener('change',()=>{const row=rows.find(item=>item.id===select.dataset.bankProject);row.projectId=select.value;write(STORE.bank,rows);}));
    document.querySelectorAll('[data-bank-match]').forEach(button=>button.addEventListener('click',()=>{const row=rows.find(item=>item.id===button.dataset.bankMatch);if(!row.projectId){showNotice('照合する管理番号を選択してください','error');return;}row.matched=true;write(STORE.bank,rows);markPaid(row.projectId,`銀行入金 ${row.description}`);}));
    $('bankSampleReset').addEventListener('click',()=>{rows=seedBank();write(STORE.bank,rows);renderBank();});
    $('bankCsv').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;const text=await file.text();const parsed=text.split(/\r?\n/).filter(Boolean).map((line,index)=>{const cells=line.split(',').map(cell=>cell.replace(/^"|"$/g,'').trim());const date=cells.find(cell=>/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(cell));const amount=[...cells].reverse().map(num).find(value=>value>0);return date&&amount?{id:`CSV-${Date.now()}-${index}`,date:date.replaceAll('/','-'),description:cells.filter(cell=>cell!==date&&num(cell)!==amount).join(' ')||file.name,amount,projectId:'',matched:false}:null;}).filter(Boolean);if(!parsed.length){showNotice('日付と金額を読み取れませんでした','error');return;}rows=parsed;write(STORE.bank,rows);log('銀行CSV取込',`${file.name} ${rows.length}件`);showNotice(`${rows.length}件を読み込みました`);renderBank();});
  }

  function vendorTotals(){const map=new Map();app.getProjects().forEach(project=>(project.lines||[]).forEach(line=>{if(!line.vendor||['自社','未割当'].includes(line.vendor))return;map.set(line.vendor,(map.get(line.vendor)||0)+num(line.vendorInvoiceAmount||line.costAmount));}));return [...map].map(([vendor,amount])=>({vendor,amount}));}
  function renderPayment(){
    const state=read(STORE.payments,{}),rows=vendorTotals();
    setModuleBody(`<div class="module-summary-row"><div><span>支払先</span><strong>${rows.length}社</strong></div><div><span>支払予定総額</span><strong class="cost">${yen(rows.reduce((sum,row)=>sum+row.amount,0))}</strong></div><div><span>経理確定</span><strong>${rows.filter(row=>state[row.vendor]?.paid).length}社</strong></div></div><div class="module-panel"><table class="module-table"><thead><tr><th>業者</th><th>対象明細</th><th>支払予定額</th><th>担当確認</th><th>経理確定・支払</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${esc(row.vendor)}</strong></td><td>${app.getProjects().flatMap(project=>(project.lines||[]).filter(line=>line.vendor===row.vendor)).length}件</td><td class="module-money cost">${yen(row.amount)}</td><td><label class="check-label"><input type="checkbox" data-payment-approve="${esc(row.vendor)}" ${state[row.vendor]?.approved?'checked':''}> 確認済</label></td><td><label class="check-label"><input type="checkbox" data-payment-paid="${esc(row.vendor)}" ${state[row.vendor]?.paid?'checked':''}> 支払済</label></td></tr>`).join('')}</tbody></table></div>`);
    document.querySelectorAll('[data-payment-approve],[data-payment-paid]').forEach(input=>input.addEventListener('change',()=>{const vendor=input.dataset.paymentApprove||input.dataset.paymentPaid;state[vendor]??={approved:false,paid:false};if(input.dataset.paymentApprove)state[vendor].approved=input.checked;else{if(input.checked&&!state[vendor].approved){input.checked=false;showNotice('先に担当確認を完了してください','error');return;}state[vendor].paid=input.checked;}write(STORE.payments,state);log('支払状況更新',`${vendor} ${state[vendor].paid?'支払済':state[vendor].approved?'確認済':'未確認'}`);showNotice('支払状況を保存しました');renderPayment();}));
  }

  function renderChange(){
    let rows=read(STORE.changes,[{id:'CO-1',projectId:app.getProjects()[3]?.id,description:'追加器具交換',amount:22000,status:'申請中',createdAt:'2026-08-01'}]);
    setModuleBody(`<div class="module-panel"><form id="changeForm" class="module-form-grid compact">${formField('対象案件',`<select name="projectId">${projectOptions()}</select>`,true)}${formField('変更内容',`<input name="description" placeholder="追加工事の内容" required>`,true)}${formField('追加金額（税抜）',`<input name="amount" inputmode="numeric" required>`)}<div class="module-form-actions"><button class="button primary" type="submit">変更注文を申請</button></div></form></div><div class="module-panel">${rows.length?`<table class="module-table"><thead><tr><th>申請日</th><th>管理番号</th><th>変更内容</th><th>追加金額</th><th>状態</th><th>操作</th></tr></thead><tbody>${rows.map(row=>{const project=app.getProjects().find(item=>item.id===row.projectId);return `<tr><td>${formatDate(row.createdAt)}</td><td>${esc(project?.managementNo||'削除済')}</td><td>${esc(row.description)}</td><td class="module-money sale">${yen(row.amount)}</td><td><span class="module-tag ${row.status==='承認済'?'green':row.status==='却下'?'red':''}">${esc(row.status)}</span></td><td><button class="button small primary" data-change-approve="${esc(row.id)}">承認</button> <button class="button small" data-change-reject="${esc(row.id)}">却下</button> <button class="button small" data-change-delete="${esc(row.id)}">削除</button></td></tr>`;}).join('')}</tbody></table>`:empty('変更注文はありません。')}</div>`);
    $('changeForm').addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));rows.unshift({id:`CO-${Date.now()}`,projectId:data.projectId,description:data.description,amount:num(data.amount),status:'申請中',createdAt:today()});write(STORE.changes,rows);log('変更注文申請',`${data.description} ${yen(data.amount)}`);renderChange();});
    const act=(selector,status)=>document.querySelectorAll(selector).forEach(button=>button.addEventListener('click',()=>{const row=rows.find(item=>item.id===(button.dataset.changeApprove||button.dataset.changeReject));row.status=status;if(status==='承認済'&&!row.applied){const project=app.getProjects().find(item=>item.id===row.projectId);if(project){project.lines.push({no:project.lines.length+1,name:row.description,spec:'変更注文',quantity:1,unit:'式',customerAmount:row.amount,costAmount:0,vendor:'未割当',ordered:'未発注',note:'承認済み変更注文'});recalc(project);saveProjects();row.applied=true;}}write(STORE.changes,rows);log('変更注文'+status,row.description);renderChange();}));
    act('[data-change-approve]','承認済');act('[data-change-reject]','却下');document.querySelectorAll('[data-change-delete]').forEach(button=>button.addEventListener('click',()=>{rows=rows.filter(row=>row.id!==button.dataset.changeDelete);write(STORE.changes,rows);renderChange();}));
  }

  function renderMasters(){
    let masters=getMasters();write(STORE.masters,masters);
    const labels={staff:'社員',vendors:'業者',clients:'取引先',properties:'物件',units:'単位'};
    setModuleBody(`<div class="module-panel"><form id="masterForm" class="module-form-grid compact">${formField('マスタ種別',`<select name="type">${Object.entries(labels).map(([key,label])=>option(key,label)).join('')}</select>`)}${formField('名称',`<input name="name" placeholder="追加する名称" required>`,true)}<div class="module-form-actions"><button class="button primary" type="submit">マスタへ追加</button></div></form></div><div class="master-grid">${Object.entries(labels).map(([key,label])=>`<section class="module-panel"><div class="module-toolbar"><strong>${label}マスタ</strong><span>${masters[key].length}件</span></div><div class="master-list">${masters[key].map(value=>`<div><span>${esc(value)}</span><button type="button" data-master-type="${key}" data-master-delete="${esc(value)}" aria-label="削除">×</button></div>`).join('')}</div></section>`).join('')}</div>`);
    $('masterForm').addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));if(!masters[data.type].includes(data.name.trim()))masters[data.type].push(data.name.trim());write(STORE.masters,masters);log('マスタ追加',`${labels[data.type]}：${data.name}`);showNotice('マスタへ追加しました');renderMasters();});
    document.querySelectorAll('[data-master-delete]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.masterType;masters[key]=masters[key].filter(value=>value!==button.dataset.masterDelete);write(STORE.masters,masters);log('マスタ削除',`${labels[key]}：${button.dataset.masterDelete}`);renderMasters();}));
  }

  function renderWorkflow(){
    const stages=[['見積','見積作成',project=>['見積作成','見積承認'].includes(project.status)],['発注','発注済',project=>project.status==='発注済'],['施工','工事中',project=>project.status==='工事中'],['完了','工事完了',project=>project.status==='工事完了'],['請求','請求済',project=>project.status==='請求済'],['入金','入金済',project=>project.status==='入金済']];
    setModuleBody(`<div class="workflow-board">${stages.map(([label,status,test],index)=>{const rows=app.getProjects().filter(test);return `<section class="workflow-stage"><header><span>${index+1}</span><div><strong>${label}</strong><small>${status}</small></div><b>${rows.length}件</b></header><div>${rows.length?rows.slice(0,8).map(project=>`<button data-open-workflow="${esc(project.id)}"><strong>${esc(project.managementNo)}</strong><span>${esc(project.property)} ${esc(project.room)}</span></button>`).join(''):empty('該当なし')}</div></section>`;}).join('<div class="workflow-arrow">→</div>')}</div><div class="module-callout"><strong>同じ管理番号で一連の業務を追跡</strong><span>見積システム・管理番号台帳・請求・入金の操作結果が、この流れへ反映されます。</span></div>`);
    document.querySelectorAll('[data-open-workflow]').forEach(button=>button.addEventListener('click',()=>{app.openProjects();setTimeout(()=>document.querySelector(`[data-open="${CSS.escape(button.dataset.openWorkflow)}"]`)?.click(),0);}));
  }
  function renderHistory(){
    const rows=read(STORE.history,[]);
    setModuleBody(`<div class="module-panel"><div class="module-toolbar"><strong>操作履歴 ${rows.length}件</strong><button id="historyClear" class="button small">履歴を消去</button></div>${rows.length?`<table class="module-table"><thead><tr><th>日時</th><th>操作</th><th>内容</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${new Date(row.at).toLocaleString('ja-JP')}</td><td><span class="module-tag">${esc(row.action)}</span></td><td>${esc(row.detail)}</td></tr>`).join('')}</tbody></table>`:empty('まだ操作履歴はありません。各画面で登録・変更するとここへ記録されます。')}</div>`);
    $('historyClear').addEventListener('click',()=>{if(confirm('デモの操作履歴を消去しますか？')){write(STORE.history,[]);renderHistory();}});
  }
  function renderModule(name){
    ({calendar:renderCalendar,number:renderNumber,unordered:renderUnordered,cost:renderCost,billing:renderBilling,outstanding:renderOutstanding,bank:renderBank,payment:renderPayment,change:renderChange,masters:renderMasters,workflow:renderWorkflow,history:renderHistory})[name]?.();
  }

  addEventListener('izumi-demo-reset',()=>{Object.values(STORE).forEach(key=>localStorage.removeItem(key));showNotice('全デモ機能を初期状態へ戻しました');if(activeModule)renderModule(activeModule);});
  globalThis.IZUMI_DEMO_MODULES={open:openModule,refresh:()=>activeModule&&renderModule(activeModule),log};
})();
