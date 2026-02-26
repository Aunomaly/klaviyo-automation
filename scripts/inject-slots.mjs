/**
 * Injects data-slot markers into email HTML templates.
 * Run once: node scripts/inject-slots.mjs
 *
 * Strategy: find the exact text node containers and wrap them in a
 * <span data-slot="slot_name"> so the engine can reliably find & replace.
 * We also add data-slot to <img> tags for image slots.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = path.join(__dirname, '..', 'Templates')

// ─── Slot injection rules ─────────────────────────────────────────────────────
// Each rule: find the exact string in the HTML, wrap or annotate it.
// We use a simple string replacement — no DOM parser needed since we control the templates.

/**
 * Wraps text content with a data-slot span.
 * Replaces: >TEXT< with ><span data-slot="NAME">TEXT</span><
 */
function wrapText(html, text, slotName) {
  // Escape special regex chars in the search text
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(>)(${escaped})(<)`, 'g')
  let count = 0
  const result = html.replace(re, (_, open, content, close) => {
    count++
    return `${open}<span data-slot="${slotName}">${content}</span>${close}`
  })
  if (count === 0) {
    console.warn(`  ⚠ No match for slot "${slotName}": "${text.slice(0, 60)}"`)
  } else {
    console.log(`  ✓ ${slotName} (${count} match${count > 1 ? 'es' : ''})`)
  }
  return result
}

/**
 * Adds data-slot to an <img> tag identified by its alt text.
 */
function tagImg(html, altText, slotName) {
  const escaped = altText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(<img[^>]*alt="${escaped}"[^>]*)(/>|>)`, 'gi')
  let count = 0
  const result = html.replace(re, (_, tag, close) => {
    if (tag.includes('data-slot=')) return _ // already tagged
    count++
    return `${tag} data-slot="${slotName}"${close}`
  })
  if (count === 0) {
    console.warn(`  ⚠ No img match for slot "${slotName}": alt="${altText}"`)
  } else {
    console.log(`  ✓ img:${slotName}`)
  }
  return result
}

/**
 * Adds data-slot to the first <a> tag containing the given button text.
 */
function tagButton(html, buttonText, slotName) {
  const escaped = buttonText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match <a ...>TEXT</a> — button text is direct text content
  const re = new RegExp(`(<a\\b[^>]*>)(\\s*${escaped}\\s*)(</a>)`, 'gi')
  let count = 0
  const result = html.replace(re, (_, open, content, close) => {
    count++
    const taggedOpen = open.replace('<a ', `<a data-slot="${slotName}" `)
    return `${taggedOpen}${content}${close}`
  })
  if (count === 0) {
    console.warn(`  ⚠ No button match for slot "${slotName}": "${buttonText}"`)
  } else {
    console.log(`  ✓ btn:${slotName}`)
  }
  return result
}

// ─── Per-template slot definitions ───────────────────────────────────────────

