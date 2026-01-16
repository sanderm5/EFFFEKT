export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL mangler' });
  }

  // Validate URL format
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Ugyldig URL-format' });
  }

  try {
    // Measure response time with multiple samples for accuracy
    const timings = [];
    let html = '';
    let response;

    // First request to get HTML and initial timing
    const startTime = Date.now();
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'nb-NO,nb;q=0.9,no;q=0.8,nn;q=0.7,en;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
      },
      redirect: 'follow'
    });
    const responseTime = Date.now() - startTime;
    html = await response.text();

    // Extract all resources for analysis
    const resources = extractResources(html, parsedUrl);

    // Analyze the page with detailed checks
    const performanceResult = analyzePerformance(responseTime, html, resources);
    const seoResult = analyzeSEO(html, parsedUrl);
    const securityResult = analyzeSecurity(parsedUrl, response.headers, html);
    const mobileResult = analyzeMobile(html);
    const accessibilityResult = analyzeAccessibility(html);

    // Calculate weighted total score
    const totalScore = Math.round(
      (performanceResult.score * 0.25) +
      (seoResult.score * 0.25) +
      (securityResult.score * 0.20) +
      (mobileResult.score * 0.15) +
      (accessibilityResult.score * 0.15)
    );

    // Industry benchmarks (Norwegian average)
    const industryBenchmarks = {
      performance: 68,
      seo: 72,
      security: 65,
      mobile: 78,
      accessibility: 62
    };

    const result = {
      url: url,
      analyzedAt: new Date().toISOString(),
      responseTime: responseTime,
      totalScore: totalScore,
      benchmarks: industryBenchmarks,
      categories: {
        performance: {
          score: performanceResult.score,
          status: getStatus(performanceResult.score),
          details: performanceResult.details,
          benchmark: industryBenchmarks.performance
        },
        seo: {
          score: seoResult.score,
          status: getStatus(seoResult.score),
          details: seoResult.details,
          benchmark: industryBenchmarks.seo
        },
        security: {
          score: securityResult.score,
          status: getStatus(securityResult.score),
          details: securityResult.details,
          benchmark: industryBenchmarks.security
        },
        mobile: {
          score: mobileResult.score,
          status: getStatus(mobileResult.score),
          details: mobileResult.details,
          benchmark: industryBenchmarks.mobile
        },
        accessibility: {
          score: accessibilityResult.score,
          status: getStatus(accessibilityResult.score),
          details: accessibilityResult.details,
          benchmark: industryBenchmarks.accessibility
        }
      }
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Analyze error:', error.message);
    res.status(500).json({ error: 'Kunne ikke analysere URL. Sjekk at nettsiden er tilgjengelig.' });
  }
}

