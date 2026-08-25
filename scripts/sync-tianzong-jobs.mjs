import fs from "node:fs/promises"

const sourceUrl = "https://gw.tianzongwangluo.cn/shezhao"
const outputPath = new URL("../data/tianzong-jobs.json", import.meta.url)

function clean(value) {
  return String(value || "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim()
}

async function get(url) {
  const response = await fetch(url, {headers:{"User-Agent":"ZhideCareerRadar-GitHubFeed/1.0"},signal:AbortSignal.timeout(20000)})
  if (!response.ok) throw new Error(`Tianzong returned HTTP ${response.status}`)
  return response.text()
}

const html = await get(sourceUrl)
const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
const list = rows.map(row => {
  const href = (row.match(/href=['"](?:https?:\/\/gw\.tianzongwangluo\.cn)?(\/shezhao\/\d+\.html)['"]/i) || [])[1]
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(match => clean(match[1]))
  return href && cells.length >= 6 ? {href,title:cells[0],category:cells[1],education:cells[2],experience:cells[3],location:cells[4],publishedAt:cells[5]} : null
}).filter(Boolean)

const items=[]
for (const item of list.slice(0,50)) {
  const url=new URL(item.href,sourceUrl).toString()
  const text=clean(await get(url))
  const description=(text.match(/职位描述：\s*([\s\S]*?)\s*职位要求：/i)||[])[1]||""
  const requirements=(text.match(/职位要求：\s*([\s\S]*?)\s*工作地址：/i)||[])[1]||""
  items.push({
    id:(item.href.match(/(\d+)\.html/)||[])[1]||item.href,title:item.title,company:"天纵游戏",
    location:item.location,category:item.category,education:item.education,experience:item.experience,
    publishedAt:item.publishedAt,description:description.slice(0,3200),requirements:requirements.slice(0,2800),
    url,sourcePlatform:"天纵游戏官方招聘站",sourceVerifiedAt:new Date().toISOString(),linkStatus:"official_detail_verified"
  })
}

await fs.mkdir(new URL("../data/", import.meta.url), {recursive:true})
await fs.writeFile(outputPath, JSON.stringify({source:"天纵游戏官方招聘",sourceUrl,generatedAt:new Date().toISOString(),count:items.length,items},null,2)+"\n")
console.log(`Wrote ${items.length} Tianzong jobs`)
