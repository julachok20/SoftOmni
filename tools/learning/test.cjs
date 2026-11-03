const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const storage=new Map();const context={Cloud:{state:null,signedIn:()=>false},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},window:{addEventListener(){}},crypto:require('crypto').webcrypto,Date,console,todayStr:()=> '2026-09-06',planTopicIds:()=>['calc'],personalizedTopics:()=>[{id:'real'},{id:'logic'}],toNumber:s=>{const parts=s.split('/');return parts.length===2?Number(parts[0])/Number(parts[1]):Number(s)}};
vm.createContext(context);vm.runInContext(fs.readFileSync('D:/Claude-Access/MathPath/learning.js','utf8')+'\nglobalThis.L=Learning;',context);const L=context.L;
let tested=0;
for(const topic of Object.keys(L.skills))for(let seed=1;seed<=200;seed++){
 const q=L.question(topic,seed),nums=q.q.match(/\d+/g).map(Number);assert.ok(Number.isFinite(q.a));
 const near=(v)=>assert.ok(Math.abs(v-q.a)<1e-7,`${topic} ${seed}`);
 switch(topic){
  case 'set':{const[A,B,I]=nums;const left=new Set(Array.from({length:A},(_,i)=>i));const right=new Set(Array.from({length:B},(_,i)=>i<I?i:A+i));near(new Set([...left,...right]).size);break;}
  case 'logic':near(nums[0]>nums[1] && !(nums[2]>nums[3])?0:1);break;
  case 'real':assert.equal(nums[0]*q.a+nums[1],nums[2]);break;
  case 'func':{let sum=nums[1];for(let i=0;i<nums[2];i++)sum+=nums[0];near(sum);break;}
  case 'explog':assert.equal(nums[0]**q.a,nums[1]);break;
  case 'trig':assert.ok(q.a>0&&q.a<1);near(nums[0]/nums[1]);break;
  case 'complex':near(Math.hypot(nums[0],nums[1])**2);break;
  case 'matrix':near(nums[0]*nums[3]-nums[1]*nums[2]);break;
  case 'seq':{let term=nums[0];for(let i=1;i<nums[2];i++)term+=nums[1];near(term);break;}
  case 'analytic':near(Math.hypot(nums[0]-nums[2],nums[1]-nums[3])**2);break;
  case 'vector':{const[a,b,c,d]=nums;near((Math.hypot(a+c,b+d)**2-Math.hypot(a,b)**2-Math.hypot(c,d)**2)/2);break;}
  case 'stat':near(nums.reduce((s,x)=>s+x,0)/nums.length);break;
  case 'count':{let count=0;for(let i=0;i<nums[1];i++)for(let j=i+1;j<nums[1];j++)count++;near(count);break;}
  case 'prob':{const bag=[...Array(nums[0]).fill(1),...Array(nums[1]).fill(0)];near(bag.filter(Boolean).length/bag.length);break;}
  case 'dist':{const [a,p,den,b,r]=nums;assert.notEqual(a,b);const values=[...Array(p).fill(a),...Array(r).fill(b)];assert.equal(values.length,den);near(values.reduce((s,x)=>s+x,0)/den);break;}
  case 'calc':{const [a,power,b,x]=nums;const f=t=>a*t**power+b*t;near((f(x+1)-f(x-1))/2);break;}
 }
 assert.equal(L.mark(q,String(q.a)),true);assert.equal(L.mark(q,String(q.a+1)),false);tested++;
}
assert.equal(L.mark({a:0.5},'1/2'),true);assert.equal(L.mark({a:0},'1/0'),null);assert.equal(L.mark({a:5},'5 bananas'),null);
const t=1000000000000;
const event=(id,at,score=5,assisted=false)=>({id,topic:'real',version:L.version,at,results:Array.from({length:5},(_,i)=>({id:id+i,correct:i<score,assisted,reported:false}))});
assert.equal(L.evidence('real',t,{events:[event('a',t)]}).state,'review');
assert.equal(L.evidence('real',t+1000,{events:[event('a',t),event('b',t+1000)]}).state,'review');
assert.equal(L.evidence('real',t+86400000,{events:[event('a',t),event('b',t+86400000)]}).state,'mastered');
assert.notEqual(L.evidence('real',t+86400000,{events:[event('a',t),event('a',t+86400000)]}).state,'mastered');
assert.equal(L.evidence('real',t,{events:[event('a',t,5,true)]}).state,'developing');
assert.equal(L.evidence('real',t+86400000,{events:[event('a',t),event('b',t+86400000,2)]}).state,'developing');
const plan=L.plan();assert.equal(plan.topics[0].topic,'calc');assert.equal(JSON.stringify(L.plan()),JSON.stringify(plan));
L.save({events:[event('a',t)],reports:[]});context.Cloud.state={user_id:'different'};assert.equal(L.data().events.length,0);
console.log(`PASS: ${tested} generated questions checked with mathematical identities; fraction/invalid input; delayed review, repeats, help, failed review, stable plan and account isolation`);
