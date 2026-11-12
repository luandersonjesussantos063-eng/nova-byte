#!/usr/bin/env python3
"""Gera questões reais da PMESP a partir dos cadernos de cinco edições.

Somente as fontes listadas em SOURCES são aceitas. Nunca inventa enunciados,
alternativas ou respostas. Verifica 60 itens por prova antes de publicar.
"""
from __future__ import annotations
import json, re, pathlib, sys, urllib.request, time, shutil
from collections import defaultdict
import fitz

ROOT=pathlib.Path(__file__).resolve().parents[1]
TARGET=ROOT/"banco-transcrito.js"
IMAGE_DIR=ROOT/"figuras"
WORK=ROOT/"_tmp_cadernos"

SOURCES={
 "2021": {"urls":[
   "https://cdn.eadplataforma.app/client/profpimentel/upload/files/549cd72757de9b05b58ea0d691f6411b_soldado-prova-maio-de-2021pdf.pdf",
   "https://www.cursopalestragratuita.com.br/portal/wp-content/uploads/2021/06/prova-soldado-pm-2021.pdf"],"format":"vunesp","id":"pmesp21","total":60},
 "2023": {"urls":[
   "https://cdn.eadplataforma.app/client/profpimentel/upload/files/f536afea5466d3fec6d06f3be928e243_prova-setembro-de-2023pdf.pdf",
   "https://corrijame-site-files.s3.amazonaws.com/wp-content/uploads/2024/01/08161716/2023-prova-setembro.pdf"],"format":"vunesp","id":"pmesp23","total":60},
 "2024": {"urls":[
   "https://conhecimento.fgv.br/sites/default/files/concursos/soldado-pm-de-2a-classe-cnm001-tipo-1.pdf"],"format":"fgv","id":"pmesp24","total":60},
 "2025": {"urls":[
   "https://conhecimento.fgv.br/sites/default/files/concursos/soldado-pm-de-2a-classe-cnm001-tipo-1_0.pdf"],"format":"fgv","id":"pmesp25","total":60},
 "2026": {"urls":[
   "https://dsoconcursos.com.br/wp-content/uploads/2026/09/Prova-pmsp.pdf"],"format":"vunesp","id":"pmesp","total":60}
}
KEY2021="C E C C B A D B A E A D B C E C B C A D B A E C B A D B D C E A A B D E C A D D B A E D C C A D B E A E C D B E B D A D".split()
# O único documento oficial de 2023 que foi conferido é preliminar.
# Para evitar respostas incorretas, não o usamos para pontuar.
KEYS={
 "2021":KEY2021,
 "2023":[None]*60
}
K2021_URL="https://concursos.policiamilitar.sp.gov.br/wp-content/uploads/2021/06/Com-22-321-21-Gabarito-definitivo-da-Prova-Escrita-Sd-PM-2a-Classe-Ed-1-321-21-versao-site.pdf"

def tidy(s,preserve_lines=False):
    s=s.replace("\u0007","").replace("\u00ad","").replace("\u2002"," ").replace("\u2009"," ")
    s=re.sub(r"(?<=\w)[-‐‑]\s*\n\s*(?=\w)","",s)
    if not preserve_lines:s=re.sub(r"\s+"," ",s)
    else:s=re.sub(r"[ \t]+\n","\n",s)
    return s.strip()

