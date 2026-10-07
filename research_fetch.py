import urllib.request, urllib.parse, json, pathlib, concurrent.futures, datetime
ROOT=pathlib.Path(__file__).parent/'research'
ROOT.mkdir(exist_ok=True)
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'creator-workbench-research/1.0','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(req,timeout=30) as r:
        return r.read().decode('utf-8'),dict(r.headers),r.status
repos=['JimLiu/baoyu-skills','coreyhaines31/marketingskills','blader/humanizer','op7418/Humanizer-zh','ComposioHQ/awesome-claude-skills','KKKKhazix/khazix-skills','remotion-dev/skills','dontbesilent2025/dbskill','weid00360-bot/creator-os']
def repo_task(repo):
    try:
        body,_,_=get('https://api.github.com/repos/'+repo);d=json.loads(body)
        tree,_,_=get('https://api.github.com/repos/'+repo+'/git/trees/'+d['default_branch']+'?recursive=1')
        (ROOT/(repo.replace('/','__')+'-tree.json')).write_text(tree,encoding='utf-8')
        return {k:d.get(k) for k in ['full_name','stargazers_count','forks_count','default_branch','pushed_at','license','html_url']}
    except Exception as e:return {'repo':repo,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex: results=list(ex.map(repo_task,repos))
(ROOT/'github-metadata.json').write_text(json.dumps({'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'repos':results},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
for path in ['api/v1/agent','api/v1/agent/hot','api/v1/agent/latest','terms']:
    try:
        body,headers,status=get('https://aihot.news/'+path)
        (ROOT/('aihot-'+path.replace('/','-')+'.txt')).write_text(body,encoding='utf-8')
        print(json.dumps({'path':path,'status':status,'length':len(body),'type':headers.get('Content-Type'),'sample':body[:1400]},ensure_ascii=False))
    except Exception as e:print(json.dumps({'path':path,'error':str(e)},ensure_ascii=False))