const PATCHES = {
  'welcome-series/welcome-email1b.html': (html) => {
    html = tagImg(html, 'Palazzo Pants Hero', 'img_hero')
    html = tagImg(html, 'True-To-Size Fit', 'img_feature_1')
    html = tagImg(html, 'Soft and Breathable', 'img_feature_2')
    html = tagImg(html, 'Versatile Styling', 'img_feature_3')
    html = wrapText(html, 'STYLE IN EVERY<br/>PALAZZO PANT', 'hero_headline')
    html = wrapText(html, 'Our soft and trendy palazzo pants are here to elevate your look whether it\'s a casual day out or a night on the town.<br/>', 'hero_body')
    html = tagButton(html, 'Claim my 10% OFF', 'cta_button')
    html = wrapText(html, 'True-To-Size Fit', 'feature_1_title')
    html = wrapText(html, 'Tailored for a perfect fit, ensuring you feel confident and comfortable with a flattering high-rise waistband.', 'feature_1_body')
    html = wrapText(html, 'Soft, Comfy, and Breathable', 'feature_2_title')
    html = wrapText(html, 'Crafted from premium, breathable cotton blend that keeps you comfortable and cool all day long.', 'feature_2_body')
    html = wrapText(html, 'Versatile Styling', 'feature_3_title')
    html = wrapText(html, 'Easily transition from casual to chic—these pants complement any occasion, from errands to evening outings.', 'feature_3_body')
    html = wrapText(html, 'Snag this must-have and stay stylish for any agenda, all while looking effortlessly trendy.', 'closing_copy')
    html = tagButton(html, 'Get my Palazzo Pants at 10% OFF', 'cta_button_2')
    return html
  },

  'welcome-series/welcome-email2.html': (html) => {
    html = tagImg(html, 'High Rise Palazzo Pants - Wide-Leg Comfort', 'img_hero')
    html = wrapText(html, 'Wide-Leg Comfort, Flattering Fit', 'hero_headline')
    html = wrapText(html, 'Stay Stylish and Trendy with Effortless Ease', 'hero_subheadline')
    html = wrapText(html, 'Embrace the fashionable, relaxed fit of our High Rise Palazzo Pants that drape effortlessly over any body shape. Whether you\'re heading to a casual lunch or enjoying a day of shopping, these pants offer the perfect blend of comfort and style, making them your must-have piece for everyday fashion.', 'hero_body')
    html = tagButton(html, 'Get My Palazzo Pants at 10% OFF', 'cta_button')
    html = wrapText(html, '"Absolutely love this pajama set! My husband couldn\'t stop complimenting me when he saw me in it. It\'s cozy enough to sleep in, but the stylish cut makes it feel special. I\'m so glad I treated myself to something that makes me feel both comfortable and confident!"', 'testimonial_1')
    html = wrapText(html, '- Jessica R.', 'testimonial_1_author')
    html = wrapText(html, 'I bought this pajama set as a surprise for my boyfriend, and wow—it did not disappoint! The fabric is so soft and comfortable, perfect for lounging around the house, but the sexy design adds that extra touch that made my boyfriend\'s eyes light up the moment he saw me. It\'s the perfect balance of comfort and style. Highly recommend!"', 'testimonial_2')
    html = wrapText(html, '- Emily W.', 'testimonial_2_author')
    return html
  },

  'welcome-series/welcome-email3.html': (html) => {
    html = wrapText(html, 'Don\'t miss out on this must-have piece for your wardrobe.<br/>Experience the ultimate in everyday comfort and trendy style.', 'urgency_headline')
    html = wrapText(html, 'Hurry! You only have 24 hours left!', 'urgency_subheadline')
    html = tagButton(html, 'GET THE PANTS', 'cta_button')
    html = wrapText(html, 'STYLISH, FLOWY, AND EFFORTLESS', 'hero_headline')
    html = wrapText(html, 'Crafted from ultra-soft, breathable cotton blend, our High Rise Palazzo Pants envelop you in comfort, making them perfect for running errands or a casual lunch date. Whether you\'re pairing them with sneakers or dressing them up with your favorite top, these pants ensure you stay effortlessly comfortable and stylish.', 'body_copy')
    html = tagButton(html, 'CLAIM MY 10% OFF', 'cta_button_2')
    return html
  },

  'abandoned-checkout/abandoned-checkout-email1.html': (html) => {
    html = wrapText(html, 'You left some stuff behind', 'hero_headline')
    html = wrapText(html, 'Nothing more than a friendly reminder here. Our team noticed you hadn\'t completed your order yet....', 'body_copy')
    html = tagButton(html, 'FINISH SHOPPING NOW', 'cta_button')
    html = tagButton(html, 'ACTIVATE 10% OFF', 'cta_button_2')
    return html
  },

  'abandoned-checkout/abandoned-checkout-email3.html': (html) => {
    html = wrapText(html, 'This won\'t be here for long!', 'hero_headline')
    html = wrapText(html, 'Our team noticed you hadn\'t completed your order yet....so we are shutting off the code in 24 hours...', 'urgency_body')
    html = tagButton(html, 'FINISH SHOPPING NOW', 'cta_button')
    html = tagButton(html, 'ACTIVATE 10% OFF', 'cta_button_2')
    return html
  },

  'abandoned-checkout/abandoned-checkout-email4.html': (html) => {
    html = wrapText(html, 'STILL THINKING ABOUT IT?', 'hero_headline')
    html = wrapText(html, 'Not just gorgeous, but comfy as well!', 'hero_subheadline')
    html = tagButton(html, 'COMPLETE ORDER NOW', 'cta_button')
    html = tagButton(html, 'ACTIVATE 15% OFF', 'cta_button_2')
    return html
  },

  'browse-abandonment/browse-abandonment-email1.html': (html) => {
    html = tagButton(html, 'SHOP NOW', 'cta_button')
    return html
  },

  'browse-abandonment/browse-abandonment-email3.html': (html) => {
    html = wrapText(html, 'Uh oh. Time is running out!', 'hero_headline')
    html = tagButton(html, 'Claim my 15% OFF now', 'cta_button')
    return html
  },

  'winback/winback-email1.html': (html) => {
    html = tagImg(html, '', 'img_hero') // winback hero has no alt text — tag by width instead
    html = wrapText(html, 'WE JUST REALIZED', 'winback_eyebrow')
    html = wrapText(html, 'IT\'S BEEN AWHILE', 'winback_headline')
    html = wrapText(html, 'We haven\'t seen you in a while and wanted to know if everything was good with you!', 'winback_body_1')
    html = wrapText(html, 'There\'s a chance we have something new to offer! So, we figured we would pass along a ', 'winback_body_2_prefix')
    html = tagButton(html, 'Get my 20% off discount now', 'cta_button')
    return html
  },

  'winback/winback-email2.html': (html) => {
    html = tagButton(html, 'Get 20% OFF NOW <<', 'cta_button')
    return html
  },
}

// ─── Run ──────────────────────────────────────────────────────────────────────

let patched = 0
let skipped = 0

for (const [relPath, patchFn] of Object.entries(PATCHES)) {
  const fullPath = path.join(TEMPLATES_DIR, relPath)
  if (!fs.existsSync(fullPath)) {
    console.warn(`\nSkipping (not found): ${relPath}`)
    skipped++
    continue
  }

  console.log(`\nPatching: ${relPath}`)
  let html = fs.readFileSync(fullPath, 'utf-8')

  // Skip if already patched
  if (html.includes('data-slot=')) {
    console.log('  Already patched — skipping')
    skipped++
    continue
  }

  html = patchFn(html)
  fs.writeFileSync(fullPath, html, 'utf-8')
  patched++
}

console.log(`\nDone. Patched: ${patched}, Skipped: ${skipped}`)
