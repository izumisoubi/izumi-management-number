(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.IzumiEstimateMath=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function normalizeNumericText(value){
    return String(value??'')
      .normalize('NFKC')
      .replace(/[\u2212‐-―]/g,'-')
      .replace(/[×✕✖]/g,'*')
      .replace(/[÷]/g,'/')
      .replace(/[，．]/g,char=>char==='，'?',':'.')
      .replace(/[,￥¥\s]/g,'');
  }

  // 見積セル用の計算式。eval / Function は使わず、
  // 数値・四則演算・括弧以外を受け付けない。
  function evaluateArithmeticExpression(value){
    const source=normalizeNumericText(value);
    if(!source.startsWith('=')||source.length>200)return null;
    const text=source.slice(1);
    if(!text||!/^[0-9.+\-*/()]+$/.test(text))return null;
    let index=0;

    function skip(){while(text[index]===' ')index++;}
    function number(){
      skip();
      const start=index;
      let dots=0;
      while(index<text.length&&/[0-9.]/.test(text[index])){
        if(text[index]==='.'&&++dots>1)return null;
        index++;
      }
      if(start===index)return null;
      const parsed=Number(text.slice(start,index));
      return Number.isFinite(parsed)?parsed:null;
    }
    function primary(){
      skip();
      if(text[index]==='('){
        index++;
        const result=expression();
        skip();
        if(result===null||text[index]!==')')return null;
        index++;
        return result;
      }
      return number();
    }
    function unary(){
      skip();
      if(text[index]==='+'||text[index]==='-'){
        const sign=text[index++]==='-'?-1:1;
        const result=unary();
        return result===null?null:sign*result;
      }
      return primary();
    }
    function term(){
      let result=unary();
      if(result===null)return null;
      while(true){
        skip();
        const operator=text[index];
        if(operator!=='*'&&operator!=='/')break;
        index++;
        const right=unary();
        if(right===null||(operator==='/'&&right===0))return null;
        result=operator==='*'?result*right:result/right;
        if(!Number.isFinite(result))return null;
      }
      return result;
    }
    function expression(){
      let result=term();
      if(result===null)return null;
      while(true){
        skip();
        const operator=text[index];
        if(operator!=='+'&&operator!=='-')break;
        index++;
        const right=term();
        if(right===null)return null;
        result=operator==='+'?result+right:result-right;
        if(!Number.isFinite(result))return null;
      }
      return result;
    }

    const result=expression();
    skip();
    return result!==null&&index===text.length&&Number.isFinite(result)?result:null;
  }

  function numberOrNull(value){
    if(value===''||value===null||value===undefined)return null;
    const normalized=normalizeNumericText(value);
    if(normalized.startsWith('='))return evaluateArithmeticExpression(normalized);
    const number=Number(normalized);
    return Number.isFinite(number)?number:null;
  }

  // 「12.」は12の確定値ではなく、12.8などを入力している途中。
  // inputイベント中はこの状態を保持し、フォーカスが外れた時だけ確定する。
  function isIncompleteNumericText(value){
    const normalized=normalizeNumericText(value);
    return /^[-+]?(?:\d+)?\.$/.test(normalized);
  }

  // 小数点・小数点以下の末尾0・計算式の入力途中は、再計算によって文字を消さない。
  // 例: 「12.」「1.0」「=5*」は次の1文字を待つ状態。
  function isTransientNumericText(value){
    const normalized=normalizeNumericText(value);
    return isIncompleteNumericText(normalized)
      ||/^[-+]?(?:\d+)?\.\d*0$/.test(normalized)
      ||(normalized.startsWith('=')&&evaluateArithmeticExpression(normalized)===null);
  }

  function unitFromMargin(cost,marginRate){
    const amount=numberOrNull(cost);
    const rate=numberOrNull(marginRate)??0;
    if(amount===null)return null;
    return rate>=100?Math.round(amount):Math.round(amount/(1-rate/100));
  }

  function costAmount(quantity,costUnit){
    const qty=numberOrNull(quantity);
    const unit=numberOrNull(costUnit);
    return qty===null||unit===null?null:Math.round(qty*unit);
  }

  function customerUnit(costUnit,marginRate,manualUnit='',rowType='item'){
    const manual=numberOrNull(manualUnit);
    if(manual!==null)return manual;
    if(rowType==='discount')return null;
    return unitFromMargin(costUnit,marginRate);
  }

  function customerAmount(quantity,costUnit,marginRate,manualUnit='',rowType='item'){
    const qty=numberOrNull(quantity);
    const unit=customerUnit(costUnit,marginRate,manualUnit,rowType);
    return qty===null||unit===null?null:Math.round(qty*unit);
  }

  function burdenSplitFromGross(customerNet,enteredGross,source='landlord'){
    const net=numberOrNull(customerNet);
    const entered=numberOrNull(enteredGross);
    if(net===null||entered===null)return null;
    const totalGross=Math.max(0,Math.round(net*1.1));
    const sourceGross=Math.max(0,Math.min(totalGross,Math.round(entered)));
    const sourceRate=totalGross?Number((sourceGross/totalGross*100).toFixed(2)):0;
    const otherRate=Number((100-sourceRate).toFixed(2));
    const otherGross=totalGross-sourceGross;
    return source==='tenant'
      ?{landlordRate:otherRate,tenantRate:sourceRate,landlordGross:otherGross,tenantGross:sourceGross,totalGross}
      :{landlordRate:sourceRate,tenantRate:otherRate,landlordGross:sourceGross,tenantGross:otherGross,totalGross};
  }

  // 旧台帳には元の見積明細が無く、業者別の集計原価だけが残っている。
  // そのため「1原価行 = 1式の見積下書き」として再構成する。
  // 過去の売上見積合計がある場合は、各行の原価比で配分し、
  // 最終行で端数を調整して必ず合計を一致させる。
  function reconstructImportedEstimateRows(lines,salesTotal){
    const source=(Array.isArray(lines)?lines:[]).filter(line=>{
      if(!line||typeof line!=='object')return false;
      return [
        line.item_name,line.vendor_name,line.category,line.note,
        line.order_amount_ex_tax,line.cost_amount_ex_tax,
        line.raw_data?.estimate_amount_ex_tax,line.raw_data?.work_name
      ].some(value=>String(value??'').trim()!=='');
    });
    if(!source.length)return[];

    const costs=source.map(line=>{
      const amount=numberOrNull(line.order_amount_ex_tax)
        ??numberOrNull(line.cost_amount_ex_tax)
        ??numberOrNull(line.raw_data?.estimate_amount_ex_tax)
        ??0;
      return Math.round(amount);
    });
    const weights=costs.map(amount=>Math.abs(amount));
    const totalWeight=weights.reduce((sum,amount)=>sum+amount,0);
    const target=numberOrNull(salesTotal);
    const roundedTarget=target===null?null:Math.round(target);
    let allocated=0;

    return source.map((line,index)=>{
      let sellOverride='';
      if(roundedTarget!==null){
        const amount=index===source.length-1
          ?roundedTarget-allocated
          :totalWeight>0
            ?Math.round(roundedTarget*weights[index]/totalWeight)
            :(index===0?roundedTarget:0);
        allocated+=amount;
        sellOverride=amount;
      }
      const raw=line.raw_data&&typeof line.raw_data==='object'?line.raw_data:{};
      return {
        type:'item',
        name:String(line.item_name||raw.work_name||line.category||line.vendor_name||'過去原価'),
        spec:'',
        qty:1,
        unit:'式',
        cost:costs[index],
        orderCost:costs[index],
        sellOverride,
        note:String(line.note||raw.notes||''),
        vendor:String(line.vendor_name||raw.vendor_name||''),
        category:String(line.category||raw.category||'外注費'),
        _legacyImport:true,
        _legacySourceKey:String(line.source_row_key||''),
        _legacyLineIndex:Number.isInteger(Number(line.line_index))?Number(line.line_index):null,
        _legacyRawData:{...raw}
      };
    });
  }

  // 台帳に見積合計だけが残り、元の明細が無い過去案件用。
  // 存在しない明細を推測せず、台帳の合計を1式の下書きとして忠実に復元する。
  function reconstructLedgerTotalEstimateRow(item){
    const sales=numberOrNull(item?.sales_estimate_ex_tax
      ??item?.invoice_subtotal_ex_tax
      ??item?.sales_invoice_ex_tax);
    if(sales===null||sales===0)return null;
    return {
      type:'item',
      name:String(item?.work_name||'工事一式'),
      spec:'',
      qty:1,
      unit:'式',
      cost:'',
      orderCost:'',
      sellOverride:Math.round(sales),
      note:'',
      vendor:'',
      category:String(item?.category||'外注費'),
      _ledgerTotalFallback:true
    };
  }

  return Object.freeze({
    version:'1.3.0',
    normalizeNumericText,
    isIncompleteNumericText,
    isTransientNumericText,
    evaluateArithmeticExpression,
    numberOrNull,
    unitFromMargin,
    costAmount,
    customerUnit,
    customerAmount,
    burdenSplitFromGross,
    reconstructImportedEstimateRows,
    reconstructLedgerTotalEstimateRow
  });
});
