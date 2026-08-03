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

  return Object.freeze({
    version:'1.2.0',
    normalizeNumericText,
    isIncompleteNumericText,
    isTransientNumericText,
    evaluateArithmeticExpression,
    numberOrNull,
    unitFromMargin,
    costAmount,
    customerUnit,
    customerAmount,
    burdenSplitFromGross
  });
});
