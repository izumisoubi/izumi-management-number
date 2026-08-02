(function configureIzumiAuthSession(){
  'use strict';

  const supabaseSdk=window.supabase;
  if(!supabaseSdk||typeof supabaseSdk.createClient!=='function'||supabaseSdk.__izumiPersistentSessionConfigured)return;

  const originalCreateClient=supabaseSdk.createClient.bind(supabaseSdk);
  supabaseSdk.createClient=(url,key,options={})=>originalCreateClient(url,key,{
    ...options,
    auth:{
      autoRefreshToken:true,
      persistSession:true,
      detectSessionInUrl:true,
      storage:window.localStorage,
      ...(options.auth||{})
    }
  });
  Object.defineProperty(supabaseSdk,'__izumiPersistentSessionConfigured',{value:true});
})();
