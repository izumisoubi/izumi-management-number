(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.IzumiSelfCosts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SLOT_COUNT=3;
  function numberValue(value){
    const parsed=parseFloat(String(value??'').replace(/,/g,''));
    return Number.isFinite(parsed)?parsed:0;
  }
  function slotKey(prefix,index){return `${prefix}_${index}`;}
  function hasSlotValue(data,prefix){
    return Array.from({length:SLOT_COUNT},(_,i)=>slotKey(prefix,i+1))
      .some(key=>data[key]!==undefined&&data[key]!==null&&data[key]!=='');
  }
  function slotTotal(data,prefix){
    return Array.from({length:SLOT_COUNT},(_,i)=>numberValue(data[slotKey(prefix,i+1)]))
      .reduce((sum,value)=>sum+value,0);
  }
  function grossKey(prefix,index){return `${prefix}_inc_${index}`;}
  function normalize(data){
    const next={...(data&&typeof data==='object'&&!Array.isArray(data)?data:{})};
    ['jisha_jin','jisha_mat'].forEach(prefix=>{
      if(!hasSlotValue(next,prefix)&&numberValue(next[prefix])!==0)next[slotKey(prefix,1)]=String(numberValue(next[prefix]));
      for(let index=1;index<=SLOT_COUNT;index++){
        const netKey=slotKey(prefix,index);
        const incKey=grossKey(prefix,index);
        const hasNet=next[netKey]!==undefined&&next[netKey]!==null&&next[netKey]!=='';
        const hasGross=next[incKey]!==undefined&&next[incKey]!==null&&next[incKey]!=='';
        if(!hasNet&&hasGross)next[netKey]=String(Math.round(numberValue(next[incKey])/1.1));
        if(!hasGross&&numberValue(next[netKey])!==0)next[incKey]=String(Math.round(numberValue(next[netKey])*1.1));
      }
      next[prefix]=String(slotTotal(next,prefix));
    });
    return next;
  }
  function setSlot(data,key,value){
    const match=/^(jisha_jin|jisha_mat)_([1-3])$/.exec(String(key||''));
    if(!match)return normalize(data);
    const next=normalize(data);
    next[key]=value===''?'':String(numberValue(value));
    next[grossKey(match[1],Number(match[2]))]=value===''?'':String(Math.round(numberValue(value)*1.1));
    next[match[1]]=String(slotTotal(next,match[1]));
    return next;
  }
  function setGross(data,key,value){
    const match=/^(jisha_jin|jisha_mat)_inc_([1-3])$/.exec(String(key||''));
    if(!match)return normalize(data);
    const next=normalize(data);
    const netKey=slotKey(match[1],Number(match[2]));
    next[key]=value===''?'':String(numberValue(value));
    next[netKey]=value===''?'':String(Math.round(numberValue(value)/1.1));
    next[match[1]]=String(slotTotal(next,match[1]));
    return next;
  }
  function setTotal(data,prefix,value){
    if(!['jisha_jin','jisha_mat'].includes(prefix))return normalize(data);
    const next=normalize(data);
    next[slotKey(prefix,1)]=value===''?'':String(numberValue(value));
    next[grossKey(prefix,1)]=value===''?'':String(Math.round(numberValue(value)*1.1));
    for(let index=2;index<=SLOT_COUNT;index++){
      next[slotKey(prefix,index)]='';
      next[grossKey(prefix,index)]='';
    }
    next[prefix]=String(numberValue(value));
    return next;
  }
  return {SLOT_COUNT,numberValue,slotKey,grossKey,slotTotal,normalize,setSlot,setGross,setTotal};
});
