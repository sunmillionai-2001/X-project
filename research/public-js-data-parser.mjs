// Parse literal data only. Never evaluate downloaded JavaScript or execute function calls.
export function parsePublicLiteral(source, bindings={}) {
  let position=0,values=0;
  function whitespace(){while(/\s/.test(source[position]??'')&&position<source.length)position++;}
  function identifier(){const m=source.slice(position).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);if(!m)throw new Error(`Expected identifier at ${position}`);position+=m[0].length;return m[0];}
  function string(){const begin=position++;while(position<source.length){if(source[position]==='\\'){position+=2;continue;}if(source[position++]==='"')return JSON.parse(source.slice(begin,position));}throw new Error('Unclosed JSON string');}
  function value(depth=0) {
    whitespace();if(depth>100||++values>200000)throw new Error('Literal limit exceeded');
    const c=source[position];
    if(c==='"')return string();
    if(c==='[') {
      position++;const out=[];whitespace();if(source[position]===']'){position++;return out;}
      while(true){out.push(value(depth+1));whitespace();if(source[position]===']'){position++;return out;}if(source[position++]!==',')throw new Error('Invalid array');whitespace();if(source[position]===']'){position++;return out;}}
    }
    if(c==='{') {
      position++;const out=Object.create(null);whitespace();if(source[position]==='}'){position++;return out;}
      while(true){whitespace();const key=source[position]==='"'?string():identifier();whitespace();if(source[position++]!==':')throw new Error('Invalid object');out[key]=value(depth+1);whitespace();if(source[position]==='}'){position++;return out;}if(source[position++]!==',')throw new Error('Invalid object separator');}
    }
    const number=source.slice(position).match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if(number){position+=number[0].length;return Number(number[0]);}
    if(source.slice(position,position+2)==='!0'){position+=2;return true;}
    if(source.slice(position,position+2)==='!1'){position+=2;return false;}
    const empty=source.slice(position).match(/^void\s+0\b/);if(empty){position+=empty[0].length;return undefined;}
    if(source.slice(position,position+11)==='new Set([])'){position+=11;return [];}
    const name=identifier();
    if(name==='null')return null;if(name==='undefined')return undefined;if(name==='true')return true;if(name==='false')return false;
    if(Object.hasOwn(bindings,name))return bindings[name];
    throw new Error(`Unknown literal reference ${name}`);
  }
  const result=value();whitespace();if(source[position]===';'){position++;whitespace();}
  if(position!==source.length)throw new Error(`Executable or unsupported syntax rejected at ${position}`);
  return result;
}
export function parseNuxtPublicData(html) {
  const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.startsWith('window.__NUXT__='));
  if(!script)throw new Error('Public Nuxt data not present');
  const match=script.match(/^window\.__NUXT__=\(function\(([^)]*)\)\{([\s\S]*)\}\(([\s\S]*)\)\);?$/);
  if(!match)throw new Error('Unsupported Nuxt literal wrapper');
  const names=match[1].split(','),args=parsePublicLiteral(`[${match[3]}]`);
  if(names.length!==args.length)throw new Error('Nuxt binding count mismatch');
  const bindings=Object.fromEntries(names.map((name,i)=>[name,args[i]]));
  const marker=match[2].indexOf('return {');if(marker<0)throw new Error('Literal return not found');
  return parsePublicLiteral(match[2].slice(marker+'return '.length),bindings);
}
