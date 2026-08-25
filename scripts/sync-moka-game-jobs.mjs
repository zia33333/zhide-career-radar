// Moka public-job feed adapter, based on the MIT-licensed parser design from
// simonlin1212/Hiring-Radar (parsers/moka.py). This reads public vacancies only.
import fs from "node:fs/promises"
import crypto from "node:crypto"

const api="https://app.mokahr.com/api/outer/ats-apply/website/jobs/v2"
const outputPath=new URL("../data/moka-game-jobs.json",import.meta.url)
const iv=Buffer.from("de7c21ed8d6f50fe")
const tenants=[
  ["yoozoo","91950","游族网络"],
  ["kingnet","2247","恺英网络"],
  ["dianhun","55952","电魂网络"],
  ["bolegames","37642","博乐科技"],
  ["eyugame","47373","鳄游游戏"],
  ["lovegames","21946","乐府互娱"],
  ["micateam","142158","散爆网络"],
  ["shiyuehr","72054","诗悦网络"],
  ["shangyou","42165","尚游游戏"]
]

function clean(value){return String(value||"").replace(/<br\s*\/?\s*>/gi,"\n").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/[ \t]+/g," ").replace(/\n\s*\n\s*\n+/g,"\n\n").trim()}

function decrypt(payload){
  if(!payload||typeof payload!=="object"||!payload.data||!payload.necromancer)return payload
  const key=Buffer.from(payload.necromancer)
  const decipher=crypto.createDecipheriv(`aes-${key.length*8}-cbc`,key,iv)
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data,"base64")),decipher.final()]).toString("utf8"))
}

async function fetchTenant([orgId,siteId,company]){
  const response=await fetch(api,{
    method:"POST",headers:{"User-Agent":"ZhideCareerRadar-GitHubFeed/1.0","Content-Type":"application/json","Accept":"application/json","Origin":"https://app.mokahr.com"},
    body:JSON.stringify({orgId,siteId:String(siteId),locale:"zh-CN",limit:50,offset:0,needStat:true,locationIds:[],zhinengIds:[]}),signal:AbortSignal.timeout(25000)
  })
  if(!response.ok)throw new Error(`${company} returned HTTP ${response.status}`)
  const decoded=decrypt(await response.json())
  const data=decoded?.data??decoded
  const jobs=Array.isArray(data)?data:(data?.jobs||data?.list||[])
  return jobs.filter(job=>job?.id&&job?.title).map(job=>{
    const locations=(job.locations||[]).map(item=>item?.cityName||item?.name).filter(Boolean).join(" / ")
    const department=typeof job.department==="object"?job.department?.name:job.department
    return {
      id:String(job.id),title:clean(job.title),company,location:locations||"地点以官网为准",category:clean(department||job.commitment||""),
      description:clean(job.jobDescription||job.description||"").slice(0,4000),requirements:clean(job.requirement||job.jobRequirement||"").slice(0,3000),
      experience:clean(job.commitment||job.experience||""),publishedAt:job.publishedAt||job.createdAt||job.openedAt||"",
      url:`https://app.mokahr.com/social-recruitment/${orgId}/${siteId}#/job/${job.id}`,
      sourcePlatform:"Moka 企业官方招聘",sourceVerifiedAt:new Date().toISOString(),linkStatus:"official_detail_verified"
    }
  })
}

const settled=await Promise.allSettled(tenants.map(fetchTenant))
const items=settled.flatMap(result=>result.status==="fulfilled"?result.value:[])
const sources=tenants.map((tenant,index)=>({company:tenant[2],ok:settled[index].status==="fulfilled",count:settled[index].status==="fulfilled"?settled[index].value.length:0,error:settled[index].status==="rejected"?String(settled[index].reason?.message||settled[index].reason):""}))
if(!items.length)throw new Error(`All Moka game feeds failed: ${JSON.stringify(sources)}`)

await fs.mkdir(new URL("../data/",import.meta.url),{recursive:true})
await fs.writeFile(outputPath,JSON.stringify({source:"Moka 游戏企业官方招聘合集",sourceUrl:api,generatedAt:new Date().toISOString(),count:items.length,sources,items},null,2)+"\n")
for(const [orgId,,company] of tenants){
  const companyItems=items.filter(item=>item.company===company)
  await fs.writeFile(new URL(`../data/moka-${orgId}-jobs.json`,import.meta.url),JSON.stringify({source:`${company}官方招聘`,sourceUrl:api,generatedAt:new Date().toISOString(),count:companyItems.length,items:companyItems},null,2)+"\n")
}
console.log(`Wrote ${items.length} Moka game jobs from ${sources.filter(item=>item.ok).length}/${sources.length} companies`)
for(const source of sources)console.log(`${source.ok?"OK":"FAIL"} ${source.company}: ${source.count}${source.error?` (${source.error})`:""}`)
