// Files stay off the UI thread; only the selected batch is sent back.
importScripts('./m3u-core.js?v=0.49.6');
self.onmessage=async event=>{
 try{
  const {file,text,offset}=event.data;
  if(file&&file.size>NPlayM3u.MAX_LIST_BYTES)throw Error('O arquivo excedeu 100 MB.');
  const input=file?await file.text():text;
  self.postMessage({result:NPlayM3u.parseList(input,500,offset)});
 }catch(error){self.postMessage({error:error.message});}
};
