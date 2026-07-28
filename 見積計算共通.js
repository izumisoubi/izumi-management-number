(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.IzumiEstimateMath=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function numberOrNull(value){
    if(value===''||value===null||value===undefined)return null;
    const number=Number(String(value).replace(/[,，¥￥\s]/g,''));
    return Number.isFinite(number)?number:null;
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

  return Object.freeze({
    version:'1.0.0',
    numberOrNull,
    unitFromMargin,
    costAmount,
    customerUnit,
    customerAmount
  });
});
