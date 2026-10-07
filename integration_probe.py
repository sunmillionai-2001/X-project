import urllib.request, urllib.error, json, pathlib, datetime
ROOT=pathlib.Path(__file__).parent/'research'
def request(url,data=None,extra=None):
    h={'User-Agent':'creator-workbench-research/1.0','Accept':'application/json, text/event-stream'}
    if data is not None:h['Content-Type']='application/json'
    h.update(extra or {})
    with urllib.request.urlopen(urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=h),timeout=30) as r:
        body=r.read().decode('utf-8')
        return body,dict(r.headers),r.status
def parse(body):
    if body.startswith('event:') or body.startswith('data:'):
        return json.loads(next(x[5:].strip() for x in body.splitlines() if x.startswith('data:')))
    return json.loads(body)
report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'endpoints':[]}
for path in ['items?mode=selected&window=24h&category=ai-products&limit=6','hot-topics','dailies/latest']:
    body,h,status=request('https://aihot.news/api/v1/'+path)
    d=json.loads(body)
    key=path.split('?')[0].replace('/','-')
    (ROOT/('aihot-'+key+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
    report['endpoints'].append({'path':path,'status':status,'etag':h.get('ETag'),'keys':list(d)})
    print(key,json.dumps(d,ensure_ascii=False)[:2500])
try:
    body,h,status=request('https://aihot.news/api/mcp',{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-03-26','capabilities':{},'clientInfo':{'name':'creator-workbench-research','version':'1.0'}}})
    init=parse(body);print('mcp-init',init)
    extra={'MCP-Protocol-Version':init.get('result',{}).get('protocolVersion','2025-03-26')}
    if h.get('Mcp-Session-Id'):extra['Mcp-Session-Id']=h['Mcp-Session-Id']
    body,h,status=request('https://aihot.news/api/mcp',{'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}},extra)
    listing=parse(body);report['mcp']={'initialize_status':200,'tools_status':status,'tools':listing.get('result',{}).get('tools',[])}
    print('mcp-tools',[x['name'] for x in report['mcp']['tools']])
    body,h,status=request('https://aihot.news/api/mcp',{'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'aihot_get_hot_topics','arguments':{}}},extra)
    result=parse(body);report['mcp']['call_status']=status;report['mcp']['call_is_error']=result.get('result',{}).get('isError',False)
    (ROOT/'aihot-mcp-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('mcp-call',status,report['mcp']['call_is_error'])
except Exception as e:report['mcp_error']=str(e);print('mcp-error',str(e))
repos=['KKKKhazix/khazix-skills','op7418/Humanizer-zh','coreyhaines31/marketingskills','JimLiu/baoyu-skills','mvanhorn/last30days-skill']
pins={}
for repo in repos:
    body,h,status=request('https://api.github.com/repos/'+repo+'/commits/main')
    pins[repo]=json.loads(body)['sha']
(ROOT/'skill-pins.json').write_text(json.dumps(pins,indent=2),encoding='utf-8')
(ROOT/'integration-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('pins',pins)
