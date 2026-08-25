import fs from "node:fs/promises"

const sourceUrl="https://api.lever.co/v0/postings/neowiz?mode=json"
const outputPath=new URL("../data/neowiz-jobs.json",import.meta.url)

function clean(value){return String(value||"").replace(/<br\s*\/?\s*>/gi,"\n").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim()}

const response=await fetch(sourceUrl,{headers:{"User-Agent":"ZhideCareerRadar-GitHubFeed/1.0"},signal:AbortSignal.timeout(20000)})
if(!response.ok)throw new Error(`NEOWIZ returned HTTP ${response.status}`)
const feed=await response.json()
const items=(Array.isArray(feed)?feed:[]).filter(job=>job.id&&job.text&&job.hostedUrl).map(job=>{
  const description=clean(job.descriptionPlain||job.description||"")
  const requirements=clean(job.additionalPlain||job.additional||"")
  const category=[job.categories?.team,job.categories?.department,job.categories?.commitment].filter(Boolean).join(" / ")
  return {
    id:String(job.id),title:clean(job.text),company:"NEOWIZ",location:job.categories?.location||"NEOWIZ",
    category,description:description.slice(0,3200),requirements:requirements.slice(0,2800),
    url:job.hostedUrl,publishedAt:job.createdAt?new Date(job.createdAt).toISOString():"",
    sourcePlatform:"Lever",sourceVerifiedAt:new Date().toISOString(),linkStatus:"official_detail_verified"
  }
})

await fs.mkdir(new URL("../data/",import.meta.url),{recursive:true})
await fs.writeFile(outputPath,JSON.stringify({source:"NEOWIZ 官方招聘",sourceUrl,generatedAt:new Date().toISOString(),count:items.length,items},null,2)+"\n")
console.log(`Wrote ${items.length} NEOWIZ jobs`)
