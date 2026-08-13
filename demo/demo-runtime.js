(function(root){
  'use strict';

  const STORAGE_KEY='izumi_sales_demo_runtime_v2';
  const ESTIMATE_PROJECTS_KEY='izumi_sales_demo_projects_v3';
  const DEMO_USER={
    id:'demo-admin-user',
    email:'demo@sample-system.jp',
    user_metadata:{display_name:'デモ管理者'}
  };
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const now=()=>new Date().toISOString();
  const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const numberValue=value=>{const parsed=Number(String(value??'').replace(/[,，¥￥\s]/g,''));return Number.isFinite(parsed)?parsed:0};
  const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?value:null;
  const dataSource=()=>root.IZUMI_DEMO_DATA?.projects||[];

  function projectRow(project,index){
    const paid=project.paymentStatus==='入金済';
    const invoiced=project.invoiceDate&&project.invoiceDate!=='未発行';
    const completed=project.completedDate&&project.completedDate!=='未完了';
    return {
      id:project.id,
      management_number:project.managementNo,
      revision:1,
      reception_date:validDate(project.receptionDate),
      staff_name:project.staff,
      customer_name:project.customer,
      client_name:project.customer,
      billing_client_name:project.customer,
      customer_contact_name:project.customerContact,
      invoice_contact_name:project.customerContact,
      property_name:project.property,
      room_number:project.room,
      work_name:project.work,
      work_summary:project.work,
      site_address:project.address,
      customer_phone:project.phone,
      status:project.status,
      scheduled_completion_date:validDate(project.endDate),
      completed_on:validDate(project.completedDate),
      invoice_date:validDate(project.invoiceDate),
      accounting_month:project.accountingMonth,
      sales_estimate_ex_tax:project.salesEx,
      invoice_subtotal_ex_tax:invoiced?project.salesEx:null,
      sales_invoice_ex_tax:invoiced?project.salesEx:null,
      sales_invoice_tax_in:invoiced?project.salesIn:null,
      landlord_burden_ex_tax:Math.round(project.salesEx*.3),
      tenant_burden_ex_tax:Math.round(project.salesEx*.7),
      external_cost_ex_tax:project.costEx,
      fee_amount:project.referralFee||0,
      parking_expense:0,
      received_amount_ex_tax:paid?project.salesEx:null,
      bank_received_amount_ex_tax:paid?project.salesEx:0,
      customer_payment_status:paid?'入金済':'未入金',
      vendor_payment_status:project.orderStatus==='発注済'?(paid?'支払済':'未払'):'未発注',
      payment_received_on:paid?validDate(project.paidDate):null,
      accounting_year:'2026年度',
      category:'外注費',
      notes:project.note,
      deleted_at:null,
      created_at:`2026-08-${String(Math.min(index+1,28)).padStart(2,'0')}T09:00:00+09:00`,
      updated_at:now()
    };
  }

  function lineRows(project){
    return (project.lines||[]).map((line,index)=>({
      id:`${project.id}-line-${index+1}`,
      project_id:project.id,
      revision:1,
      document_type:'order',
      row_type:'item',
      line_no:index+1,
      item_name:line.name,
      description:line.name,
      specification:line.spec,
      quantity:line.quantity,
      unit:line.unit,
      cost_unit_ex_tax:Math.round(numberValue(line.costAmount)/Math.max(numberValue(line.quantity),1)),
      order_amount_ex_tax:line.costAmount,
      supplier_invoice_amount_ex_tax:project.paymentStatus==='入金済'?line.costAmount:null,
      supplier_invoice_date:project.paymentStatus==='入金済'?validDate(project.invoiceDate):null,
      supplier_payment_date:project.paymentStatus==='入金済'?validDate(project.paidDate):null,
      supplier_paid:project.paymentStatus==='入金済',
      line_status:project.paymentStatus==='入金済'?'支払済':project.orderStatus==='発注済'?'発注済':'未発注',
      vendor_name:line.vendor==='自社'?project.vendor:line.vendor,
      category:line.vendor==='自社'?'自社費':'外注費',
      ordered:line.ordered==='発注済',
      reminder_required:false,
      note:line.note,
      raw_data:{category:line.vendor==='自社'?'自社費':'外注費'},
      deleted_at:null,
      created_at:now(),
      updated_at:now()
    }));
  }

  function initialState(){
    const projects=dataSource();
    const vendors=[...new Set(projects.map(project=>project.vendor).filter(value=>value&&value!=='未割当'))]
      .map((name,index)=>({
        id:`vendor-${index+1}`,name,active:true,deleted_at:null,
        address:`東京都内 サンプル住所 ${index+1}`,invoice_registration_no:`T1234567890${String(index+10).slice(-2)}`,
        email:`vendor${index+1}@example.jp`,created_at:now(),updated_at:now()
      }));
    const vendorByName=new Map(vendors.map(vendor=>[vendor.name,vendor]));
    const purchaseOrders=projects.filter(project=>project.orderStatus==='発注済').map((project,index)=>{
      const vendor=vendorByName.get(project.vendor)||vendors[index%Math.max(vendors.length,1)];
      const poLines=(project.lines||[]).filter(line=>line.ordered==='発注済').map((line,lineIndex)=>({
        id:`po-${index+1}-line-${lineIndex+1}`,line_no:lineIndex+1,description:line.name,
        quantity:line.quantity,unit:line.unit,unit_price:Math.round(line.costAmount/Math.max(line.quantity,1)),
        amount:line.costAmount,tax_rate:.1
      }));
      return {
        id:`po-${index+1}`,project_id:project.id,po_no:project.orderNo,management_number:project.managementNo,
        status:project.paymentStatus==='入金済'?'completed':'issued',vendor_id:vendor?.id||null,
        vendors:vendor?{name:vendor.name}:null,work_name:project.work,property_name_snapshot:project.property,
        room_no_snapshot:project.room,completed_at:validDate(project.completedDate),
        subtotal:poLines.reduce((sum,line)=>sum+line.amount,0),tax:0,
        total:poLines.reduce((sum,line)=>sum+line.amount,0),purchase_order_lines:poLines,change_orders:[],
        deleted_at:null,created_at:now(),updated_at:now()
      };
    });
    const calendarEvents=projects.slice(0,12).map((project,index)=>({
      id:`calendar-${index+1}`,event_date:validDate(project.startDate)||`2026-08-${String(index+1).padStart(2,'0')}`,
      start_time:index%3===0?'09:00:00':index%3===1?'11:00:00':null,end_time:null,
      staff_name:project.staff,event_type:index%4===0?'工事':index%4===1?'現調・見積':index%4===2?'完工':'立会',
      event_status:'予定',return_status_text:'',client_name:project.customer,property_name:project.property,
      room_number:project.room,work_name:project.work,notes:project.note,management_number:project.managementNo,
      display_slot:index%5,created_by:DEMO_USER.id,updated_by:DEMO_USER.id,deleted_at:null,created_at:now(),updated_at:now()
    }));
    return {
      version:2,
      tables:{
        management_numbers:projects.map(projectRow),
        project_line_items:projects.flatMap(lineRows),
        project_manual_overrides:[],
        employee_master:['佐藤','鈴木','高橋','田中','伊藤','林'].map((name,index)=>({id:`employee-${index+1}`,name,display_order:index+1,active:true,department:index===5?'営業　外注':'営業',role:'employee'})),
        calendar_events:calendarEvents,
        vendors,
        purchase_orders:purchaseOrders,
        change_orders:[],
        payment_notices:[],
        payment_notice_lines:[],
        payment_notice_groups:[],
        meeting_access_members:[{email:DEMO_USER.email,display_name:'デモ管理者',active:true}],
        meeting_financial_inputs:[],
        bank_transactions:[
          {id:'bank-1',bank_code:'SMBC',transaction_date:'2026-08-01',direction:'credit',amount:286000,payer_name:'東都アセット（カ',description:'振込入金',status:'matched',revision:1,confirmed_at:now(),bank_payment_allocations:[{allocated_amount:286000,voided_at:null}]},
          {id:'bank-2',bank_code:'MUFG',transaction_date:'2026-08-02',direction:'credit',amount:198000,payer_name:'首都圏住宅管理',description:'振込入金',status:'unmatched',revision:1,confirmed_at:null,bank_payment_allocations:[]}
        ],
        project_audit_log:[
          {id:'audit-1',management_number:projects[0]?.managementNo,source_view:'management',action:'update',field_name:'accounting_month',old_value:'7月',new_value:'8月',changed_at:now(),changed_by_email:DEMO_USER.email,changed_by_name:'デモ管理者'}
        ],
        shared_master_records:[],client_unit_prices:[],vendor_unit_prices:[],vendor_effective_unit_prices:[],work_items:[],
        estimate_projects:[],estimate_drafts:[]
      },
      users:[{email:DEMO_USER.email,display_name:'デモ管理者',role:'admin',enabled:true,last_registered_at:now()}],
      backups:[]
    };
  }

  function loadState(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(saved?.version===2&&saved.tables)return saved;
    }catch(_error){}
    const state=initialState();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    return state;
  }
  function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  let state=loadState();

  function syncEstimateProjects(){
    try{
      const shared=JSON.parse(localStorage.getItem(ESTIMATE_PROJECTS_KEY)||'null');
      if(!Array.isArray(shared)||!shared.length)return;
      shared.forEach(source=>{
        const target=state.tables.management_numbers.find(row=>row.management_number===(source.managementNo||source.management_number));
        if(!target)return;
        const patch=source.project||source.data||source;
        if(patch.staff)target.staff_name=patch.staff;
        if(patch.customer)target.customer_name=target.client_name=target.billing_client_name=patch.customer;
        if(patch.property)target.property_name=patch.property;
        if(patch.room)target.room_number=patch.room;
        if(patch.work)target.work_name=target.work_summary=patch.work;
        if(Number.isFinite(Number(patch.salesEx)))target.sales_estimate_ex_tax=Number(patch.salesEx);
        target.updated_at=now();
      });
      saveState();
    }catch(_error){}
  }

  const matches=(row,filter)=>{
    const value=filter.column.split('.').reduce((current,key)=>current?.[key],row);
    switch(filter.op){
      case 'eq': return value===filter.value||String(value??'')===String(filter.value??'');
      case 'is': return filter.value===null?value==null:value===filter.value;
      case 'in': return filter.value.map(String).includes(String(value));
      case 'gte': return String(value??'')>=String(filter.value??'');
      case 'gt': return String(value??'')>String(filter.value??'');
      case 'lte': return String(value??'')<=String(filter.value??'');
      case 'lt': return String(value??'')<String(filter.value??'');
      case 'like': {
        const pattern=String(filter.value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replaceAll('%','.*').replaceAll('_','.');
        return new RegExp(`^${pattern}$`).test(String(value??''));
      }
      case 'ilike': {
        const pattern=String(filter.value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replaceAll('%','.*').replaceAll('_','.');
        return new RegExp(`^${pattern}$`,'i').test(String(value??''));
      }
      default:return true;
    }
  };

  class FakeQuery{
    constructor(table){this.table=table;this.filters=[];this.orders=[];this.rangeValue=null;this.limitValue=null;this.mutation=null;this.returning=false;this.singleMode='';this.head=false;this.countMode=false;}
    select(_columns='*',options={}){this.returning=true;this.head=Boolean(options?.head);this.countMode=options?.count==='exact';return this;}
    insert(values){this.mutation={type:'insert',values};return this;}
    update(values){this.mutation={type:'update',values};return this;}
    upsert(values,options={}){this.mutation={type:'upsert',values,options};return this;}
    delete(){this.mutation={type:'delete'};return this;}
    filter(op,column,value){this.filters.push({op,column,value});return this;}
    eq(column,value){return this.filter('eq',column,value)}
    is(column,value){return this.filter('is',column,value)}
    in(column,value){return this.filter('in',column,value||[])}
    gte(column,value){return this.filter('gte',column,value)}
    gt(column,value){return this.filter('gt',column,value)}
    lte(column,value){return this.filter('lte',column,value)}
    lt(column,value){return this.filter('lt',column,value)}
    like(column,value){return this.filter('like',column,value)}
    ilike(column,value){return this.filter('ilike',column,value)}
    order(column,options={}){this.orders.push({column,ascending:options.ascending!==false});return this;}
    range(from,to){this.rangeValue=[from,to];return this;}
    limit(value){this.limitValue=value;return this;}
    single(){this.singleMode='single';return this;}
    maybeSingle(){this.singleMode='maybe';return this;}
    then(resolve,reject){return this.execute().then(resolve,reject);}
    async execute(){
      syncEstimateProjects();
      const table=state.tables[this.table]||(state.tables[this.table]=[]);
      let rows=table.filter(row=>this.filters.every(filter=>matches(row,filter)));
      let changed=[];
      if(this.mutation?.type==='insert'){
        const values=Array.isArray(this.mutation.values)?this.mutation.values:[this.mutation.values];
        changed=values.map(value=>({id:value.id||uid(this.table),created_at:value.created_at||now(),updated_at:now(),...clone(value)}));
        table.push(...changed);
      }else if(this.mutation?.type==='update'){
        rows.forEach(row=>{Object.assign(row,clone(this.mutation.values),{updated_at:now()});changed.push(row)});
      }else if(this.mutation?.type==='delete'){
        const remove=new Set(rows);
        state.tables[this.table]=table.filter(row=>!remove.has(row));
        changed=rows;
      }else if(this.mutation?.type==='upsert'){
        const values=Array.isArray(this.mutation.values)?this.mutation.values:[this.mutation.values];
        const keys=String(this.mutation.options?.onConflict||'id').split(',').map(value=>value.trim());
        changed=values.map(value=>{
          const existing=table.find(row=>keys.every(key=>String(row[key]??'')===String(value[key]??'')));
          if(existing){Object.assign(existing,clone(value),{updated_at:now()});return existing}
          const created={id:value.id||uid(this.table),created_at:now(),updated_at:now(),...clone(value)};table.push(created);return created;
        });
      }
      if(this.mutation){saveState();rows=changed;}
      this.orders.slice().reverse().forEach(order=>rows.sort((left,right)=>{
        const a=left?.[order.column],b=right?.[order.column];
        const result=String(a??'').localeCompare(String(b??''),'ja',{numeric:true});
        return order.ascending?result:-result;
      }));
      const count=rows.length;
      if(this.rangeValue)rows=rows.slice(this.rangeValue[0],this.rangeValue[1]+1);
      if(this.limitValue!=null)rows=rows.slice(0,this.limitValue);
      let data=this.head?null:clone(rows);
      if(this.singleMode==='single'){
        if(rows.length!==1)return {data:null,error:{message:rows.length?'複数行が見つかりました。':'対象データが見つかりません。',code:'PGRST116'},count:this.countMode?count:null};
        data=clone(rows[0]);
      }else if(this.singleMode==='maybe')data=rows.length?clone(rows[0]):null;
      return {data,error:null,count:this.countMode?count:null};
    }
  }

  function upsertManualOverride(params){
    const table=state.tables.project_manual_overrides;
    const existing=table.find(row=>row.view_key===params.p_view_key&&row.row_key===params.p_row_key);
    const fields=params.p_field_values||{};
    if(!Object.keys(fields).length){
      if(existing)table.splice(table.indexOf(existing),1);
      saveState();return {deleted:true,revision:(existing?.revision||0)+1};
    }
    if(existing){existing.field_values=clone(fields);existing.revision=(existing.revision||0)+1;existing.updated_at=now();saveState();return existing;}
    const created={id:uid('override'),view_key:params.p_view_key,row_key:params.p_row_key,project_id:params.p_project_id,field_values:clone(fields),revision:1,created_at:now(),updated_at:now()};
    table.push(created);saveState();return created;
  }

  function applyProjectChanges(projectId,changes){
    const project=state.tables.management_numbers.find(row=>String(row.id)===String(projectId));
    if(!project)return [];
    const map={
      reception_date:'reception_date',input_date:'reception_date',staff_name:'staff_name',property_name:'property_name',property_room:'property_name',
      work_name:'work_name',scheduled_completion_date:'scheduled_completion_date',completed_on:'completed_on',accounting_month:'accounting_month',
      customer_name:'customer_name',customer_contact_name:'customer_contact_name',notes:'notes',invoice_date:'invoice_date'
    };
    const applied=[];
    Object.entries(changes||{}).forEach(([key,entry])=>{const target=map[key];if(!target)return;project[target]=entry?.requested??entry;applied.push(key)});
    project.revision=(project.revision||0)+1;project.updated_at=now();saveState();return applied;
  }

  async function rpc(name,params={}){
    syncEstimateProjects();
    const trueCalls=new Set(['is_current_app_user_enabled','is_management_admin','can_view_meeting','is_invited_email']);
    if(trueCalls.has(name))return {data:true,error:null};
    if(name==='get_my_app_profile')return {data:[{email:DEMO_USER.email,display_name:'デモ管理者',role:'admin',enabled:true}],error:null};
    if(name==='get_calendar_editor_directory')return {data:(params.p_user_ids||[]).map(id=>({user_id:id,display_name:'デモ管理者',email:DEMO_USER.email})),error:null};
    if(name==='issue_management_number_v2'){
      const code=String(params.p_fiscal_year||'26').padStart(2,'0');
      const numbers=state.tables.management_numbers.map(row=>Number(String(row.management_number||'').split('-')[1])).filter(Number.isFinite);
      const managementNumber=`${code}-${String(Math.max(9000,...numbers)+1)}`;
      const row={id:uid('demo-project'),management_number:managementNumber,revision:1,reception_date:params.p_reception_date,staff_name:params.p_staff_name,property_name:params.p_property_name||'',room_number:params.p_room_number||'',work_name:params.p_work_name||'',work_summary:params.p_work_name||'',customer_name:params.p_client_name||'',client_name:params.p_client_name||'',billing_client_name:params.p_client_name||'',status:'受付',accounting_month:`${Number(String(params.p_reception_date||'').slice(5,7))||8}月`,sales_estimate_ex_tax:0,external_cost_ex_tax:0,fee_amount:0,customer_payment_status:'未入金',vendor_payment_status:'未発注',deleted_at:null,created_at:now(),updated_at:now()};
      state.tables.management_numbers.push(row);saveState();
      try{
        const seeded=clone(dataSource());
        const seededNumbers=new Set(seeded.map(project=>project.managementNo));
        const stored=JSON.parse(localStorage.getItem(ESTIMATE_PROJECTS_KEY)||'[]');
        const shared=Array.isArray(stored)&&stored.some(project=>seededNumbers.has(project.managementNo))?stored:seeded;
        if(Array.isArray(shared)&&!shared.some(project=>project.managementNo===managementNumber)){
          const month=row.accounting_month;
          shared.unshift({managementNo:managementNumber,receptionDate:row.reception_date,staff:row.staff_name,customer:row.customer_name||'サンプル取引先株式会社',customerContact:'デモ担当様',property:row.property_name||'新規デモ案件',room:row.room_number||'',work:row.work_name||'見積作成',address:'東京都千代田区丸の内1-1-1',phone:'03-5550-1000',status:'見積作成',startDate:'未定',endDate:'未定',completedDate:'未完了',invoiceDate:'未発行',dueDate:'2026-10-31',paidDate:'未入金',accountingMonth:month,salesEx:0,costEx:0,selfLabor:0,selfMaterial:0,referralFee:0,vendor:'未割当',orderNo:'未発行',invoiceNo:'未発行',note:'販売デモで新規取得した案件',tax:0,salesIn:0,grossProfit:0,margin:0,paymentStatus:'未入金',orderStatus:'未発注',estimateDate:row.reception_date,estimateValidity:'見積日より1か月',paymentTerms:'月末締め翌月末払い',constructionCondition:'作業条件は現地確認後に確定',lines:[]});
          localStorage.setItem(ESTIMATE_PROJECTS_KEY,JSON.stringify(shared));
        }
      }catch(_error){}
      return {data:clone(row),error:null};
    }
    if(name==='sync_calendar_event_to_project')return {data:true,error:null};
    if(name==='save_project_manual_override')return {data:clone(upsertManualOverride(params)),error:null};
    if(name==='apply_ledger_blank_fields_to_estimate'||name==='sync_ledger_inputs_to_estimate')return {data:{applied:applyProjectChanges(params.p_project_id,params.p_changes)},error:null};
    if(name==='request_project_change'){
      state.tables.project_audit_log.unshift({id:uid('audit'),management_number:params.p_management_number,source_view:params.p_source_view,action:'update',field_name:Object.keys(params.p_changes||{}).join(', '),old_value:'',new_value:'台帳から修正',changed_at:now(),changed_by_email:DEMO_USER.email,changed_by_name:'デモ管理者'});saveState();return {data:true,error:null};
    }
    if(name==='save_billing_ledger_row'){
      const project=state.tables.management_numbers.find(row=>String(row.id)===String(params.p_project_id));
      if(project){const patch=params.p_patch||{};project.invoice_subtotal_ex_tax=patch.invoice_amount;project.received_amount_ex_tax=patch.received_amount;project.customer_payment_status=patch.received_checked?'入金済':'未入金';project.external_cost_ex_tax=patch.external_cost;project.vendor_payment_status=patch.external_paid?'支払済':'未払';project.invoice_date=patch.invoice_date;project.payment_received_on=patch.payment_received_on;project.accounting_month=patch.accounting_month;project.completed_on=project.completed_on||patch.payment_received_on;project.revision=(project.revision||0)+1;saveState();return {data:clone(project),error:null}}
      return {data:null,error:{message:'案件が見つかりません。'}};
    }
    if(name==='save_cost_ledger_row'){
      const saved=[];(params.p_lines||[]).forEach(patch=>{const line=state.tables.project_line_items.find(row=>String(row.id)===String(patch.id));if(!line)return;line.supplier_invoice_amount_ex_tax=patch.invoice_amount;line.supplier_invoice_date=patch.invoice_date;line.supplier_payment_date=patch.payment_date;line.supplier_paid=Boolean(patch.payment_date);line.reminder_required=Boolean(patch.reminder_required);line.revision=(line.revision||0)+1;saved.push(clone(line))});
      const project=state.tables.management_numbers.find(row=>String(row.id)===String(params.p_project_id));if(project){project.vendor_payment_status=(params.p_lines||[]).every(line=>line.payment_date)?'支払済':'未払';project.revision=(project.revision||0)+1}saveState();return {data:{lines:saved,vendor_payment_status:project?.vendor_payment_status,project_status:project?.status,project_revision:project?.revision},error:null};
    }
    if(name==='soft_delete_project'){
      const project=state.tables.management_numbers.find(row=>String(row.id)===String(params.p_project_id));if(project)project.deleted_at=now();saveState();return {data:true,error:null};
    }
    if(name==='soft_delete_project_lines'){
      state.tables.project_line_items.forEach(line=>{if((params.p_line_ids||[]).map(String).includes(String(line.id)))line.deleted_at=now()});saveState();return {data:true,error:null};
    }
    if(name==='admin_list_app_users')return {data:clone(state.users),error:null};
    if(name==='admin_upsert_app_user'){
      const existing=state.users.find(user=>user.email===params.p_email);const values={email:params.p_email,display_name:params.p_display_name,role:params.p_role,enabled:params.p_enabled,last_registered_at:existing?.last_registered_at||null};if(existing)Object.assign(existing,values);else state.users.push(values);saveState();return {data:values,error:null};
    }
    if(name==='admin_set_app_user_enabled'){const user=state.users.find(item=>item.email===params.p_email);if(user)user.enabled=params.p_enabled;saveState();return {data:true,error:null};}
    if(name==='get_project_audit_log')return {data:clone(state.tables.project_audit_log),error:null};
    if(name==='create_system_backup'){
      state.backups.unshift({id:uid('backup'),created_at:now(),source:'manual',row_counts:{management_numbers:state.tables.management_numbers.length,project_line_items:state.tables.project_line_items.length}});saveState();return {data:true,error:null};
    }
    if(name==='list_system_backups')return {data:clone(state.backups),error:null};
    if(name==='get_system_backup_payload')return {data:clone(state),error:null};
    if(name==='list_shared_master_records')return {data:clone(state.tables.shared_master_records),error:null};
    if(name==='save_shared_master_record'){
      const record={id:params.p_id||uid('master'),master_type:params.p_master_type,data:clone(params.p_data),active:true,updated_at:now()};const existing=state.tables.shared_master_records.find(row=>row.id===record.id);if(existing)Object.assign(existing,record);else state.tables.shared_master_records.push(record);saveState();return {data:clone(record),error:null};
    }
    if(name==='delete_shared_master_record'){state.tables.shared_master_records=state.tables.shared_master_records.filter(row=>row.id!==params.p_id);saveState();return {data:true,error:null};}
    if(name==='list_employee_stamps')return {data:[],error:null};
    if(name==='set_employee_stamp'||name==='seed_shared_master_records'||name==='save_client_unit_price'||name==='save_vendor_unit_price'||name==='save_work_item'||name==='deactivate_work_item'||name==='sync_vendor_business_master'||name==='deactivate_vendor_business_master'||name==='update_my_display_name')return {data:true,error:null};
    if(name==='create_staff_change_order'){
      const order=state.tables.purchase_orders.find(row=>String(row.id)===String(params.p_po_id));const co={id:uid('co'),co_no:`CO-D${String(state.tables.change_orders.length+1).padStart(3,'0')}`,po_id:params.p_po_id,reason:params.p_reason,detail:params.p_detail,amount:params.p_amount,tax_rate:params.p_tax_rate,status:'requested',revision:1,requested_by_type:'staff',purchase_orders:{po_no:order?.po_no||''},deleted_at:null,created_at:now()};state.tables.change_orders.push(co);saveState();return {data:clone(co),error:null};
    }
    if(name==='decide_change_order'){const co=state.tables.change_orders.find(row=>String(row.id)===String(params.p_co_id));if(co){co.status=params.p_decision;co.revision++;}saveState();return {data:clone(co),error:null};}
    if(name==='create_change_order_access_token')return {data:`DEMO-${params.p_po_id}-${Date.now()}`,error:null};
    if(name==='create_payment_notice_draft'){
      const vendor=state.tables.vendors.find(row=>String(row.id)===String(params.p_vendor_id));const group={id:uid('notice-group'),notice_no:`PN-D${String(state.tables.payment_notice_groups.length+1).padStart(3,'0')}`};state.tables.payment_notice_groups.push(group);const subtotal=(params.p_lines||[]).reduce((sum,line)=>sum+numberValue(line.amount_snapshot),0);const notice={id:uid('notice'),group_id:group.id,version:1,status:'draft',vendor_id:vendor?.id,vendor_name_snapshot:vendor?.name||'',vendor_address_snapshot:vendor?.address||'',vendor_invoice_reg_no_snapshot:vendor?.invoice_registration_no||'',issuer_name_snapshot:'株式会社サンプル装美',issuer_address_snapshot:'東京都千代田区丸の内1-1-1',issuer_invoice_reg_no_snapshot:'T1234567890123',issue_date:params.p_header?.issue_date||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),payment_due_date:params.p_header?.payment_due_date||null,approval_days:params.p_header?.approval_days||7,subtotal_snapshot:subtotal,tax_snapshot:Math.round(subtotal*.1),total_snapshot:subtotal+Math.round(subtotal*.1),revision:1,deleted_at:null,created_at:now(),updated_at:now(),payment_notice_groups:group};state.tables.payment_notices.push(notice);(params.p_lines||[]).forEach((line,index)=>state.tables.payment_notice_lines.push({id:uid('notice-line'),notice_id:notice.id,line_no:index+1,deleted_at:null,...clone(line)}));saveState();return {data:clone(notice),error:null};
    }
    if(name==='save_payment_notice_draft')return {data:true,error:null};
    if(name==='transition_payment_notice'){const notice=state.tables.payment_notices.find(row=>String(row.id)===String(params.p_notice_id));if(notice){notice.status=params.p_action==='void'?'void':params.p_action;notice.revision++;}saveState();return {data:clone(notice),error:null};}
    if(name==='import_bank_statement')return {data:{inserted:(params.p_rows||[]).length,skipped:0},error:null};
    if(name==='find_bank_payment_candidates')return {data:clone(state.tables.management_numbers.filter(row=>row.customer_payment_status!=='入金済').slice(0,8)),error:null};
    if(name==='confirm_bank_payment_allocations'||name==='void_bank_payment_match')return {data:true,error:null};
    if(name==='import_legacy_batch')return {data:{projects:(params.p_projects||[]).length,lines:(params.p_lines||[]).length},error:null};
    if(name==='save_project_bundle'||name==='save_estimate_draft')return {data:{revision:1,updated_at:now()},error:null};
    return {data:[],error:null};
  }

  const authListeners=new Set();
  const session={access_token:'demo-access-token',expires_at:4102444800,user:DEMO_USER};
  const auth={
    async getSession(){return {data:{session},error:null}},
    async getUser(){return {data:{user:DEMO_USER},error:null}},
    async signInWithPassword(){authListeners.forEach(callback=>callback('SIGNED_IN',session));return {data:{session,user:DEMO_USER},error:null}},
    async signOut(){return {error:null}},
    async updateUser(values){Object.assign(DEMO_USER.user_metadata,values?.data||{});return {data:{user:DEMO_USER},error:null}},
    onAuthStateChange(callback){authListeners.add(callback);setTimeout(()=>callback('INITIAL_SESSION',session),0);return {data:{subscription:{unsubscribe(){authListeners.delete(callback)}}}}}
  };
  const fakeClient={
    auth,
    from(table){return new FakeQuery(table)},
    rpc,
    storage:{from(){return {async upload(){return {data:{path:uid('demo-upload')},error:null}},async download(){return {data:new Blob(['DEMO'],{type:'application/octet-stream'}),error:null}},async createSignedUrl(){return {data:{signedUrl:'#demo'},error:null}}}}},
    functions:{async invoke(){return {data:{demo:true},error:null}}},
    channel(){return {on(){return this},subscribe(){return this},unsubscribe(){return Promise.resolve()}}},
    async removeChannel(){return true}
  };
  root.supabase={createClient(){return fakeClient}};
  root.IZUMI_SALES_DEMO={reset(){
    [...Array(localStorage.length)].map((_,index)=>localStorage.key(index)).filter(key=>key&&(key===STORAGE_KEY||key===ESTIMATE_PROJECTS_KEY||key.startsWith('izumi_sales_demo_estimate_project_v3_')||key.startsWith('izumi_sales_demo_estimate_selected_v3'))).forEach(key=>localStorage.removeItem(key));
    state=loadState();location.reload();
  },state:()=>clone(state)};

  function installDemoChrome(){
    const style=document.createElement('style');
    style.textContent=`
      .sales-demo-ribbon{position:fixed;z-index:2147483646;right:12px;top:12px;padding:7px 12px;border-radius:999px;background:#b42318;color:#fff;font:800 11px/1.2 -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;letter-spacing:.08em;box-shadow:0 4px 14px #0003;pointer-events:none}
      .sales-demo-reset{position:fixed;z-index:2147483645;right:12px;bottom:14px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#17345f;padding:8px 11px;font:800 10px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;box-shadow:0 5px 18px #17345f26;cursor:pointer}
      .sales-demo-watermark{display:none}
      @media print{.sales-demo-ribbon,.sales-demo-reset{display:none!important}.sales-demo-watermark{display:block!important;position:fixed;z-index:2147483647;inset:42% 0 auto;transform:rotate(-24deg);text-align:center;color:#b4231840;font:900 54pt/1 sans-serif;letter-spacing:.18em;pointer-events:none}.sales-demo-watermark small{display:block;font-size:16pt;margin-top:12px;letter-spacing:.08em}}
    `;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend','<div class="sales-demo-ribbon">DEMO・架空データ</div><div class="sales-demo-watermark">DEMO<small>業務利用不可</small></div><button class="sales-demo-reset" type="button">デモデータを初期化</button>');
    document.querySelector('.sales-demo-reset')?.addEventListener('click',()=>{if(confirm('入力したデモ内容を消して、初期状態へ戻しますか？'))root.IZUMI_SALES_DEMO.reset()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installDemoChrome,{once:true});
  else installDemoChrome();
})(globalThis);
