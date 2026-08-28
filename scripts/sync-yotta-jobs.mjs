import fs from "node:fs/promises"

const sourceUrl="https://www.yotta-hr.com/zh/social"
const endpoint="https://www.yotta-hr.com/web-api/jobs/get-online-jobs"
const outputPath=new URL("../data/yotta-jobs.json",import.meta.url)
const liteOutputPath=new URL("../data/yotta-jobs-lite.json",import.meta.url)

const response=await fetch(endpoint,{
  method:"POST",
  headers:{
    "Content-Type":"application/json",
    "Origin":"https://www.yotta-hr.com",
    "Referer":sourceUrl,
    "User-Agent":"ZhideCareerRadar-GitHubFeed/1.0"
  },
  body:"{}",
  signal:AbortSignal.timeout(20000)
})
if(!response.ok)throw new Error(`Yotta returned HTTP ${response.status}`)
const payload=await response.json()
const jobs=Array.isArray(payload?.data?.accurate_jobs)?payload.data.accurate_jobs:[]
const items=jobs.filter(job=>job.apply_type==="社招").map(job=>{
  const zh=job.job_info?.zh||{}
  const tabs=Array.isArray(zh.projectTabs)?zh.projectTabs.filter(tab=>tab?.is_show!==0):[]
  return {
    id:String(job.job_id),title:job.job_name,company:"友塔网络 Yotta Games",location:"上海",
    category:String(job.parent_id||""),education:zh.degree_requirement||"",experience:zh.degree_requirement||"以官网要求为准",
    description:[zh.job_tasks,...tabs.map(tab=>tab.job_tasks)].filter(Boolean).join("\n").slice(0,4000),
    requirements:[zh.job_requirements,...tabs.map(tab=>tab.job_requirements)].filter(Boolean).join("\n").slice(0,3500),
    url:`https://www.yotta-hr.com/zh/social?job_id=${job.job_id}`,
    sourcePlatform:"Yotta Games 官方招聘站",sourceVerifiedAt:new Date().toISOString(),linkStatus:"official_detail_verified"
  }
})

await fs.mkdir(new URL("../data/",import.meta.url),{recursive:true})
await fs.writeFile(outputPath,JSON.stringify({source:"Yotta Games 官方社招",sourceUrl,generatedAt:new Date().toISOString(),count:items.length,items},null,2)+"\n")
const liteItems=items.map(({id,title,company,location,category,education,experience,url,sourcePlatform,sourceVerifiedAt,linkStatus})=>({
  id,title,company,location,category,education,experience,url,sourcePlatform,sourceVerifiedAt,linkStatus
}))
await fs.writeFile(liteOutputPath,JSON.stringify({source:"Yotta Games 官方社招轻量索引",sourceUrl,generatedAt:new Date().toISOString(),count:liteItems.length,items:liteItems})+"\n")
console.log(`Wrote ${items.length} Yotta jobs`)
