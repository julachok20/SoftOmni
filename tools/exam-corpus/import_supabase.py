"""Import cached corpus atomically, using a server-side service key. No OCR calls."""
import argparse,json,os,pathlib,sys,urllib.request,urllib.error
URL='https://xhkyaasgezqalsymnryg.supabase.co'
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--private',default=str(pathlib.Path(__file__).parent/'_private'))
    ap.add_argument('--years',default='',help='นำเข้าเฉพาะปีที่ระบุ คั่นด้วยจุลภาค')
    args=ap.parse_args()
    want={int(y) for y in args.years.split(',') if y.strip()} if args.years else None
    key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not key:sys.exit('Set SUPABASE_SERVICE_ROLE_KEY for MathPath in your environment; never in web files.')
    for path in sorted(pathlib.Path(args.private).glob('exam-*.json')):
        paper=json.loads(path.read_text(encoding='utf-8'))
        if want and paper.get('year') not in want:continue
        req=urllib.request.Request(URL+'/rest/v1/rpc/import_exam_corpus',data=json.dumps({'p_document':paper}).encode(),headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=60) as r:result=json.load(r)
            if result.get('stored')!=len(paper['questions']):raise RuntimeError('Import count mismatch')
            check=urllib.request.Request(URL+'/rest/v1/exam_corpus_items?paper_id=eq.'+paper['id']+'&select=number',headers={'apikey':key,'Authorization':'Bearer '+key})
            with urllib.request.urlopen(check,timeout=30) as r:rows=json.load(r)
            if sorted(x['number'] for x in rows)!=sorted(x['number'] for x in paper['questions']):raise RuntimeError('Database verification mismatch')
            print(f"Verified {paper['year']}: {len(rows)} questions")
        except urllib.error.HTTPError as e:
            detail=e.read().decode('utf-8','replace')[:500]
            sys.exit(f"Import failed on {paper['year']} HTTP {e.code}: {detail}")
if __name__=='__main__':main()
