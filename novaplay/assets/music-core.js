/* Music channels preserved from the creator's previous catalog selection. */
(()=>{
 "use strict";
 const restoredIds=new Set(["b0d21887-19fa-4690-b89b-46cd915122d7", "d1617ab0-d6bb-40bf-9d22-3572b7281a3b", "a3572c3b-9035-4efb-a34e-6bb1dcb3b584", "ce5cc728-4263-408c-bc4e-18250d77813b", "97255d33-aeb4-4b8f-af35-45c760aa369d", "9feb4509-0a90-4745-b26c-4793409e3396", "e9e86923-dd79-4ff7-8cfe-f773338433e9", "864f656a-f801-499b-8342-84855170d512", "eac41ed9-9943-4df7-b752-a4b7658c19ab", "11aa7732-a737-4e9b-983f-40537d701ad8", "04dec8cd-8ddc-4ead-b08b-b6323ed1caec", "1c40a593-0613-461a-80bb-61bfa3d3dde3", "b9d21620-463d-4731-b5da-747e61c00304", "d17c4e4f-6186-49d4-85a4-9b0474eb85a0", "f083b6b9-27a4-4979-b7fe-659a308d07c3", "442e9f7f-cc5e-40b9-b7a8-719ef5ab2a43", "aea88f12-723e-43c6-8dd0-26bcbb8ac131"]);
 const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 function isMusic(item){
  if(restoredIds.has(item.id))return true;
  // Include normal Portuguese, English category lists and old mojibake imports.
  return /(?:^|[;|,/])\s*(?:musica|music|ma[ºo]sica)\s*(?:$|[;|,/])/.test(normalize(item.category));
 }
 function select(channels,scope){
  const seen=new Set();
  return channels.filter(item=>{
   if(!item.embed_url||isMusic(item)!==(scope==="musica"))return false;
   const key=String(item.embed_url).trim().replace(/#.*$/,"");
   if(seen.has(key))return false;seen.add(key);return true;
  });
 }
 window.NPlayMusic={isMusic,select};
})();
