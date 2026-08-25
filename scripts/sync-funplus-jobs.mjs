import fs from "node:fs/promises"

const sourceUrl = "https://funplus.factorialhr.com/embed/jobs"
const outputPath = new URL("../data/funplus-jobs.json", import.meta.url)

function clean(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
}

async function get(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "ZhideCareerRadar-GitHubFeed/1.0" },
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok) throw new Error(`FunPlus returned HTTP ${response.status}`)
  return response.text()
}

const html = await get(sourceUrl)
const blocks = html.match(/<li[^>]*class=['"][^'"]*job-offer-item[^'"]*['"][\s\S]*?<\/li>/gi) || []
const list = blocks.map(block => ({
  url: (block.match(/data-job-postings-url=['"]([^'"]+)['"]/i) || [])[1],
  title: clean((block.match(/factorial__headingFontFamily[^>]*>([\s\S]*?)<\/div>/i) || [])[1])
})).filter(item => item.url && item.title)

const items = []
for (const item of list.slice(0, 30)) {
  const detailHtml = await get(item.url)
  const text = clean(detailHtml)
  const location = (text.match(/\(([^()]{2,80},\s*[^()]{2,80}(?:,\s*[^()]{2,80})?)\)/) || [])[1] || "地点以官网为准"
  const start = Math.max(text.indexOf(item.title) + item.title.length, 0)
  const body = text.slice(start, start + 6500).replace(/Apply now[\s\S]*$/i, "").trim()
  items.push({
    id: (item.url.match(/job_posting\/([^/?#]+)/i) || [])[1] || item.url,
    title: item.title,
    company: "FunPlus",
    location,
    description: body.slice(0, 3200),
    requirements: body.slice(3200, 6000),
    url: item.url,
    sourcePlatform: "Factorial",
    sourceVerifiedAt: new Date().toISOString(),
    linkStatus: "official_detail_verified"
  })
}

await fs.mkdir(new URL("../data/", import.meta.url), { recursive: true })
await fs.writeFile(outputPath, JSON.stringify({
  source: "FunPlus 官方招聘",
  sourceUrl,
  generatedAt: new Date().toISOString(),
  count: items.length,
  items
}, null, 2) + "\n")
console.log(`Wrote ${items.length} FunPlus jobs`)
