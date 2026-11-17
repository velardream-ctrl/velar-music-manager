/* RUN-198: global UTC-day AI request budget, no visitor text or IP stored.
   One singleton SQLite-backed Cloudflare Durable Object, fail closed. */
export class VelarAiBudget {
  constructor(state) { this.state=state; }
  async fetch(request) {
    const path=new URL(request.url).pathname;
    const day=new Date().toISOString().slice(0,10);
    const store=this.state.storage;
    if(path==="/stats") {
      const stats=(await store.get("daily"))||{day,used:0,succeeded:0,failed:0};
      const current=stats.day===day?stats:{day,used:0,succeeded:0,failed:0};
      return Response.json(current,{headers:{"Cache-Control":"no-store"}});
    }
    if(path==="/reserve"&&request.method==="POST") {
      let config;
      try{config=await request.json();}catch(_){return Response.json({error:"invalid_config"},{status:400});}
      const limit=Number(config&&config.limit);
      if(!Number.isInteger(limit)||limit<1||limit>1000)
        return Response.json({error:"invalid_limit"},{status:400});
      const saved=(await store.get("daily"))||{day,used:0,succeeded:0,failed:0};
      const count=saved.day===day?saved:{day,used:0,succeeded:0,failed:0};
      if(count.used>=limit)
        return Response.json({error:"daily_limit",day,used:count.used,limit},{status:429});
      count.used+=1;
      await store.put("daily",count);
      return Response.json({ok:true,day,used:count.used,limit});
    }
    if(path==="/complete"&&request.method==="POST"){
      let data;
      try{data=await request.json();}catch(_){return Response.json({error:"invalid_json"},{status:400});}
      const count=(await store.get("daily"))||{day,used:0,succeeded:0,failed:0};
      // Late completion must not corrupt the following UTC day's counter.
      if(!data||data.day!==count.day)return Response.json({ok:true,ignored:true});
      if(data.ok===true)count.succeeded+=1;
      else count.failed+=1;
      await store.put("daily",count);
      return Response.json({ok:true});
    }
    return Response.json({error:"not_found"},{status:404});
  }
}
