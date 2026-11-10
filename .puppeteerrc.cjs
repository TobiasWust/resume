// Keep the downloaded Chrome inside node_modules so Netlify's build cache keeps it
module.exports = { cacheDirectory: require("path").join(__dirname, "node_modules", ".cache", "puppeteer") };
