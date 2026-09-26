(function(){
  try{
    var params=new URLSearchParams(location.search);
    var utm={};
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(function(k){
      var v=params.get(k); if(v) utm[k]=v;
    });
    if(Object.keys(utm).length){ sessionStorage.setItem("nb_utm",JSON.stringify(utm)); }
  }catch(e){}

  function track(name,params){
    var payload=Object.assign({event:name,page_path:location.pathname},params||{});
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push(payload);
    if(typeof window.gtag==="function"){
      window.gtag("event",name,params||{});
    }
  }

  document.addEventListener("click",function(e){
    var a=e.target.closest("a");
    if(!a) return;
    var href=a.getAttribute("href")||"";
    if(/wa\.me\//i.test(href)){
      track("whatsapp_click",{link_url:href,link_text:(a.textContent||"").trim().slice(0,120)});
    } else if(/search\.google\.com\/local\/writereview/i.test(href)){
      track("google_review_click",{link_url:href});
    } else if(a.dataset && a.dataset.nbTrack){
      track(a.dataset.nbTrack,{link_url:href,link_text:(a.textContent||"").trim().slice(0,120)});
    }
  },true);
})();