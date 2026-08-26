import fs from "node:fs/promises"

const sourceUrl = "https://www.habby.com/career"
const outputPath = new URL("../data/habby-jobs.json", import.meta.url)

async function get(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "ZhideCareerRadar-GitHubFeed/1.0" },
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok) throw new Error(`Habby returned HTTP ${response.status}`)
  return response.text()
}

function balanced(text, start, open, close) {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === open) depth += 1
    else if (char === close && --depth === 0) return text.slice(start, index + 1)
  }
  return ""
}

function decode(value) {
  try { return JSON.parse(`"${value}"`) }
  catch { return value.replace(/\\n/g, "\n").replace(/\\"/g, '"') }
}

function splitObjects(literal) {
  const result = []
  let depth = 0
  let inString = false
  let escaped = false
  let start = -1
  for (let index = 1; index < literal.length - 1; index += 1) {
    const char = literal[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === "{") {
      if (depth === 0) start = index
      depth += 1
    } else if (char === "}" && --depth === 0 && start >= 0) {
      result.push(literal.slice(start, index + 1))
      start = -1
    }
  }
  return result
}

const html = await get(sourceUrl)
const scriptPath = (html.match(/src="([^"]*\/static\/js\/main\.[^"]+\.js)"/) || [])[1]
if (!scriptPath) throw new Error("Habby main script not found")
const script = await get(new URL(scriptPath, sourceUrl))
const marker = '"career.content4.jobs":['
const markerIndex = script.indexOf(marker)
if (markerIndex < 0) throw new Error("Habby jobs list not found")
const listStart = script.indexOf("[", markerIndex + marker.length - 1)
const objects = splitObjects(balanced(script, listStart, "[", "]"))

const generatedAt = new Date().toISOString()
const items = objects.map((item, index) => {
  const value = name => decode(((item.match(new RegExp(`${name}:"((?:\\\\.|[^"])*)"`)) || [])[1] || ""))
  const sections = Array.from(item.matchAll(/content:"((?:\\.|[^"])*)"/g)).map(match => decode(match[1]))
  return {
    id: `habby-${index}`,
    title: value("title"),
    company: "海彼网络 Habby",
    location: value("location") || "地点以官网为准",
    category: value("type"),
    experience: value("full") || "Full Time",
    description: sections[0] || "完整岗位职责请打开 Habby 官方详情页查看。",
    requirements: sections.slice(1).join("\n") || sections[0] || "完整任职要求请打开 Habby 官方详情页查看。",
    url: `https://www.habby.com/career/detail/${index}`,
    sourcePlatform: "Habby 官方招聘",
    sourceVerifiedAt: generatedAt,
    linkStatus: "official_detail_verified"
  }
}).filter(item => item.title)

if (items.length < 2) throw new Error(`Habby job count is unexpectedly low: ${items.length}`)
await fs.mkdir(new URL("../data/", import.meta.url), { recursive: true })
await fs.writeFile(outputPath, JSON.stringify({
  source: "海彼网络 Habby 官方招聘",
  sourceUrl,
  generatedAt,
  count: items.length,
  items
}, null, 2) + "\n")
console.log(`Wrote ${items.length} Habby jobs`)