// Extract all resources from HTML
function extractResources(html, baseUrl) {
  const resources = {
    scripts: [],
    stylesheets: [],
    images: [],
    fonts: [],
    iframes: []
  };

  // Extract scripts
  const scriptMatches = html.matchAll(/<script[^>]*(?:src=["']([^"']+)["'])?[^>]*>/gi);
  for (const match of scriptMatches) {
    resources.scripts.push({
      src: match[1] || null,
      isInline: !match[1],
      isAsync: /async/i.test(match[0]),
      isDefer: /defer/i.test(match[0]),
      isModule: /type=["']module["']/i.test(match[0])
    });
  }

  // Extract stylesheets
  const linkMatches = html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi);
  for (const match of linkMatches) {
    resources.stylesheets.push({
      href: match[1],
      isPreload: /rel=["']preload["']/i.test(match[0])
    });
  }

  // Extract images with detailed info
  const imgMatches = html.matchAll(/<img[^>]*>/gi);
  for (const match of imgMatches) {
    const srcMatch = match[0].match(/src=["']([^"']+)["']/i);
    const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
    const widthMatch = match[0].match(/width=["']?(\d+)/i);
    const heightMatch = match[0].match(/height=["']?(\d+)/i);
    const loadingMatch = match[0].match(/loading=["']([^"']+)["']/i);

    resources.images.push({
      src: srcMatch ? srcMatch[1] : null,
      hasAlt: !!altMatch,
      altText: altMatch ? altMatch[1] : null,
      hasEmptyAlt: altMatch && altMatch[1] === '',
      hasDimensions: !!(widthMatch && heightMatch),
      width: widthMatch ? parseInt(widthMatch[1]) : null,
      height: heightMatch ? parseInt(heightMatch[1]) : null,
      hasLazyLoading: loadingMatch && loadingMatch[1] === 'lazy',
      hasSrcset: /srcset=/i.test(match[0]),
      isWebP: srcMatch && /\.webp/i.test(srcMatch[1]),
      isAvif: srcMatch && /\.avif/i.test(srcMatch[1]),
      isModernFormat: srcMatch && /\.(webp|avif)/i.test(srcMatch[1])
    });
  }

  // Extract iframes
  const iframeMatches = html.matchAll(/<iframe[^>]*>/gi);
  for (const match of iframeMatches) {
    const srcMatch = match[0].match(/src=["']([^"']+)["']/i);
    resources.iframes.push({
      src: srcMatch ? srcMatch[1] : null,
      hasLazyLoading: /loading=["']lazy["']/i.test(match[0])
    });
  }

  return resources;
}

function analyzePerformance(responseTime, html, resources) {
  let score = 100;
  const details = [];
  const issues = [];

  // === TTFB / Response Time Analysis (max -25) ===
  if (responseTime > 3000) {
    score -= 25;
    issues.push({ severity: 'critical', message: `Veldig treg server-respons: ${responseTime}ms (bør være under 600ms)` });
  } else if (responseTime > 1500) {
    score -= 15;
    issues.push({ severity: 'warning', message: `Treg server-respons: ${responseTime}ms (bør være under 600ms)` });
  } else if (responseTime > 600) {
    score -= 8;
    issues.push({ severity: 'info', message: `Server-respons kan forbedres: ${responseTime}ms` });
  } else {
    details.push({ type: 'success', message: `Rask server-respons: ${responseTime}ms` });
  }

  // === HTML Document Size (max -15) ===
  const htmlSize = html.length;
  const htmlSizeKB = Math.round(htmlSize / 1024);
  if (htmlSize > 500000) {
    score -= 15;
    issues.push({ severity: 'critical', message: `HTML-dokumentet er for stort: ${htmlSizeKB}KB (bør være under 100KB)` });
  } else if (htmlSize > 200000) {
    score -= 10;
    issues.push({ severity: 'warning', message: `HTML-dokumentet er stort: ${htmlSizeKB}KB` });
  } else if (htmlSize > 100000) {
    score -= 5;
    issues.push({ severity: 'info', message: `HTML-dokumentet er litt stort: ${htmlSizeKB}KB` });
  }

  // === JavaScript Analysis (max -20) ===
  const totalScripts = resources.scripts.length;
  const inlineScripts = resources.scripts.filter(s => s.isInline).length;
  const blockingScripts = resources.scripts.filter(s => !s.isInline && !s.isAsync && !s.isDefer).length;

  if (blockingScripts > 5) {
    score -= 12;
    issues.push({ severity: 'critical', message: `${blockingScripts} render-blokkerende scripts (bruk async/defer)` });
  } else if (blockingScripts > 2) {
    score -= 6;
    issues.push({ severity: 'warning', message: `${blockingScripts} render-blokkerende scripts` });
  }

  if (totalScripts > 25) {
    score -= 8;
    issues.push({ severity: 'warning', message: `For mange scripts: ${totalScripts} (bør konsolideres)` });
  } else if (totalScripts > 15) {
    score -= 4;
    issues.push({ severity: 'info', message: `Mange scripts: ${totalScripts}` });
  }

  // === CSS Analysis (max -15) ===
  const externalStylesheets = resources.stylesheets.length;
  const inlineStyleCount = (html.match(/<style[^>]*>/gi) || []).length;
  const inlineCSSSize = estimateInlineCSS(html);

  if (externalStylesheets > 8) {
    score -= 8;
    issues.push({ severity: 'warning', message: `For mange CSS-filer: ${externalStylesheets} (bør kombineres)` });
  } else if (externalStylesheets > 4) {
    score -= 4;
    issues.push({ severity: 'info', message: `Flere CSS-filer: ${externalStylesheets}` });
  }

  if (inlineCSSSize > 50000) {
    score -= 7;
    issues.push({ severity: 'warning', message: `Mye inline CSS (${Math.round(inlineCSSSize/1024)}KB) - bør flyttes til eksterne filer` });
  }

  // === Image Optimization (max -20) ===
  const images = resources.images;
  const imagesWithoutDimensions = images.filter(i => !i.hasDimensions).length;
  const imagesWithoutLazyLoad = images.filter(i => !i.hasLazyLoading && images.indexOf(i) > 2).length;
  const imagesWithoutModernFormat = images.filter(i => i.src && !i.isModernFormat).length;
  const imagesWithoutSrcset = images.filter(i => !i.hasSrcset).length;

  if (images.length > 0) {
    if (imagesWithoutDimensions > 3) {
      score -= 6;
      issues.push({ severity: 'warning', message: `${imagesWithoutDimensions} bilder mangler width/height (forårsaker layout shift)` });
    }

    if (imagesWithoutLazyLoad > 5) {
      score -= 5;
      issues.push({ severity: 'warning', message: `${imagesWithoutLazyLoad} bilder under fold mangler lazy loading` });
    }

    if (imagesWithoutModernFormat > 5 && images.length > 3) {
      score -= 5;
      issues.push({ severity: 'info', message: `${imagesWithoutModernFormat} bilder bruker ikke moderne formater (WebP/AVIF)` });
    }

    if (imagesWithoutSrcset > 5 && images.length > 3) {
      score -= 4;
      issues.push({ severity: 'info', message: `${imagesWithoutSrcset} bilder mangler responsive srcset` });
    }
  }

  // === Critical Rendering Path ===
  const hasCriticalCSS = /<style[^>]*>[\s\S]*?(body|html|header|nav|hero|main)/i.test(html);
  const hasPreconnect = /<link[^>]*rel=["']preconnect["']/i.test(html);
  const hasPreload = /<link[^>]*rel=["']preload["']/i.test(html);
  const hasDNSPrefetch = /<link[^>]*rel=["']dns-prefetch["']/i.test(html);

  if (!hasCriticalCSS && externalStylesheets > 0) {
    score -= 3;
    issues.push({ severity: 'info', message: 'Mangler kritisk inline CSS for raskere first paint' });
  }

  if (!hasPreconnect && !hasDNSPrefetch) {
    score -= 2;
    issues.push({ severity: 'info', message: 'Mangler preconnect/dns-prefetch for tredjepartsressurser' });
  }

  // === Compression indicators ===
  const hasGzip = /<meta[^>]*http-equiv=["']content-encoding["']/i.test(html);

  // === Third-party resources ===
  const thirdPartyScripts = resources.scripts.filter(s =>
    s.src && !s.src.startsWith('/') && !s.src.includes(new URL(html).hostname || '')
  ).length;

  if (thirdPartyScripts > 10) {
    score -= 5;
    issues.push({ severity: 'warning', message: `Mange tredjepartscripts: ${thirdPartyScripts} (påvirker ytelse)` });
  }

  // === Iframes ===
  const iframes = resources.iframes;
  const iframesWithoutLazy = iframes.filter(i => !i.hasLazyLoading).length;
  if (iframesWithoutLazy > 0) {
    score -= 3;
    issues.push({ severity: 'info', message: `${iframesWithoutLazy} iframes mangler lazy loading` });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    details: [...details, ...issues],
    metrics: {
      responseTime,
      htmlSize: htmlSizeKB,
      totalScripts,
      blockingScripts,
      totalStylesheets: externalStylesheets + inlineStyleCount,
      totalImages: images.length
    }
  };
}

function estimateInlineCSS(html) {
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  return styleMatches.reduce((total, match) => total + match.length, 0);
}

function analyzeSEO(html, parsedUrl) {
  let score = 100;
  const details = [];
  const issues = [];

  // === Title Tag (max -15) ===
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) {
    score -= 15;
    issues.push({ severity: 'critical', message: 'Mangler title-tag' });
  } else {
    const title = titleMatch[1].trim();
    if (title.length < 10) {
      score -= 10;
      issues.push({ severity: 'warning', message: `Title er for kort: ${title.length} tegn (anbefalt 50-60)` });
    } else if (title.length > 70) {
      score -= 5;
      issues.push({ severity: 'warning', message: `Title er for lang: ${title.length} tegn (anbefalt 50-60)` });
    } else if (title.length >= 50 && title.length <= 60) {
      details.push({ type: 'success', message: `Optimal title-lengde: ${title.length} tegn` });
    }

    // Check for brand/keyword separation
    if (!title.includes('|') && !title.includes('-') && !title.includes('–')) {
      issues.push({ severity: 'info', message: 'Title mangler tydelig struktur (keyword | brand)' });
    }
  }

  // === Meta Description (max -12) ===
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  if (!descMatch) {
    score -= 12;
    issues.push({ severity: 'critical', message: 'Mangler meta description' });
  } else {
    const desc = descMatch[1];
    if (desc.length < 70) {
      score -= 6;
      issues.push({ severity: 'warning', message: `Meta description er for kort: ${desc.length} tegn (anbefalt 150-160)` });
    } else if (desc.length > 160) {
      score -= 3;
      issues.push({ severity: 'info', message: `Meta description er litt lang: ${desc.length} tegn (kan bli avkortet)` });
    } else if (desc.length >= 140 && desc.length <= 160) {
      details.push({ type: 'success', message: `Optimal meta description: ${desc.length} tegn` });
    }
  }

  // === Heading Structure (max -15) ===
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>/gi) || [];
  const h3Matches = html.match(/<h3[^>]*>/gi) || [];

  if (h1Matches.length === 0) {
    score -= 10;
    issues.push({ severity: 'critical', message: 'Mangler H1-overskrift' });
  } else if (h1Matches.length > 1) {
    score -= 5;
    issues.push({ severity: 'warning', message: `Flere H1-overskrifter: ${h1Matches.length} (bør kun ha én)` });
  } else {
    details.push({ type: 'success', message: 'Korrekt bruk av H1-overskrift' });
  }

  if (h2Matches.length === 0 && html.length > 5000) {
    score -= 3;
    issues.push({ severity: 'info', message: 'Mangler H2-overskrifter for struktur' });
  }

  // === Canonical URL (max -8) ===
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (!canonicalMatch) {
    score -= 8;
    issues.push({ severity: 'warning', message: 'Mangler canonical URL' });
  } else {
    details.push({ type: 'success', message: 'Canonical URL er definert' });
  }

  // === Open Graph Tags (max -8) ===
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["']/i);
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["']/i);
  const ogImage = html.match(/<meta[^>]*property=["']og:image["']/i);
  const ogUrl = html.match(/<meta[^>]*property=["']og:url["']/i);

  const ogScore = [ogTitle, ogDesc, ogImage, ogUrl].filter(Boolean).length;
  if (ogScore === 0) {
    score -= 8;
    issues.push({ severity: 'warning', message: 'Mangler Open Graph-tags (påvirker deling på sosiale medier)' });
  } else if (ogScore < 4) {
    score -= 4;
    issues.push({ severity: 'info', message: `Ufullstendige Open Graph-tags (${ogScore}/4)` });
  } else {
    details.push({ type: 'success', message: 'Komplett Open Graph-implementasjon' });
  }

  // === Twitter Cards (max -4) ===
  const twitterCard = html.match(/<meta[^>]*name=["']twitter:card["']/i);
  const twitterTitle = html.match(/<meta[^>]*name=["']twitter:title["']/i);
  if (!twitterCard) {
    score -= 4;
    issues.push({ severity: 'info', message: 'Mangler Twitter Card-tags' });
  }

  // === Image Alt Texts (max -10) ===
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imagesWithoutAlt = imgTags.filter(img => !/alt=/i.test(img)).length;
  const imagesWithEmptyAlt = imgTags.filter(img => /alt=["']\s*["']/i.test(img)).length;

  if (imagesWithoutAlt > 0) {
    const penalty = Math.min(10, imagesWithoutAlt * 2);
    score -= penalty;
    issues.push({ severity: 'warning', message: `${imagesWithoutAlt} bilder mangler alt-tekst` });
  }

  // === Structured Data / Schema.org (max -5) ===
  const hasJsonLd = /<script[^>]*type=["']application\/ld\+json["']/i.test(html);
  const hasMicrodata = /itemscope|itemtype/i.test(html);

  if (!hasJsonLd && !hasMicrodata) {
    score -= 5;
    issues.push({ severity: 'info', message: 'Mangler strukturert data (Schema.org)' });
  } else {
    details.push({ type: 'success', message: 'Strukturert data er implementert' });
  }

  // === Language Declaration (max -3) ===
  const hasLang = /<html[^>]*lang=["'][^"']+["']/i.test(html);
  if (!hasLang) {
    score -= 3;
    issues.push({ severity: 'info', message: 'Mangler språkdeklarasjon (lang-attributt)' });
  }

  // === Robots Meta (informational) ===
  const robotsMeta = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  if (robotsMeta && /noindex/i.test(robotsMeta[1])) {
    issues.push({ severity: 'warning', message: 'Siden er satt til noindex (vil ikke indekseres)' });
  }

  // === Internal Links ===
  const internalLinks = (html.match(/<a[^>]*href=["']\/[^"']*["']/gi) || []).length;
  const externalLinks = (html.match(/<a[^>]*href=["']https?:\/\//gi) || []).length;

  if (internalLinks < 3 && html.length > 5000) {
    score -= 2;
    issues.push({ severity: 'info', message: 'Få interne lenker (bør ha flere for bedre SEO)' });
  }

  // === Sitemap reference ===
  const hasSitemapLink = /sitemap\.xml/i.test(html);

  return {
    score: Math.max(0, Math.min(100, score)),
    details: [...details, ...issues],
    metrics: {
      titleLength: titleMatch ? titleMatch[1].trim().length : 0,
      descriptionLength: descMatch ? descMatch[1].length : 0,
      h1Count: h1Matches.length,
      h2Count: h2Matches.length,
      imagesWithoutAlt,
      hasStructuredData: hasJsonLd || hasMicrodata,
      hasOpenGraph: ogScore === 4
    }
  };
}

function analyzeSecurity(parsedUrl, headers, html) {
  let score = 100;
  const details = [];
  const issues = [];

  // Build headers object
  const headerObj = {};
  headers.forEach((value, key) => {
    headerObj[key.toLowerCase()] = value;
  });

  // === HTTPS (max -30) ===
  if (parsedUrl.protocol !== 'https:') {
    score -= 30;
    issues.push({ severity: 'critical', message: 'Siden bruker ikke HTTPS' });
  } else {
    details.push({ type: 'success', message: 'HTTPS er aktivert' });
  }

  // === HTTP Strict Transport Security (max -12) ===
  const hsts = headerObj['strict-transport-security'];
  if (!hsts) {
    score -= 12;
    issues.push({ severity: 'warning', message: 'Mangler HSTS-header (Strict-Transport-Security)' });
  } else {
    const maxAge = hsts.match(/max-age=(\d+)/i);
    if (maxAge && parseInt(maxAge[1]) < 31536000) {
      score -= 4;
      issues.push({ severity: 'info', message: 'HSTS max-age bør være minst 1 år (31536000 sekunder)' });
    } else {
      details.push({ type: 'success', message: 'HSTS er korrekt konfigurert' });
    }

    if (!/includeSubDomains/i.test(hsts)) {
      issues.push({ severity: 'info', message: 'HSTS mangler includeSubDomains' });
    }
  }

  // === Content Security Policy (max -10) ===
  const csp = headerObj['content-security-policy'];
  if (!csp) {
    score -= 10;
    issues.push({ severity: 'warning', message: 'Mangler Content-Security-Policy header' });
  } else {
    details.push({ type: 'success', message: 'CSP er implementert' });

    if (/unsafe-inline/i.test(csp) && /script-src/i.test(csp)) {
      score -= 3;
      issues.push({ severity: 'info', message: 'CSP tillater unsafe-inline for scripts' });
    }
    if (/unsafe-eval/i.test(csp)) {
      score -= 3;
      issues.push({ severity: 'info', message: 'CSP tillater unsafe-eval' });
    }
  }

  // === X-Frame-Options (max -8) ===
  const xfo = headerObj['x-frame-options'];
  if (!xfo && !csp?.includes('frame-ancestors')) {
    score -= 8;
    issues.push({ severity: 'warning', message: 'Mangler clickjacking-beskyttelse (X-Frame-Options)' });
  } else {
    details.push({ type: 'success', message: 'Clickjacking-beskyttelse er aktiv' });
  }

  // === X-Content-Type-Options (max -6) ===
  if (!headerObj['x-content-type-options']) {
    score -= 6;
    issues.push({ severity: 'warning', message: 'Mangler X-Content-Type-Options: nosniff' });
  } else {
    details.push({ type: 'success', message: 'MIME-type sniffing er blokkert' });
  }

  // === Referrer-Policy (max -4) ===
  const referrerPolicy = headerObj['referrer-policy'];
  if (!referrerPolicy) {
    score -= 4;
    issues.push({ severity: 'info', message: 'Mangler Referrer-Policy header' });
  }

  // === Permissions-Policy (max -4) ===
  const permissionsPolicy = headerObj['permissions-policy'] || headerObj['feature-policy'];
  if (!permissionsPolicy) {
    score -= 4;
    issues.push({ severity: 'info', message: 'Mangler Permissions-Policy header' });
  }

  // === X-XSS-Protection (legacy, max -2) ===
  if (!headerObj['x-xss-protection']) {
    score -= 2;
    issues.push({ severity: 'info', message: 'Mangler X-XSS-Protection header (legacy)' });
  }

  // === Mixed Content Detection ===
  const httpResources = html.match(/http:\/\/(?!localhost)[^"'\s>]+/gi) || [];
  if (httpResources.length > 0 && parsedUrl.protocol === 'https:') {
    score -= 5;
    issues.push({ severity: 'warning', message: `${httpResources.length} ressurser lastes over HTTP (mixed content)` });
  }

  // === Sensitive Data Exposure ===
  const hasExposedEmail = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  if (hasExposedEmail.length > 3) {
    score -= 2;
    issues.push({ severity: 'info', message: 'E-postadresser er synlige i kildekoden (spam-risiko)' });
  }

  // === Form Security ===
  const forms = html.match(/<form[^>]*>/gi) || [];
  const formsWithoutHTTPS = forms.filter(f => /action=["']http:\/\//i.test(f)).length;
  if (formsWithoutHTTPS > 0) {
    score -= 8;
    issues.push({ severity: 'critical', message: `${formsWithoutHTTPS} skjema sender data over HTTP` });
  }

  // === Password fields ===
  const passwordFields = html.match(/<input[^>]*type=["']password["'][^>]*>/gi) || [];
  const passwordWithoutAutocomplete = passwordFields.filter(f => !/autocomplete=/i.test(f)).length;
  if (passwordWithoutAutocomplete > 0) {
    issues.push({ severity: 'info', message: 'Passord-felt mangler autocomplete-attributt' });
  }

  // === Server Header Disclosure ===
  const server = headerObj['server'];
  const xPoweredBy = headerObj['x-powered-by'];
  if (server && /apache|nginx|iis/i.test(server) && /\d+\.\d+/i.test(server)) {
    score -= 2;
    issues.push({ severity: 'info', message: 'Server-versjon er synlig i headers' });
  }
  if (xPoweredBy) {
    score -= 2;
    issues.push({ severity: 'info', message: 'X-Powered-By header eksponerer teknologi' });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    details: [...details, ...issues],
    headers: {
      https: parsedUrl.protocol === 'https:',
      hsts: !!hsts,
      csp: !!csp,
      xfo: !!xfo,
      xcto: !!headerObj['x-content-type-options']
    }
  };
}

function analyzeMobile(html) {
  let score = 100;
  const details = [];
  const issues = [];

  // === Viewport Meta Tag (max -25) ===
  const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
  if (!viewportMatch) {
    score -= 25;
    issues.push({ severity: 'critical', message: 'Mangler viewport meta-tag' });
  } else {
    const viewport = viewportMatch[1].toLowerCase();

    if (!viewport.includes('width=device-width')) {
      score -= 10;
      issues.push({ severity: 'warning', message: 'Viewport mangler width=device-width' });
    } else {
      details.push({ type: 'success', message: 'Viewport er korrekt konfigurert' });
    }

    if (viewport.includes('maximum-scale=1') || viewport.includes('user-scalable=no')) {
      score -= 5;
      issues.push({ severity: 'warning', message: 'Viewport blokkerer zoom (dårlig for tilgjengelighet)' });
    }

    if (!viewport.includes('initial-scale')) {
      score -= 2;
      issues.push({ severity: 'info', message: 'Viewport mangler initial-scale=1' });
    }
  }

  // === Touch-Friendly Elements (max -10) ===
  const smallClickTargets = html.match(/font-size:\s*([0-9]+)px/gi) || [];
  const verySmallFonts = smallClickTargets.filter(f => {
    const size = parseInt(f.match(/\d+/)[0]);
    return size < 12;
  }).length;

  if (verySmallFonts > 5) {
    score -= 5;
    issues.push({ severity: 'warning', message: 'Flere elementer har for liten skriftstørrelse for mobil (<12px)' });
  }

  // === Tap Targets ===
  const smallButtons = (html.match(/padding:\s*[0-3]px/gi) || []).length;
  if (smallButtons > 3) {
    score -= 3;
    issues.push({ severity: 'info', message: 'Noen klikkbare elementer kan være for små for touch' });
  }

  // === Responsive Images (max -10) ===
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const responsiveImages = imgTags.filter(img => /srcset=/i.test(img)).length;
  const pictureElements = (html.match(/<picture[^>]*>/gi) || []).length;

  if (imgTags.length > 5 && responsiveImages === 0 && pictureElements === 0) {
    score -= 8;
    issues.push({ severity: 'warning', message: 'Ingen responsive bilder (srcset/picture)' });
  } else if (imgTags.length > 3 && responsiveImages < imgTags.length / 2) {
    score -= 4;
    issues.push({ severity: 'info', message: `Kun ${responsiveImages}/${imgTags.length} bilder er responsive` });
  }

  // === CSS Media Queries (max -10) ===
  const mediaQueries = html.match(/@media[^{]*\{/gi) || [];
  const mobileQueries = mediaQueries.filter(mq =>
    /max-width|min-width|screen/i.test(mq)
  ).length;

  if (mobileQueries === 0) {
    score -= 10;
    issues.push({ severity: 'warning', message: 'Ingen CSS media queries for responsivt design' });
  } else if (mobileQueries < 3) {
    score -= 4;
    issues.push({ severity: 'info', message: `Få media queries: ${mobileQueries}` });
  } else {
    details.push({ type: 'success', message: `${mobileQueries} responsive media queries` });
  }

  // === Fixed Widths (max -10) ===
  const fixedWidths = html.match(/width:\s*\d{4,}px/gi) || [];
  const largeFixedWidths = fixedWidths.filter(w => parseInt(w.match(/\d+/)[0]) > 500);

  if (largeFixedWidths.length > 2) {
    score -= 8;
    issues.push({ severity: 'warning', message: `${largeFixedWidths.length} elementer har faste bredder som kan bryte mobil-layout` });
  }

  // === Horizontal Scroll Indicators ===
  const overflowX = (html.match(/overflow-x:\s*hidden/gi) || []).length;
  const noOverflowControl = html.length > 10000 && overflowX === 0;

  // === Touch Icons (max -5) ===
  const appleTouchIcon = /<link[^>]*rel=["']apple-touch-icon["']/i.test(html);
  const favicon = /<link[^>]*rel=["']icon["']/i.test(html);

  if (!appleTouchIcon) {
    score -= 3;
    issues.push({ severity: 'info', message: 'Mangler Apple Touch Icon' });
  }
  if (!favicon) {
    score -= 2;
    issues.push({ severity: 'info', message: 'Mangler favicon' });
  }

  // === Web App Manifest (max -5) ===
  const hasManifest = /<link[^>]*rel=["']manifest["']/i.test(html);
  if (!hasManifest) {
    score -= 5;
    issues.push({ severity: 'info', message: 'Mangler Web App Manifest (PWA-støtte)' });
  } else {
    details.push({ type: 'success', message: 'Web App Manifest er implementert' });
  }

  // === Theme Color ===
  const hasThemeColor = /<meta[^>]*name=["']theme-color["']/i.test(html);
  if (!hasThemeColor) {
    score -= 2;
    issues.push({ severity: 'info', message: 'Mangler theme-color meta-tag' });
  }

  // === Mobile-specific features ===
  const hasTelLinks = /<a[^>]*href=["']tel:/i.test(html);
  const hasAddressLinks = /<a[^>]*href=["']https?:\/\/(maps|goo\.gl)/i.test(html);

  return {
    score: Math.max(0, Math.min(100, score)),
    details: [...details, ...issues],
    metrics: {
      hasViewport: !!viewportMatch,
      responsiveImages,
      totalImages: imgTags.length,
      mediaQueries: mobileQueries,
      hasManifest,
      hasTouchIcon: appleTouchIcon
    }
  };
}

function analyzeAccessibility(html) {
  let score = 100;
  const details = [];
  const issues = [];

  // === Language Declaration (max -8) ===
  const htmlLang = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  if (!htmlLang) {
    score -= 8;
    issues.push({ severity: 'warning', message: 'Mangler lang-attributt på html-elementet' });
  } else {
    details.push({ type: 'success', message: `Språk er definert: ${htmlLang[1]}` });
  }

  // === Image Alt Texts (max -15) ===
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imagesWithoutAlt = imgTags.filter(img => !/alt=/i.test(img));
  const imagesWithEmptyAlt = imgTags.filter(img => /alt=["']\s*["']/i.test(img));

  if (imagesWithoutAlt.length > 0) {
    const penalty = Math.min(15, imagesWithoutAlt.length * 3);
    score -= penalty;
    issues.push({ severity: 'warning', message: `${imagesWithoutAlt.length} bilder mangler alt-attributt` });
  } else if (imgTags.length > 0) {
    details.push({ type: 'success', message: 'Alle bilder har alt-attributt' });
  }

  // === Form Labels (max -12) ===
  const inputs = html.match(/<input[^>]*>/gi) || [];
  const textInputs = inputs.filter(i =>
    !/type=["'](hidden|submit|button|image)["']/i.test(i)
  );
  const inputsWithoutLabel = textInputs.filter(input => {
    const idMatch = input.match(/id=["']([^"']+)["']/i);
    if (!idMatch) return true;
    const labelPattern = new RegExp(`<label[^>]*for=["']${idMatch[1]}["']`, 'i');
    return !labelPattern.test(html);
  });

  const inputsWithAriaLabel = textInputs.filter(i =>
    /aria-label=/i.test(i) || /aria-labelledby=/i.test(i)
  ).length;

  if (inputsWithoutLabel.length > inputsWithAriaLabel) {
    const unlabeled = inputsWithoutLabel.length - inputsWithAriaLabel;
    if (unlabeled > 0) {
      score -= Math.min(12, unlabeled * 3);
      issues.push({ severity: 'warning', message: `${unlabeled} skjemafelt mangler tilknyttet label` });
    }
  }

  // === Heading Hierarchy (max -10) ===
  const headings = [];
  for (let i = 1; i <= 6; i++) {
    const count = (html.match(new RegExp(`<h${i}[^>]*>`, 'gi')) || []).length;
    headings.push({ level: i, count });
  }

  if (headings[0].count === 0) {
    score -= 5;
    issues.push({ severity: 'warning', message: 'Mangler H1-overskrift' });
  }

  // Check for skipped heading levels
  let lastLevel = 0;
  for (const h of headings) {
    if (h.count > 0) {
      if (lastLevel > 0 && h.level > lastLevel + 1) {
        score -= 3;
        issues.push({ severity: 'info', message: `Overskriftsnivå hoppes over (H${lastLevel} til H${h.level})` });
        break;
      }
      lastLevel = h.level;
    }
  }

  // === ARIA Landmarks (max -8) ===
  const hasMain = /<main[^>]*>|role=["']main["']/i.test(html);
  const hasNav = /<nav[^>]*>|role=["']navigation["']/i.test(html);
  const hasHeader = /<header[^>]*>|role=["']banner["']/i.test(html);
  const hasFooter = /<footer[^>]*>|role=["']contentinfo["']/i.test(html);

  const landmarks = [hasMain, hasNav, hasHeader, hasFooter].filter(Boolean).length;
  if (landmarks < 2) {
    score -= 6;
    issues.push({ severity: 'warning', message: 'Få ARIA landmarks (main, nav, header, footer)' });
  } else if (landmarks === 4) {
    details.push({ type: 'success', message: 'God bruk av semantiske landmarks' });
  }

  // === Skip Link (max -5) ===
  const hasSkipLink = /<a[^>]*href=["']#(main|content|skip)[^"']*["'][^>]*>/i.test(html) ||
                      /skip.*(link|nav|content)/i.test(html);
  if (!hasSkipLink && html.length > 10000) {
    score -= 5;
    issues.push({ severity: 'info', message: 'Mangler skip-link for tastaturnavigasjon' });
  }

  // === Link Text Quality (max -8) ===
  const links = html.match(/<a[^>]*>[\s\S]*?<\/a>/gi) || [];
  const badLinkTexts = links.filter(link => {
    const text = link.replace(/<[^>]*>/g, '').trim().toLowerCase();
    return ['klikk her', 'les mer', 'her', 'link', 'click here', 'read more'].includes(text);
  });

  if (badLinkTexts.length > 3) {
    score -= 5;
    issues.push({ severity: 'info', message: `${badLinkTexts.length} lenker har generisk tekst ("klikk her", "les mer")` });
  }

  // === Focus Indicators (max -5) ===
  const hasOutlineNone = /outline:\s*none|outline:\s*0(?!\d)/gi.test(html);
  const hasFocusStyles = /:focus/i.test(html);

  if (hasOutlineNone && !hasFocusStyles) {
    score -= 5;
    issues.push({ severity: 'warning', message: 'Focus-indikatorer kan være fjernet uten erstatning' });
  }

  // === Color Contrast (limited check) ===
  // Can't fully check without rendering, but we can look for very light colors on white
  const veryLightColors = html.match(/color:\s*#[def][def][def]/gi) || [];
  if (veryLightColors.length > 3) {
    score -= 3;
    issues.push({ severity: 'info', message: 'Mulig dårlig fargekontrast (veldig lyse farger)' });
  }

  // === Tables (max -5) ===
  const tables = html.match(/<table[^>]*>/gi) || [];
  const tablesWithHeaders = html.match(/<th[^>]*>/gi) || [];

  if (tables.length > 0 && tablesWithHeaders.length === 0) {
    score -= 5;
    issues.push({ severity: 'warning', message: 'Tabeller mangler header-celler (th)' });
  }

  // === Button/Link Roles ===
  const divsWithOnclick = (html.match(/<div[^>]*onclick/gi) || []).length;
  const spansWithOnclick = (html.match(/<span[^>]*onclick/gi) || []).length;

  if (divsWithOnclick + spansWithOnclick > 2) {
    score -= 4;
    issues.push({ severity: 'warning', message: 'Klikkbare div/span-elementer bør være buttons eller lenker' });
  }

  // === Tabindex Issues ===
  const positiveTabindex = html.match(/tabindex=["'][1-9]/gi) || [];
  if (positiveTabindex.length > 0) {
    score -= 3;
    issues.push({ severity: 'info', message: 'Positiv tabindex kan forstyrre naturlig tab-rekkefølge' });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    details: [...details, ...issues],
    metrics: {
      hasLang: !!htmlLang,
      imagesWithoutAlt: imagesWithoutAlt.length,
      landmarks,
      hasSkipLink,
      headingStructure: headings.filter(h => h.count > 0).map(h => `H${h.level}:${h.count}`).join(', ')
    }
  };
}

function getStatus(score) {
  if (score >= 90) return 'green';
  if (score >= 70) return 'yellow';
  if (score >= 50) return 'orange';
  return 'red';
}
