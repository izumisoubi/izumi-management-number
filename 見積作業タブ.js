(function(){
  const WORKSPACE_NAME='izumi-estimate-workspace';
  document.addEventListener('click',function(event){
    const link=event.target.closest?.('a[href]');
    if(!link)return;
    const target=new URL(link.getAttribute('href'),location.href);
    // 管理番号付きリンクは、選択した案件を読み込む通常遷移のままにする。
    if(!target.pathname.endsWith('/estimate.html')||target.search||target.hash)return;
    event.preventDefault();
    const workspace=window.open('',WORKSPACE_NAME);
    if(!workspace)return;
    try{
      if(workspace.location.href==='about:blank')workspace.location.replace(target.href);
      else workspace.focus();
    }catch(_error){workspace.location.href=target.href;}
  });
})();