def download(year,cfg):
    WORK.mkdir(parents=True,exist_ok=True)
    dest=WORK/(year+".pdf")
    if dest.exists() and dest.stat().st_size>35000:return dest
    errors=[]
    for url in cfg["urls"]:
        for attempt in range(2):
            try:
                req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; PMESPStudy/1.0)","Accept":"application/pdf,*/*"})
                with urllib.request.urlopen(req,timeout=35) as r:payload=r.read()
                if not payload.startswith(b"%PDF") or len(payload)<35000:raise ValueError("conteúdo não é PDF")
                dest.write_bytes(payload)
                print("SOURCE",year,"downloaded",len(payload),"bytes from",url,flush=True)
                return dest
            except Exception as e:
                errors.append(str(e));time.sleep(1)
    raise RuntimeError("Impossível obter PDF "+year+": "+"; ".join(errors))

def get_blocks(p):
    cols=[[],[]]
    for b in p.get_text("blocks"):
        x,y,x2,y2,text,*_=b
        if y<22 or y>=808 or not text.strip():continue
        if x<300 and x2>350 and "FGV CONHECIMENTO" in text:continue
        if "FGV CONHECIMENTO" in text or "TIPO BRANCA – PÁGINA" in text:continue
        val=text.strip()
        if re.match(r"^\d+\s*PMES\d+",val,re.I):continue
        if re.match(r"^\s*Confidencial até",val,re.I):continue
        if re.match(r"^\s*SOLDADO PM DE 2ª CLASSE\s*–\s*TARDE",val,re.I):continue
        col=0 if x<300 else 1
        cols[col].append({"text":val,"y":y,"y1":y2,"x":x,"x1":x2})
    for blocks in cols:blocks.sort(key=lambda t:(t["y"],t["x"]))
    return cols

def extract(year,pdf,cfg):
    doc=fitz.open(pdf)
    questions={}
    sections=[]
    for ip,p in enumerate(doc):
        if ip<1 or ip>len(doc)-3:continue
        cols=get_blocks(p)
        for col,blocks in enumerate(cols):
            current=None;prefix=[]
            for block in blocks:
                val=block["text"]
                candidate=re.sub(r"^(?:[RrAaSsCcUuNnHhOo]\s+){5,}\s*","",val.strip()).strip()
                clean=tidy(candidate)
                if cfg["format"]=="fgv":
                    mq=re.fullmatch(r"(\d{1,2})",clean)
                    isq=bool(mq and (abs(block["x"]-43)<3 or abs(block["x"]-312)<3))
                else:
                    mq=re.match(r"^(\d{2})\.\s*(.*)",clean,re.S)
                    isq=bool(mq and (abs(block["x"]-34)<3 or abs(block["x"]-305)<3))
                if isq and 1<=int(mq[1])<=60:
                    n=int(mq[1])
                    if n not in questions:questions[n]={"n":n,"page":ip+1,"col":col,"items":[]}
                    current=questions[n]
                    if cfg["format"]=="vunesp":
                        start=clean[len(mq[1])+1:].strip()
                        if start:current["items"].append({"text":start,"x":block["x"],"y":block["y"]})
                else:
                    if current is None:prefix.append(block)
                    else:current["items"].append(block)
            if prefix:sections.append({"page":ip+1,"col":col,"text":"\n".join(x["text"] for x in prefix)})
    output=[]
    for n,q in sorted(questions.items()):
        text="\n".join(x["text"] for x in q["items"])
        # Trechos compartilhados que antecedem a questão seguinte não são opções.
        text=re.split(r"\n\s*(?=Leia\s+(?:o texto|a tira|o poema|a charge)\b)",text,maxsplit=1,flags=re.I)[0]
        choices=list(re.finditer(r"\(([A-E])\)\s*",text))
        opts={}
        stem=tidy(text[:choices[0].start()] if choices else text)
        for i,m in enumerate(choices):
            if m[1] not in opts:opts[m[1]]=tidy(text[m.end():choices[i+1].start() if i+1<len(choices) else len(text)])
        subject="Português" if n<=20 else "Matemática" if n<=35 else "Conhecimentos Gerais" if n<=50 else "Informática" if n<=55 else "Administração Pública"
        needs_visual=bool(re.search(r"\b(?:tira|charge|gráfico|mapa|figura|imagem|fotografia|tabela|planilha|quadro|ilustração|sublinhad|destacad|desenho)\w*",stem,re.I))
        source_id=cfg["id"]
        obj={"id":f"{source_id}-{n}","exam":source_id,"number":n,"subject":subject,"text":stem,
             "options":opts,"paperPage":q["page"],"kind":"inline","key":None,"annulled":False,"needsVisual":needs_visual,"visual":None,"support":None}
        output.append(obj)
    # Recupera textos de apoio em páginas separadas, inclusive o longo texto na página 3.
    contexts=[]
    for section in sections:
        s=section["text"];m=re.search(r"(?is)\b(?:Leia|Utilize)\s+.{0,150}?questões?\s+(?:de números\s*)?(?:de\s*)?0?(\d{1,2})\s*(?:a|até)\s*0?(\d{1,2})",s)
        if not m:continue
        first,last=map(int,m.groups())
        if not (1<=first<=last<=60):continue
        intro=tidy(s,preserve_lines=True)
        if len(intro)>18000:intro=intro[:18000]
        identifier=year+"-"+str(first)+"-"+str(last)
        contexts.append({"id":identifier,"start":first,"end":last,"page":section["page"],"col":section["col"],"text":intro})
    # Força o apoio principal dos textos originais quando está na coluna oposta.
    known={"2021":[(1,13,3,0)],"2023":[(1,3,3,0),(4,5,3,1)],"2026":[(1,8,3,0),(9,10,4,1),(11,16,5,0),(17,20,7,0)]}
    for first,last,page,col in known.get(year,[]):
        if not any(x["start"]==first and x["end"]==last for x in contexts):
            p=doc[page-1];bs=get_blocks(p)[col]
            # Os blocos de apoio geralmente precedem a primeira questão da coluna.
            prefix=[]
            for b in bs:
                if re.match(r"^\s*\d{2}\.\s",b["text"]) and int(b["text"].strip()[:2])>=first:break
                prefix.append(b["text"])
            txt=tidy("\n".join(prefix),preserve_lines=True)
            contexts.append({"id":year+"-"+str(first)+"-"+str(last),"start":first,"end":last,"page":page,"col":col,"text":txt})
    for q in output:
        matched=[c for c in contexts if c["start"]<=q["number"]<=c["end"] and c["text"]]
        if matched:
            selected=sorted(matched,key=lambda c:(c["end"]-c["start"],len(c["text"])))[0]
            q["support"]={"text":selected["text"],"id":selected["id"]}
            if "tira" in selected["text"].lower() or "figura" in selected["text"].lower() or "charge" in selected["text"].lower():
                q["needsVisual"]=True
            # Para a tira e o poema a imagem do material original é mais confiável.
            if year in ("2023","2026") and selected["start"]<=10:q["needsVisual"]=True
    # Fotografa apenas os trechos usados por questões visuais.
    IMAGE_DIR.mkdir(parents=True,exist_ok=True)
    generated=set()
    for q in output:
        if not q["needsVisual"]:continue
        page=q["paperPage"];col=q["col"] if "col" in q else next((z["col"] for z in questions.values() if z["n"]==q["number"]),0)
        # Alguns itens citam imagem de apoio em outra coluna.
        sup=q.get("support") or {}
        if sup.get("id"):
            ctx=next((z for z in contexts if z["id"]==sup["id"]),None)
            if ctx and ctx["start"]<=q["number"]<=ctx["end"] and (year in ("2021","2023","2026") and q["number"]<=20):
                page,col=ctx["page"],ctx["col"]
        key=(page,col)
        name=f"{year}-p{page}-c{col}.webp"
        q["visual"]="./figuras/"+name
        if key in generated:continue
        p=doc[page-1]
        rect=fitz.Rect(23 if col==0 else 299,35,298 if col==0 else 576,794)
        pix=p.get_pixmap(matrix=fitz.Matrix(1.9,1.9),clip=rect,alpha=False)
        from PIL import Image
        import io
        im=Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        im.save(IMAGE_DIR/name,"WEBP",quality=74,method=5)
        generated.add(key)
    print("PARSED",year,len(output),"images",len(generated),"support",len(contexts),flush=True)
    return output,contexts

def main():
    old=json.loads((ROOT/"banco.js").read_text(encoding="utf-8").split("window.EXAM_BANK=")[1].rstrip().rstrip(";"))
    oldquestions={q["id"]:q for q in old["questions"]}
    newdb={"version":5,"updated":"2026-11-12","exams":{},"questions":[],"notes":["Transcrição dos cadernos reais enviados pelo usuário (mesmos cadernos públicos por ano).","A imagem da coluna da prova é mostrada nos itens com referência visual.","2023: gabarito definitivo não foi validado; sem correção automática nessa edição."]}
    issues=[]
    for year,cfg in SOURCES.items():
        pdf=download(year,cfg)
        questions,contexts=extract(year,pdf,cfg)
        by={q["number"]:q for q in questions}
        if len(by)!=60:issues.append((year,"itens",len(by)));continue
        optsbad=[q["number"] for q in questions if set(q["options"])!=set("ABCDE") or len(q["text"])<7 or any(not v for v in q["options"].values())]
        if optsbad:issues.append((year,"alternativas",optsbad));continue
        meta=old["exams"].get(cfg["id"],{}).copy()
        if not meta:
            meta={"name":"PMESP · Soldado "+year,"short":"PMESP "+year,"year":int(year),"board":"VUNESP","date":"2021-05-16" if year=="2021" else "2023-09-17",
                  "source":cfg["urls"][0],"type":"Caderno 001, versão 1"}
        meta.update({"year":int(year),"short":"PMESP "+year,"paperPdf":cfg["urls"][0]})
        if year=="2021":meta.update({"keySource":K2021_URL,"note":"Gabarito oficial definitivo da versão 1, publicado em 04/06/2021."})
        if year=="2023":meta.update({"keySource":"https://www.vunesp.com.br/PMES2303","note":"Gabarito definitivo ainda não vinculado com segurança. As respostas ficam salvas sem correção automática."})
        newdb["exams"][cfg["id"]]=meta
        for q in questions:
            ref=oldquestions.get(q["id"])
            key=KEYS.get(year,[None]*60)[q["number"]-1] if year in KEYS else ref.get("key") if ref else None
            q["key"]=key
            q["annulled"]=bool(ref.get("annulled")) if ref else False
            if q["annulled"]:q["key"]=None
        newdb["questions"]+=questions
    if issues or len(newdb["questions"])!=300:
        raise RuntimeError("VALIDAÇÃO NÃO PASSOU: "+repr(issues)+" total "+str(len(newdb["questions"])))
    TARGET.write_text("/* Provas reais PMESP transcritas. Não alterar sem conferir o PDF original. */\nwindow.EXAM_BANK="+json.dumps(newdb,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
    print("SUCCESS 300 questões completas; js bytes",TARGET.stat().st_size,"visual assets",len(list(IMAGE_DIR.glob("*.webp"))),flush=True)
    shutil.rmtree(WORK,ignore_errors=True)
if __name__=="__main__":main()
