(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.IzumiGridCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function clamp(value,min,max){
    const number=Number.isFinite(Number(value))?Number(value):min;
    return Math.max(min,Math.min(max,number));
  }

  function normalizeRange(start,end,bounds={}){
    const maxRow=Math.max(0,Number(bounds.rows||1)-1);
    const maxCol=Math.max(0,Number(bounds.cols||1)-1);
    const startRow=clamp(start?.row??start?.r??0,0,maxRow);
    const startCol=clamp(start?.col??start?.c??0,0,maxCol);
    const endRow=clamp(end?.row??end?.r??startRow,0,maxRow);
    const endCol=clamp(end?.col??end?.c??startCol,0,maxCol);
    const r1=Math.min(startRow,endRow);
    const r2=Math.max(startRow,endRow);
    const c1=Math.min(startCol,endCol);
    const c2=Math.max(startCol,endCol);
    return{r1,r2,c1,c2,rows:r2-r1+1,cols:c2-c1+1};
  }

  function parseTsv(text){
    const lines=String(text??'').replace(/\r/g,'').split('\n');
    while(lines.length>1&&lines[lines.length-1]==='')lines.pop();
    const matrix=(lines.length?lines:['']).map(line=>line.split('\t'));
    const cols=Math.max(1,...matrix.map(row=>row.length));
    matrix.forEach(row=>{while(row.length<cols)row.push('');});
    return matrix;
  }

  function matrixToTsv(matrix,lineEnding='\n'){
    return(matrix||[]).map(row=>(row||[]).map(value=>String(value??'')).join('\t')).join(lineEnding);
  }

  function planPaste(matrix,range,columnCount=Infinity){
    const source=Array.isArray(matrix)&&matrix.length?matrix:[['']];
    const clipRows=source.length;
    const clipCols=Math.max(1,...source.map(row=>Array.isArray(row)?row.length:0));
    const selected=normalizeRange(
      {row:range?.r1??0,col:range?.c1??0},
      {row:range?.r2??range?.r1??0,col:range?.c2??range?.c1??0},
      {
        rows:Math.max(1,(range?.r2??range?.r1??0)+1),
        cols:Math.max(1,Number.isFinite(columnCount)?columnCount:(range?.c2??range?.c1??0)+clipCols)
      }
    );
    const repeats=(selected.rows>1||selected.cols>1)&&selected.rows%clipRows===0&&selected.cols%clipCols===0;
    const rows=repeats?selected.rows:clipRows;
    const requestedCols=repeats?selected.cols:clipCols;
    const cols=Math.max(0,Math.min(requestedCols,columnCount-selected.c1));
    return{
      startRow:selected.r1,
      startCol:selected.c1,
      rows,
      cols,
      clipRows,
      clipCols,
      repeatsSelection:repeats,
      valueAt(rowOffset,colOffset){
        const row=source[rowOffset%clipRows]||[];
        return row[colOffset%clipCols]??'';
      }
    };
  }

  function movePoint(point,key,bounds={},options={}){
    const rows=Math.max(1,Number(bounds.rows||1));
    const cols=Math.max(1,Number(bounds.cols||1));
    let row=clamp(point?.row??0,0,rows-1);
    let col=clamp(point?.col??0,0,cols-1);
    if(key==='ArrowUp')row--;
    else if(key==='ArrowDown')row++;
    else if(key==='ArrowLeft')col--;
    else if(key==='ArrowRight')col++;
    else if(key==='Tab'){
      const direction=options.shiftKey?-1:1;
      col+=direction;
      if(col>=cols){col=0;row++;}
      if(col<0){col=cols-1;row--;}
    }
    return{row:clamp(row,0,rows-1),col:clamp(col,0,cols-1)};
  }

  function rangeMatrix(range,readCell){
    const matrix=[];
    for(let row=range.r1;row<=range.r2;row++){
      const values=[];
      for(let col=range.c1;col<=range.c2;col++)values.push(readCell(row,col));
      matrix.push(values);
    }
    return matrix;
  }

  return Object.freeze({
    version:'1.0.0',
    normalizeRange,
    parseTsv,
    matrixToTsv,
    planPaste,
    movePoint,
    rangeMatrix
  });
});
