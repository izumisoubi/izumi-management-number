(function(){
  'use strict';

  const DATA=globalThis.IZUMI_DEMO_DATA;
  const PROJECT_KEY='izumi_sales_demo_estimate_project_v3_';
  const SELECTED_KEY='izumi_sales_demo_estimate_selected_v3';
  const SHARED_PROJECTS_KEY='izumi_sales_demo_projects_v3';
  const SHARED_MASTERS_KEY='izumi_sales_demo_masters_v1';
  const HISTORY_KEY='izumi_sales_demo_history_v1';
  function loadSharedProjects(){
    const seeded=Array.isArray(DATA?.projects)?JSON.parse(JSON.stringify(DATA.projects)):[];
    const seededNumbers=new Set(seeded.map(project=>project.managementNo));
    try{
      const stored=JSON.parse(localStorage.getItem(SHARED_PROJECTS_KEY)||'null');
      if(Array.isArray(stored)&&stored.length>=20&&stored.some(project=>seededNumbers.has(project.managementNo)))return stored;
    }catch(_error){}
    localStorage.setItem(SHARED_PROJECTS_KEY,JSON.stringify(seeded));
    return seeded;
  }
  let projects=loadSharedProjects();
  let activeManagementNo='';
  let projectSaveTimer=null;
  let loadingProject=false;

  const cleanDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):'';
  const round=value=>Math.round(Number(value)||0);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const projectByNo=managementNo=>projects.find(project=>project.managementNo===managementNo)||null;

  function fakeMasters(){
    const clients=[];
    const vendors=[];
    const properties=[];
    const employees=[];
    const seenClients=new Set(),seenVendors=new Set(),seenProperties=new Set(),seenEmployees=new Set();
    projects.forEach(project=>{
      if(!seenClients.has(project.customer)){
        seenClients.add(project.customer);
        clients.push({name:project.customer,zip:'',addr:project.address,tel:project.phone,fax:''});
      }
      if(!seenProperties.has(project.property)){
        seenProperties.add(project.property);
        properties.push({name:project.property,mgmt:project.customer,key:'',car:'',zip:'',addr:project.address,person:project.customerContact.replace(/様$/,''),client:project.customer});
      }
      if(!seenEmployees.has(project.staff)){
        seenEmployees.add(project.staff);
        employees.push({name:project.staff,title:'営業',email:'',access:'従業員権限',isBoss:employees.length===0,stamp:'assets/stamps/demo-person.svg'});
      }
      project.lines.forEach(line=>{
        if(!line.vendor||line.vendor==='自社'||line.vendor==='未割当'||seenVendors.has(line.vendor))return;
        seenVendors.add(line.vendor);
        vendors.push({name:line.vendor,category:'外注',zip:'',addr:'',tel:'03-5550-2000',fax:'',contact:'デモ担当',note:'架空のサンプル業者'});
      });
    });
    try{
      const shared=JSON.parse(localStorage.getItem(SHARED_MASTERS_KEY)||'null');
      if(shared){
        (shared.clients||[]).forEach(name=>{if(!seenClients.has(name)){seenClients.add(name);clients.push({name,zip:'',addr:'',tel:'',fax:''});}});
        (shared.vendors||[]).forEach(name=>{if(!seenVendors.has(name)){seenVendors.add(name);vendors.push({name,category:'外注',zip:'',addr:'',tel:'',fax:'',contact:'',note:'デモで追加'});}});
        (shared.staff||[]).forEach(name=>{if(!seenEmployees.has(name)){seenEmployees.add(name);employees.push({name,title:'営業',email:'',access:'従業員権限',isBoss:false,stamp:'assets/stamps/demo-person.svg'});}});
        (shared.properties||[]).forEach(name=>{if(!seenProperties.has(name)){seenProperties.add(name);properties.push({name,mgmt:'',key:'',car:'',zip:'',addr:'',person:'',client:''});}});
      }
    }catch(_error){}
    return {clients,vendors,employees,properties};
  }

  const masters=fakeMasters();

  function estimateRows(project){
    const rows=project.lines.map((line,index)=>{
      const quantity=Number(line.quantity)||1;
      return {
        id:index+1,type:'item',name:line.name,spec:line.spec,qty:quantity,unit:line.unit,
        cost:round(line.costAmount/quantity),note:line.note,vendor:line.vendor,
        orderCost:round(line.costAmount/quantity),sellOverride:round(line.customerAmount/quantity),
        landlordRate:'',tenantRate:'',landlordTaxIn:'',tenantTaxIn:'',showNumber:true,
        _orderCostManual:false,_sellOverrideManual:true
      };
    });
    while(rows.length<12){
      rows.push({id:rows.length+1,type:'item',name:'',spec:'',qty:'',unit:'',cost:'',note:'',vendor:'',orderCost:'',sellOverride:'',landlordRate:'',tenantRate:'',landlordTaxIn:'',tenantTaxIn:'',showNumber:true});
    }
    return rows;
  }

  function orderRows(project){
    const rows=project.lines.map((line,index)=>{
      const quantity=Number(line.quantity)||1;
      return {id:index+1,type:'item',name:line.name,spec:line.spec,qty:quantity,unit:line.unit,orderCost:round(line.costAmount/quantity),note:line.note,vendor:line.vendor==='自社'?'':line.vendor,_orderCostManual:false};
    });
    while(rows.length<10)rows.push({id:rows.length+1,type:'item',name:'',spec:'',qty:'',unit:'',orderCost:'',note:'',vendor:'',_orderCostManual:false});
    return rows;
  }

  function statusValue(status){
    return ({'見積作成':'見積中','見積承認':'受注','発注済':'受注','工事中':'受注','工事完了':'完工','請求済':'請求済','入金済':'入金済'})[status]||'見積中';
  }

  function seedPayload(project){
    const rows=estimateRows(project);
    const ordRows=orderRows(project);
    const invoiceDate=cleanDate(project.invoiceDate);
    const completedDate=cleanDate(project.completedDate);
    const start=cleanDate(project.startDate),end=cleanDate(project.endDate);
    const company={
      id:'izumi',name:DATA.company.name,zip:'〒'+DATA.company.zip,addr:DATA.company.address,addr2:'デモビル5F',
      tel:'TEL：'+DATA.company.tel+'　FAX：03-5550-1001',person:'',invoice:DATA.company.invoiceNo,
      license:'',bank:'サンプル銀行 本店 普通 1234567',stampImg:'assets/stamps/demo-company.svg',stampShape:'square',red:false,rate:25,font:'mincho'
    };
    const costTable={
      jisha_jin_1:String(project.selfLabor||''),jisha_jin_inc_1:project.selfLabor?String(round(project.selfLabor*1.1)):'',jisha_jin_name_1:'自社施工',
      jisha_jin_2:'',jisha_jin_inc_2:'',jisha_jin_name_2:'',jisha_jin:String(project.selfLabor||0),
      jisha_mat_1:String(project.selfMaterial||''),jisha_mat_inc_1:project.selfMaterial?String(round(project.selfMaterial*1.1)):'',jisha_mat_name_1:'自社資材',
      jisha_mat_2:'',jisha_mat_inc_2:'',jisha_mat_name_2:'',jisha_mat:String(project.selfMaterial||0)
    };
    return {
      v:21,estimateLayout:'landscape',calendarEventId:'',draftId:'',ledgerWriteback:{},co:'izumi',invCo:'izumi',companies:{izumi:company},
      rows,rowId:rows.length,invRows:[],invRowId:0,vendors:masters.vendors.map(item=>item.name),costTable,
      referralFees:{
        shokai_yen:project.referralFee?String(project.referralFee):'',shokai_pct_in:'',shokai_yen_inc:project.referralFee?String(round(project.referralFee*1.1)):'',shokai_name1:project.referralFee?'紹介先（デモ）':'',
        shokai_yen2:'',shokai_pct2_in:'',shokai_yen2_inc:'',shokai_name2:''
      },
      rate:'25',estMemo:'販売先デモ用の架空案件です。金額・社名・住所は実在の業務とは関係ありません。',invMemo:'販売先デモ用サンプル',
      ordRows,ordRowId:ordRows.length,
      basic:{
        kanri:project.managementNo,staff:project.staff,uketsuke:cleanDate(project.receptionDate),status:statusValue(project.status),category:'外注費',keijo:project.accountingMonth,
        kanko_date:end,completedOn:completedDate,client:project.customer,clientContact:project.customerContact,kojiname:[project.property,project.room,project.work].filter(Boolean).join(' '),
        property:project.property,room:project.room,postal:'',place:project.address,summary:project.work,duration:start&&end?start+' ～ '+end:'',payment:project.paymentTerms,
        paymentSel:'__custom__',expire:String(project.estimateValidity||'').replace(/^見積日より/,''),cond:project.constructionCondition,date:cleanDate(project.estimateDate),
        invClient:project.customer,invDept:'',invAddr:project.address,invTanto:project.customerContact,invDue:project.dueDate,invNote:project.note
      },
      invOv:{client:project.customer,dept:'',addr:project.address,date:invoiceDate,due:project.dueDate,staff:project.staff,templateType:'standard',contentType:'完工金',amtOverride:''},
      ledger:{
        customerName:project.customer,customerContactName:project.customerContact,scheduledCompletionDate:end,completedOn:completedDate,
        salesEstimateExTax:project.salesEx,landlordBurdenExTax:0,tenantBurdenExTax:0,invoiceDate,
        invoiceExTax:invoiceDate?project.salesEx:'',invoiceTaxIn:invoiceDate?project.salesIn:'',accountingYear:'2026'
      },
      standalone:{format:'estimate-order-cost-invoice-standalone',version:1,savedAt:new Date().toISOString(),theme:'t-light',fields:{},masters:clone(masters)}
    };
  }

  function storageKey(managementNo){return PROJECT_KEY+managementNo;}

  function saveCurrentProject(showStatus=false){
    if(loadingProject||!activeManagementNo||typeof window.buildSaveData!=='function')return false;
    try{
      const data=window.buildSaveData();
      data.demoProject={managementNo:activeManagementNo,savedAt:new Date().toISOString()};
      localStorage.setItem(storageKey(activeManagementNo),JSON.stringify(data));
      syncSharedProject(data);
      if(showStatus&&typeof window.setOnlineSaveStatus==='function'){
        const time=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
        window.setOnlineSaveStatus('デモ端末内へ保存済 '+time,'saved');
      }
      return true;
    }catch(error){
      console.error('demo project save failed',error);
      return false;
    }
  }

  function statusFromBasic(value,current){
    return ({'見積中':'見積作成','受注':'見積承認','完工':'工事完了','請求済':'請求済','入金済':'入金済'})[value]||current||'見積作成';
  }

  function syncSharedProject(data){
    const project=projectByNo(activeManagementNo);
    if(!project||!data)return;
    const basic=data.basic||{},rows=Array.isArray(data.rows)?data.rows:[];
    const meaningful=rows.filter(row=>row&&(row.name||row.spec||Number(row.qty)||Number(row.cost)||Number(row.sellOverride)));
    if(meaningful.length){
      project.lines=meaningful.map((row,index)=>{
        const quantity=Number(row.qty)||1;
        const costUnit=Number(row.orderCost||row.cost)||0;
        const saleUnit=Number(row.sellOverride)||0;
        return {no:index+1,name:row.name||'',spec:row.spec||'',quantity,unit:row.unit||'式',customerAmount:Math.round(saleUnit*quantity),costAmount:Math.round(costUnit*quantity),vendor:row.vendor||'未割当',ordered:row.vendor&&row.vendor!=='未割当'?'発注済':'未発注',note:row.note||''};
      });
    }
    project.staff=basic.staff||project.staff;project.customer=basic.client||project.customer;project.customerContact=basic.clientContact||project.customerContact;
    project.property=basic.property||project.property;project.room=basic.room||project.room;project.work=basic.summary||project.work;project.address=basic.place||project.address;
    project.receptionDate=cleanDate(basic.uketsuke)||project.receptionDate;project.endDate=cleanDate(basic.kanko_date)||project.endDate;
    project.completedDate=cleanDate(basic.completedOn)||project.completedDate;project.accountingMonth=basic.keijo||project.accountingMonth;
    project.status=statusFromBasic(basic.status,project.status);project.estimateDate=cleanDate(basic.date)||project.estimateDate;
    project.estimateValidity=basic.expire?`見積日より${basic.expire}`:project.estimateValidity;project.paymentTerms=basic.payment||project.paymentTerms;
    project.constructionCondition=basic.cond||project.constructionCondition;project.note=basic.invNote||project.note;
    const cost=data.costTable||{};
    project.selfLabor=Math.round(Number(cost.jisha_jin)||Number(cost.jisha_jin_1||0)+Number(cost.jisha_jin_2||0));
    project.selfMaterial=Math.round(Number(cost.jisha_mat)||Number(cost.jisha_mat_1||0)+Number(cost.jisha_mat_2||0));
    const referral=data.referralFees||{};project.referralFee=Math.round(Number(referral.shokai_yen||0)+Number(referral.shokai_yen2||0));
    project.salesEx=(project.lines||[]).reduce((sum,line)=>sum+Number(line.customerAmount||0),0);
    project.costEx=(project.lines||[]).reduce((sum,line)=>sum+Number(line.costAmount||0),0);
    project.tax=Math.round(project.salesEx*.1);project.salesIn=project.salesEx+project.tax;
    project.grossProfit=project.salesEx-project.costEx-project.selfLabor-project.selfMaterial-project.referralFee;
    project.margin=project.salesEx?Math.round(project.grossProfit/project.salesEx*1000)/10:0;
    const invoiceDate=cleanDate(data.invOv?.date||data.ledger?.invoiceDate);
    if(invoiceDate){project.invoiceDate=invoiceDate;project.invoiceNo=project.invoiceNo==='未発行'?`INV-${project.managementNo}`:project.invoiceNo;if(project.status!=='入金済')project.status='請求済';}
    project.dueDate=data.invOv?.due||basic.invDue||project.dueDate;
    const vendors=[...new Set((project.lines||[]).map(line=>line.vendor).filter(value=>value&&value!=='自社'&&value!=='未割当'))];
    project.vendor=vendors[0]||'未割当';
    project.orderStatus=project.lines.some(line=>line.ordered==='発注済')?'発注済':'未発注';
    if(project.orderStatus==='発注済'&&project.orderNo==='未発行')project.orderNo=`PO-${project.managementNo.replace('DM-','D')}`;
    localStorage.setItem(SHARED_PROJECTS_KEY,JSON.stringify(projects));
    try{
      const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
      const last=history[0];
      if(!last||last.action!=='見積システム保存'||last.detail!==project.managementNo){history.unshift({id:`H-${Date.now()}`,at:new Date().toISOString(),action:'見積システム保存',detail:project.managementNo});localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(0,200)));}
    }catch(_error){}
  }

  function scheduleProjectSave(delay=650){
    clearTimeout(projectSaveTimer);
    projectSaveTimer=setTimeout(()=>saveCurrentProject(true),Math.max(250,Number(delay)||650));
  }

  function loadProject(managementNo,{reset=false}={}){
    const project=projectByNo(managementNo)||projects[0];
    if(!project)return;
    saveCurrentProject(false);
    loadingProject=true;
    let payload=null;
    if(!reset){
      try{payload=JSON.parse(localStorage.getItem(storageKey(project.managementNo))||'null');}catch(_error){payload=null;}
    }
    if(!payload)payload=seedPayload(project);
    window.loadAllFromText(JSON.stringify(payload));
    activeManagementNo=project.managementNo;
    localStorage.setItem(SELECTED_KEY,activeManagementNo);
    const select=document.getElementById('demoProjectSelect');
    if(select)select.value=activeManagementNo;
    const badge=document.getElementById('demoProjectBadge');
    if(badge)badge.textContent=[project.managementNo,project.property,project.room,project.work].filter(Boolean).join('｜');
    const url=new URL(location.href);
    url.searchParams.set('managementNo',activeManagementNo);
    history.replaceState(null,'',url.pathname+'?'+url.searchParams.toString());
    loadingProject=false;
    saveCurrentProject(false);
    if(reset&&typeof window.showToastMsg==='function')window.showToastMsg('初期サンプルへ戻しました：'+activeManagementNo);
  }

  function addDemoUi(){
    const toolbar=document.createElement('section');
    toolbar.id='demoProjectToolbar';
    toolbar.className='demo-project-toolbar';
    toolbar.innerHTML=`
      <div class="demo-toolbar-heading"><span class="demo-pill">販売先デモ</span><strong>操作する案件</strong></div>
      <select id="demoProjectSelect" aria-label="デモ案件を選択">${projects.map(project=>`<option value="${project.managementNo}">${project.managementNo}｜${project.property} ${project.room}｜${project.work}</option>`).join('')}</select>
      <button id="demoLoadProject" type="button">案件を読込</button>
      <button id="demoResetProject" class="secondary" type="button">初期データに戻す</button>
      <a href="../" class="demo-menu-link">← 一覧メニュー</a>
      <span id="demoProjectBadge" class="demo-project-badge"></span>
      <small>変更はこの端末内だけに保存され、本番データには接続しません。</small>`;
    document.getElementById('standaloneNotice')?.insertAdjacentElement('afterend',toolbar);
    document.getElementById('demoLoadProject').addEventListener('click',()=>loadProject(document.getElementById('demoProjectSelect').value));
    document.getElementById('demoProjectSelect').addEventListener('change',event=>loadProject(event.target.value));
    document.getElementById('demoResetProject').addEventListener('click',()=>{
      const no=document.getElementById('demoProjectSelect').value;
      if(confirm('この案件で試した入力を消し、最初のサンプルへ戻しますか？')){
        localStorage.removeItem(storageKey(no));
        loadProject(no,{reset:true});
      }
    });

    const ribbon=document.createElement('div');
    ribbon.className='demo-screen-ribbon';
    ribbon.textContent='DEMO';
    document.body.appendChild(ribbon);
    const watermark=document.createElement('div');
    watermark.className='demo-print-watermark';
    watermark.innerHTML='<strong>DEMO</strong><span>サンプル・業務利用不可</span>';
    document.body.appendChild(watermark);
  }

  function addStyles(){
    const style=document.createElement('style');
    style.textContent=`
      .demo-project-toolbar{display:grid;grid-template-columns:auto minmax(310px,1fr) auto auto auto;gap:8px 10px;align-items:center;padding:9px 16px;background:#fff;border-bottom:2px solid #d8e3f3;box-shadow:0 4px 16px rgba(25,58,97,.08);font-family:'Helvetica Neue','Hiragino Sans',sans-serif;position:sticky;top:52px;z-index:85}
      .demo-toolbar-heading{display:flex;align-items:center;gap:7px;white-space:nowrap;color:#173b67;font-size:12px}.demo-pill{padding:4px 7px;border-radius:999px;background:#fff0c8;color:#8a5600;font-size:10px;font-weight:900}
      .demo-project-toolbar select{min-width:0;height:34px;border:1px solid #9eb6d6;border-radius:7px;background:#fff;padding:0 9px;color:#173b67;font-weight:700}
      .demo-project-toolbar button,.demo-menu-link{height:34px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #2768c9;border-radius:7px;padding:0 11px;background:#2768c9;color:#fff;font-size:11px;font-weight:800;text-decoration:none;cursor:pointer;white-space:nowrap}
      .demo-project-toolbar button.secondary{background:#fff;color:#2768c9}.demo-menu-link{background:#173b67;border-color:#173b67}
      .demo-project-badge{grid-column:1/5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:800;color:#173b67}.demo-project-toolbar small{font-size:10px;color:#687a91;text-align:right}
      .demo-screen-ribbon{position:fixed;right:-39px;top:96px;z-index:120;transform:rotate(45deg);width:150px;text-align:center;padding:5px;background:#c55316;color:#fff;font:900 11px/1 'Helvetica Neue',sans-serif;letter-spacing:2px;box-shadow:0 2px 9px rgba(0,0,0,.18);pointer-events:none}
      .demo-print-watermark{display:none}
      @media(max-width:980px){.demo-project-toolbar{grid-template-columns:1fr auto;top:0}.demo-toolbar-heading{grid-column:1/3}.demo-project-toolbar select{grid-column:1/3}.demo-menu-link{grid-column:1/3}.demo-project-badge{grid-column:1/3}.demo-project-toolbar small{grid-column:1/3;text-align:left}}
      @media print{.demo-project-toolbar,.demo-screen-ribbon{display:none!important}.demo-print-watermark{display:flex!important;position:fixed;inset:0;z-index:2147483647;pointer-events:none;align-items:center;justify-content:center;flex-direction:column;transform:rotate(-27deg);color:rgba(180,20,20,.17);font-family:'Helvetica Neue',sans-serif;text-align:center}.demo-print-watermark strong{font-size:110px;letter-spacing:18px;line-height:1}.demo-print-watermark span{margin-top:14px;font-size:30px;font-weight:900;letter-spacing:8px}.a4{outline:3px double rgba(185,28,28,.25)!important;outline-offset:-9px}}
    `;
    document.head.appendChild(style);
  }

  function boot(){
    if(!projects.length||typeof window.loadAllFromText!=='function'||typeof window.buildSaveData!=='function'){
      console.error('デモ案件または見積システムを初期化できませんでした');
      return;
    }
    const notice=document.getElementById('standaloneNotice');
    if(notice)notice.textContent='🔒 販売先デモ：本番・Supabaseとは完全分離。入力はこの端末内だけに保存され、印刷にはDEMO透かしが入ります。';
    window.openLedgerMenu=()=>{location.href='../';};
    window.loadMasterList=()=>{
      document.getElementById('demoProjectSelect')?.focus();
      if(typeof window.showToastMsg==='function')window.showToastMsg('上の「操作する案件」から管理番号を選択してください。');
    };
    addStyles();
    addDemoUi();

    const originalSchedule=window.scheduleOnlineAutosave;
    window.scheduleOnlineAutosave=function(delay=700){
      originalSchedule?.(delay);
      scheduleProjectSave(delay);
    };
    document.addEventListener('input',()=>scheduleProjectSave(650),true);
    document.addEventListener('change',()=>scheduleProjectSave(350),true);
    window.addEventListener('beforeunload',()=>saveCurrentProject(false));

    const requested=new URLSearchParams(location.search).get('managementNo');
    const stored=localStorage.getItem(SELECTED_KEY);
    loadProject(projectByNo(requested)?.managementNo||projectByNo(stored)?.managementNo||projects[0].managementNo);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));
  else setTimeout(boot,0);
})();
