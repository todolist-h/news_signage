import fetch from "node-fetch";
import xml2js from "xml2js";
import cheerio from "cheerio";

const RSS_URL = "https://www3.nhk.or.jp/rss/news/cat0.xml";
const MAX_EXCERPT = 100;

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function excerpt(text = "", max = MAX_EXCERPT) {
  const s = (text || "").trim();
  return s.length <= max ? s : s.slice(0, max) + "…";
}

async function fetchOgImage(url) {
  try {
    const r = await fetch(url, { timeout: 5000 });
    const html = await r.text();
    const $ = cheerio.load(html);
    return (
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      null
    );
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const r = await fetch(RSS_URL);
    const xml = await r.text();
    const parsed = await xml2js.parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
    });

    const items = parsed.rss?.channel?.item || [];
    const arr = Array.isArray(items) ? items : [items];

    const out = await Promise.all(
      arr.map(async (it) => {
        const thumb =
          it["media:thumbnail"]?.url ||
          it["media:content"]?.url ||
          it.enclosure?.url ||
          null;

        let image = thumb;
        if (!image && it.link) image = await fetchOgImage(it.link);

        const desc = stripHtml(it.description || it.title || "");

        return {
          id: it.guid?._ || it.link || it.title,
          title: it.title || "",
          link: it.link || "",
          pubDate: it.pubDate || "",
          excerpt: excerpt(desc),
          image: image || "/fallback.jpg",
        };
      })
    );

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: "failed to fetch" });
  }
}
