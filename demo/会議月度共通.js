(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.IzumiMeetingPeriod=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function normalizeMonth(value){
    const text=String(value??'').trim();
    if(!text)return 0;
    const direct=Number(text.replace('月',''));
    if(Number.isInteger(direct)&&direct>=1&&direct<=12)return direct;
    const dateMatch=text.match(/^\d{4}[-/](\d{1,2})/);
    const month=Number(dateMatch?.[1]);
    return Number.isInteger(month)&&month>=1&&month<=12?month:0;
  }
  function nextMonth(value){
    const month=normalizeMonth(value);
    return month?month%12+1:0;
  }
  function isMoved(baseMonth,targetMonth){
    const base=normalizeMonth(baseMonth);
    const target=normalizeMonth(targetMonth);
    return Boolean(base&&target&&base!==target);
  }
  function inferYear(baseYear,baseMonth,targetMonth){
    let year=Number(baseYear)||0;
    const base=normalizeMonth(baseMonth);
    const target=normalizeMonth(targetMonth);
    if(!year||!base||!target)return year;
    const delta=target-base;
    if(delta<=-6)year+=1;
    else if(delta>=6)year-=1;
    return year;
  }
  return {normalizeMonth,nextMonth,isMoved,inferYear};
});
