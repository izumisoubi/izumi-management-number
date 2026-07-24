(function(){
  document.addEventListener('click',function(event){
    const link=event.target.closest?.('a[href]');
    if(!link)return;
    const target=new URL(link.getAttribute('href'),location.href);
    // 管理番号付きリンクは、選択した案件を読み込む通常遷移のままにする。
    if(!target.pathname.endsWith('/estimate.html')||target.search||target.hash)return;
    event.preventDefault();
    location.assign(target.href);
  });
})();
