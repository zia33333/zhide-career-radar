import fs from "node:fs/promises"

const sourceUrl = "https://www.v2ex.com/feed/jobs.json"
const outputPath = new URL("../data/v2ex-jobs.json", import.meta.url)
const recruiting = /招聘|社招|校招|内推|急招|职位|job|hiring|hire|opening|vacanc/i
const seeking = /求职|找工作|求推荐|个人简历|有没有.*工作|寻求.*岗位/i

function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱请查看原帖]")
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, "[电话请查看原帖]")
    .replace(/(?:微信|WeChat|VX|TG|Telegram)\s*[：:]?\s*[@A-Za-z0-9_-]{4,}/gi, "[社交账号请查看原帖]")
    .trim()
}

function families(text) {
  const rules = [
    ["marketing", /市场|营销|品牌|发行|增长|投放|公关|marketing|brand|growth/i],
    ["operations", /运营|社区|社群|operations|community/i],
    ["product", /产品经理|产品策划|product manager/i],
    ["technology", /研发|开发|工程师|算法|前端|后端|测试|engineer|developer|software/i],
    ["design", /设计|美术|视觉|ui\b|ux\b|designer|artist/i],
    ["sales", /销售|商务|渠道|sales|business development/i]
  ]
  return rules.filter(([, pattern]) => pattern.test(text)).map(([key]) => key)
}

const response = await fetch(sourceUrl, {
  headers: { "User-Agent": "ZhideCareerRadar-GitHubFeed/1.0" },
  signal: AbortSignal.timeout(20000)
})
if (!response.ok) throw new Error(`V2EX returned HTTP ${response.status}`)
const feed = await response.json()
const items = (Array.isArray(feed.items) ? feed.items : []).filter(item => {
  const title = stripHtml(item.title)
  const body = stripHtml(item.content_html || item.content_text)
  return !seeking.test(title) && recruiting.test(`${title}\n${body}`)
}).slice(0, 80).map(item => {
  const title = stripHtml(item.title).slice(0, 160)
  const summary = stripHtml(item.content_html || item.content_text).slice(0, 700)
  return {
    id: String(item.id || item.url),
    title,
    url: item.url || item.external_url,
    author: item.author && item.author.name || "",
    publishedAt: item.date_published || item.date_modified || "",
    summary,
    roleFamilies: families(`${title}\n${summary}`)
  }
})

await fs.mkdir(new URL("../data/", import.meta.url), { recursive: true })
await fs.writeFile(outputPath, JSON.stringify({
  source: "V2EX 酷工作",
  sourceUrl,
  generatedAt: new Date().toISOString(),
  count: items.length,
  items
}, null, 2) + "\n")
console.log(`Wrote ${items.length} V2EX recruiting signals`)
