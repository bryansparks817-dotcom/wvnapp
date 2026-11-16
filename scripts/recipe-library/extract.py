# Reads every cleaned Wandering Vine recipe sheet (.xlsx) into raw.json:
# header fields, ingredients, allergens, method, plating, serviceware, and
# which cells are light blue (Claude drafts Bryan has not confirmed).
# Usage: python3 extract.py raw.json [folder-of-sheets]
import openpyxl, glob, json, re, os, sys
SRC=sys.argv[2] if len(sys.argv) > 2 else '/mnt/project-files/recipes/round-2/cleaned/'
BLUE={'009BD3F5','FF9BD3F5'}
def isblue(c): return bool(c.fill and c.fill.fill_type and c.fill.fgColor.rgb in BLUE)
def evalnum(v):
    if isinstance(v,(int,float)): return float(v)
    if isinstance(v,str) and v.startswith('=') and re.fullmatch(r'=[\d\.\s\+\-\*/\(\)]+',v):
        try: return float(eval(v[1:]))
        except Exception: return None
    return None
out=[]
for f in sorted(glob.glob(SRC+'*.xlsx')):
    wb=openpyxl.load_workbook(f); ws=wb.worksheets[0]
    def find(label):
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value,str) and c.value.strip().lower().startswith(label):
                    return c
    def field(label):
        c=find(label)
        if not c: return None,False
        v=ws.cell(c.row,c.column+2); return v.value,isblue(v)
    r={'file':os.path.basename(f),'blue':[]}
    for key,label in [('name','recipe'),('category','category'),('batchYield','batch yield'),('portion','portion size'),('storage','storage'),('sub','sub-recipe'),('rev','date / rev'),('station','station'),('shelfLife','shelf life'),('createdBy','created by'),('approvedBy','approved by')]:
        v,b=field(label)
        if hasattr(v,'isoformat'): v=v.date().isoformat()
        r[key]=v.strip() if isinstance(v,str) else v
        if b and v not in (None,''): r['blue'].append(key)
    hdr=[c for row in ws.iter_rows() for c in row if isinstance(c.value,str) and c.value.strip().lower()=='ingredient'][0].row
    ings=[]
    row=hdr+1
    while True:
        a=ws.cell(row,1).value
        if isinstance(a,str) and a.lower().startswith('allergen'): break
        name=ws.cell(row,2).value
        if name not in (None,''):
            q=ws.cell(row,3).value
            ings.append({'name':str(name).strip(),'qty':q,'unit':ws.cell(row,4).value,'gPer':ws.cell(row,5).value,'note':ws.cell(row,6).value,
              'price':evalnum(ws.cell(row,7).value),'priceRaw':ws.cell(row,7).value,'yieldPct':ws.cell(row,8).value,
              'blue':[k for k,col in [('name',2),('qty',3),('unit',4),('gPer',5),('note',6),('price',7)] if isblue(ws.cell(row,col)) and ws.cell(row,col).value not in (None,'')]})
        row+=1
        if row>200: break
    r['ingredients']=ings
    al=[]; alblue=False
    for rr in range(row+1,row+4):
        v=ws.cell(rr,1).value
        if v:
            al+=re.findall(r'\[\s*[Xx]\s*\]\s*([A-Za-z/ ]+?)\*?(?=\s{2,}|\s*\[|$)',v); alblue|=isblue(ws.cell(rr,1))
    r['allergens']=[a.strip() for a in al]; 
    if alblue: r['blue'].append('allergens')
    portions=None
    c=find('number of portions')
    if c: portions=ws.cell(c.row,9).value
    r['portions']=portions
    sh=None
    for rr in range(row, ws.max_row+1):
        if str(ws.cell(rr,2).value or '').strip().lower()=='step': sh=rr; break
        if str(ws.cell(rr,1).value or '').strip().upper()=='METHOD' and isinstance(ws.cell(rr+1,1).value,(int,float)): sh=rr; break
    steps=[]; rr=sh+1
    while True:
        a=ws.cell(rr,1).value
        if isinstance(a,str) and not a.strip().isdigit(): break
        t=ws.cell(rr,2).value
        if t not in (None,''):
            steps.append({'text':str(t).strip(),'type':ws.cell(rr,8).value,'min':ws.cell(rr,9).value,
              'blue':[k for k,col in [('text',2),('type',8),('min',9)] if isblue(ws.cell(rr,col)) and ws.cell(rr,col).value not in (None,'')]})
        rr+=1
        if rr>300: break
    r['steps']=steps
    p=find('plating /')
    r['plating']=ws.cell(p.row+1,1).value if p else None
    r['platingBlue']=isblue(ws.cell(p.row+1,1)) if p else False
    s=find('serviceware')
    r['hasServiceware']=bool(s)
    if s:
        r['serviceware']={ws.cell(s.row+i,1).value: ws.cell(s.row+i,3).value for i in range(1,5)}
    out.append(r)
json.dump(out,open(sys.argv[1],'w'),indent=1,default=str)
print(len(out))
