// Builds public/index.html and a PDF from resume.json for one language.
//
//   node build.mjs en | de
//
// On Netlify the language is picked from the site URL (lebenslauf.* -> de).
// In resume.json any value written as { "en": "...", "de": "..." } is translated,
// everything else (dates, urls, tech) is shared.
//
// Work entries: `highlights` are bullet points, `keywords` are tech tags,
// `compact: true` moves an entry into the short "earlier projects" list.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const lang = process.argv[2] || (process.env.URL?.includes("lebenslauf") ? "de" : "en");

const t = {
  en: {
    about: "Profile", skills: "Skills", experience: "Professional experience",
    earlier: "Earlier projects & career background", projects: "Selected independent products",
    education: "Education", languages: "Languages", personal: "Personal",
    present: "Present", grade: "Grade",
    download: "Download PDF", pdf: "Tobias-Wust-Resume.pdf",
    switchLabel: "Deutsch", switchUrl: "https://lebenslauf.wust.dev/", locale: "en-US",
  },
  de: {
    about: "Profil", skills: "Kenntnisse", experience: "Berufserfahrung",
    earlier: "Frühere Projekte & Werdegang", projects: "Eigene Produkte (Auswahl)",
    education: "Ausbildung", languages: "Sprachen", personal: "Persönliches",
    present: "Heute", grade: "Note",
    download: "PDF herunterladen", pdf: "Tobias-Wust-Lebenslauf.pdf",
    switchLabel: "English", switchUrl: "https://cv.wust.dev/", locale: "de-DE",
  },
}[lang];

// Replace every { en, de } object with the text for the current language
const translate = (v) => {
  if (Array.isArray(v)) return v.map(translate);
  if (v && typeof v === "object") {
    if ("en" in v && "de" in v) return v[lang];
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, translate(x)]));
  }
  return v;
};

const resume = translate(JSON.parse(readFileSync("resume.json", "utf8")));
const { basics } = resume;

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const date = (d) => (!d ? t.present : /^\d{4}$/.test(d) ? d : new Date(d).toLocaleDateString(t.locale, { month: "short", year: "numeric" }));
const range = (a, b) => `${date(a)} – ${date(b)}`;
const tags = (list = []) => (list.length ? `<ul class="tags">${list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
const bullets = (list = []) => (list.length ? `<ul class="bullets">${list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
const link = (text, url) => (url ? `<a href="${esc(url)}">${esc(text)}</a>` : esc(text));
const section = (id, title, body) => `<section id="${id}"><h2>${title}</h2>${body}</section>`;

// Ongoing jobs first, then by most recent date
const work = [...resume.work].sort(
  (a, b) => !!a.endDate - !!b.endDate || (b.endDate ?? b.startDate).localeCompare(a.endDate ?? a.startDate)
);

const jobs = work.filter((w) => !w.compact).map((w) => `
  <article class="job${w.endDate ? "" : " current"}">
    <header>
      <div>
        <h3>${esc(w.position)}</h3>
        <p class="company">${link(w.name, w.url)}${[w.industry, w.location].filter(Boolean).map((x) => ` <span class="muted">· ${esc(x)}</span>`).join("")}</p>
      </div>
      <p class="dates">${range(w.startDate, w.endDate)}</p>
    </header>
    <p>${esc(w.summary)}</p>
    ${bullets(w.highlights)}
    ${tags(w.keywords)}
  </article>`).join("");

const earlier = `<h3 class="subheading">${t.earlier}</h3><ul class="earlier">${work.filter((w) => w.compact).map((w) => `
  <li>
    <div class="earlier-head"><span><strong>${esc(w.position)}</strong> · ${esc(w.name)}</span><span class="dates">${range(w.startDate, w.endDate)}</span></div>
    <p>${esc(w.summary)}</p>
  </li>`).join("")}</ul>`;

const projects = `<div class="projects">${resume.projects.map((p) => `
  <article class="project">
    <header><h3>${link(p.name, p.url)}</h3><span class="dates">${esc(p.startDate)}</span></header>
    <p>${esc(p.description)}</p>
    ${tags(p.keywords)}
  </article>`).join("")}</div>`;

const skills = resume.skills.map((s) => `<div class="skill-group"><h3>${esc(s.name)}</h3>${tags(s.keywords)}</div>`).join("");

const education = resume.education.map((e) => `
  <div class="edu">
    <h3>${esc(e.studyType)} · ${esc(e.area)}</h3>
    <p>${esc(e.institution)}</p>
    <p class="muted">${range(e.startDate, e.endDate)}${e.score ? ` · ${t.grade} ${esc(e.score)}` : ""}</p>
  </div>`).join("");

const languages = `<ul class="langs">${resume.languages.map((l) =>
  `<li><span>${esc(l.language)}</span><span>${esc(l.fluency)}</span></li>`
).join("")}</ul>`;

const personal = `${tags(resume.interests.map((i) => i.name))}${resume.background ? `<p class="muted background">${esc(resume.background)}</p>` : ""}`;

const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(basics.name)} · ${esc(basics.label)}</title>
<meta name="description" content="${esc(basics.name)} – ${esc(basics.label)} · ${esc(basics.tagline)}">
<link rel="icon" href="${esc(basics.image)}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>${readFileSync("style.css", "utf8")}</style>
</head>
<body>
<div class="page">
  <header class="hero">
    <img class="avatar" src="${esc(basics.image)}" alt="${esc(basics.name)}">
    <div>
      <h1>${esc(basics.name)}</h1>
      <p class="label">${esc(basics.label)}</p>
      <p class="tagline">${esc(basics.tagline)}</p>
      <ul class="contacts">
        <li>${esc(basics.location.address)}</li>
        <li><a href="mailto:${esc(basics.email)}">${esc(basics.email)}</a></li>
        <li><a href="tel:${esc(basics.phone)}">${esc(basics.phone)}</a></li>
        ${basics.profiles.map((p) => `<li><a href="${esc(p.url)}">${esc(p.network)}</a></li>`).join("")}
      </ul>
    </div>
    <nav class="actions">
      <a class="btn primary" href="${t.pdf}" download>${t.download}</a>
      <a class="btn" href="${t.switchUrl}">${t.switchLabel}</a>
    </nav>
  </header>
  <div class="layout">
    <main>
      ${section("about", t.about, basics.summary.split("\n\n").map((p) => `<p class="lead">${esc(p)}</p>`).join(""))}
      ${section("experience", t.experience, jobs + earlier)}
      ${section("projects", t.projects, projects)}
    </main>
    <aside>
      ${section("skills", t.skills, skills)}
      ${section("education", t.education, education)}
      ${section("languages", t.languages, languages)}
      ${section("personal", t.personal, personal)}
    </aside>
  </div>
</div>
</body>
</html>
`;

mkdirSync("public", { recursive: true });
writeFileSync("public/index.html", html);
console.log(`✓ public/index.html (${lang})`);

const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(pathToFileURL("public/index.html").href, { waitUntil: "networkidle0" });
await page.pdf({ path: `public/${t.pdf}`, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log(`✓ public/${t.pdf}`);
