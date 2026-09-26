(function(){
  if(!window.__nbGaLoaded){
    window.__nbGaLoaded=true;
    var s=document.createElement("script");
    s.async=true;
    s.src="https://www.googletagmanager.com/gtag/js?id=G-XSB3WYJZ71";
    document.head.appendChild(s);
    window.dataLayer=window.dataLayer||[];
    window.gtag=function(){dataLayer.push(arguments);};
    gtag("js",new Date());
    gtag("config","G-XSB3WYJZ71",{send_page_view:true});
  }
})();

(function(){
  var ATTR_KEYS=["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","gbraid","wbraid","ttclid"];

  function safeHost(value){
    try{return value ? new URL(value,location.href).hostname : "";}catch(e){return "";}
  }

  function readJson(key){
    try{return JSON.parse(sessionStorage.getItem(key)||"{}");}catch(e){return {};}
  }

  function getLeadId(){
    try{
      var existing=sessionStorage.getItem("nb_lead_id");
      if(existing) return existing;
      var raw=(Date.now().toString(36)+Math.random().toString(36).slice(2,8)).toUpperCase();
      var id="NB-"+raw.slice(-8);
      sessionStorage.setItem("nb_lead_id",id);
      return id;
    }catch(e){
      return "NB-"+Date.now().toString(36).toUpperCase().slice(-8);
    }
  }

  function captureAttribution(){
    var stored=readJson("nb_attribution");
    try{
      var params=new URLSearchParams(location.search);
      ATTR_KEYS.forEach(function(k){
        var v=params.get(k);
        if(v) stored[k]=v;
      });
      if(!stored.landing_page) stored.landing_page=location.pathname+location.search;
      if(!stored.referrer) stored.referrer=document.referrer||"";
      if(!stored.referrer_host) stored.referrer_host=safeHost(document.referrer);
      if(!stored.first_seen_at) stored.first_seen_at=new Date().toISOString();

      if(stored.fbclid && !stored.utm_source) stored.utm_source="facebook";
      if(stored.fbclid && !stored.utm_medium) stored.utm_medium="paid_social";
      if(stored.gclid && !stored.utm_source) stored.utm_source="google";
      if(stored.gclid && !stored.utm_medium) stored.utm_medium="paid_search";

      sessionStorage.setItem("nb_attribution",JSON.stringify(stored));
      sessionStorage.setItem("nb_utm",JSON.stringify({
        utm_source:stored.utm_source||"",
        utm_medium:stored.utm_medium||"",
        utm_campaign:stored.utm_campaign||"",
        utm_term:stored.utm_term||"",
        utm_content:stored.utm_content||""
      }));
    }catch(e){}
    return stored;
  }

  var attribution=captureAttribution();
  var leadId=getLeadId();

  function baseParams(){
    return {
      page_path:location.pathname,
      page_title:document.title,
      landing_page:attribution.landing_page||"",
      traffic_source:attribution.utm_source||"",
      traffic_medium:attribution.utm_medium||"",
      traffic_campaign:attribution.utm_campaign||"",
      traffic_term:attribution.utm_term||"",
      traffic_content:attribution.utm_content||"",
      referrer_host:attribution.referrer_host||"",
      click_id_type:attribution.fbclid?"fbclid":(attribution.gclid?"gclid":(attribution.ttclid?"ttclid":"")),
      lead_id:leadId
    };
  }

  function track(name,params){
    var payload=Object.assign({event:name},baseParams(),params||{});
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push(payload);
    if(typeof window.gtag==="function"){
      var gaParams=Object.assign({},baseParams(),params||{});
      window.gtag("event",name,gaParams);
    }
  }

  function ctaMeta(a){
    var section=a.closest("header,section,footer");
    var position="body";
    if(section){
      if(section.tagName==="HEADER") position="header";
      else if(section.tagName==="FOOTER") position="footer";
      else if(section.classList.contains("hero")) position="hero";
      else if(section.querySelector(".final")) position="final";
      else position="section";
    }
    return {
      cta_id:(a.dataset&&a.dataset.nbCta)||a.id||"",
      cta_position:(a.dataset&&a.dataset.nbPosition)||position,
      link_text:(a.textContent||"").trim().replace(/\s+/g," ").slice(0,120)
    };
  }

  function appendLeadRefToWhatsApp(a){
    if(!(a.dataset&&a.dataset.nbRef==="message")) return;
    try{
      var u=new URL(a.href,location.href);
      var text=u.searchParams.get("text")||"";
      if(text.indexOf(leadId)===-1){
        text=text.replace(/\s+$/,"")+"\n\nRef: "+leadId;
        u.searchParams.set("text",text);
        a.href=u.toString();
      }
    }catch(e){}
  }

  document.addEventListener("click",function(e){
    var a=e.target.closest("a");
    if(!a) return;
    var href=a.getAttribute("href")||"";
    var meta=ctaMeta(a);

    if(/wa\.me\//i.test(href)){
      appendLeadRefToWhatsApp(a);
      track("whatsapp_click",Object.assign({
        link_url:a.href,
        conversion_type:"lead_whatsapp"
      },meta));
    } else if(/search\.google\.com\/local\/writereview/i.test(href)){
      track("google_review_click",Object.assign({link_url:href},meta));
    } else if(a.dataset && a.dataset.nbTrack){
      track(a.dataset.nbTrack,Object.assign({link_url:href},meta));
    }
  },true);
})();