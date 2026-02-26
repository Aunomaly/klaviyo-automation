"""
Main website scraper for brand extraction
"""
import asyncio
import httpx
import sys
import os
from typing import Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

# Handle both module and direct execution
if __name__ == "__main__":
    # Add parent directory to path for direct execution
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from scraper.models import BrandData, ExtractedColor, ExtractedFont, ExtractedImage
    from scraper.extractors import ColorExtractor, FontExtractor, ImageExtractor
else:
    from .models import BrandData, ExtractedColor, ExtractedFont, ExtractedImage
    from .extractors import ColorExtractor, FontExtractor, ImageExtractor


class BrandScraper:
    """
    Scrape brand information from a website.
    
    Extracts:
    - Colors (from CSS, meta tags, inline styles)
    - Fonts (from Google Fonts, Adobe Fonts, CSS)
    - Logo and images (from various sources)
    - Brand name (from title, meta tags)
    """
    
    DEFAULT_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    def __init__(self, url: str, timeout: int = 30):
        self.url = self._normalize_url(url)
        self.timeout = timeout
        self.html: Optional[str] = None
        self.css_content: str = ""
        self.errors: list = []
        
    def _normalize_url(self, url: str) -> str:
        """Ensure URL has scheme"""
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        return url.rstrip('/')
    
    async def scrape(self) -> BrandData:
        """
        Perform the scraping and return brand data.
        """
        brand_data = BrandData(
            name="Unknown",
            website_url=self.url
        )
        
        try:
            # Fetch the page
            await self._fetch_page()
            
            if not self.html:
                brand_data.extraction_success = False
                brand_data.extraction_errors = ["Failed to fetch page"]
                return brand_data
            
            soup = BeautifulSoup(self.html, 'lxml')
            
            # Extract brand name
            brand_data.name = self._extract_brand_name(soup)
            brand_data.tagline = self._extract_tagline(soup)
            
            # Fetch and parse CSS files
            await self._fetch_css_files(soup)
            
            # Extract colors
            color_extractor = ColorExtractor(self.html, self.css_content)
            brand_data.colors = color_extractor.extract_all()
            brand_data.primary_color = color_extractor.get_primary_color()
            brand_data.secondary_color = color_extractor.get_secondary_color()
            brand_data.accent_color = color_extractor.get_accent_color()
            
            # Extract fonts
            font_extractor = FontExtractor(self.html, self.css_content)
            brand_data.fonts = font_extractor.extract_all()
            brand_data.font_primary = font_extractor.get_primary_font()
            brand_data.font_secondary = font_extractor.get_secondary_font()
            
            # Extract images
            image_extractor = ImageExtractor(self.html, self.url)
            brand_data.images = image_extractor.extract_all()
            brand_data.logo_url = image_extractor.get_logo_url()
            brand_data.favicon_url = image_extractor.get_favicon_url()
            
            # Extract social links
            brand_data.social_links = self._extract_social_links(soup)
            
            brand_data.extraction_errors = self.errors
            
        except Exception as e:
            brand_data.extraction_success = False
            brand_data.extraction_errors.append(f"Scraping error: {str(e)}")
        
        return brand_data
    
    async def _fetch_page(self):
        """Fetch the main HTML page"""
        async with httpx.AsyncClient(
            headers=self.DEFAULT_HEADERS,
            timeout=self.timeout,
            follow_redirects=True
        ) as client:
            try:
                response = await client.get(self.url)
                response.raise_for_status()
                self.html = response.text
            except httpx.HTTPError as e:
                self.errors.append(f"HTTP error: {str(e)}")
    
    async def _fetch_css_files(self, soup: BeautifulSoup):
        """Fetch linked CSS files"""
        css_urls = []
        
        # Find all linked stylesheets
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                css_url = urljoin(self.url, href)
                css_urls.append(css_url)
        
        # Fetch CSS files (limit to first 5)
        async with httpx.AsyncClient(
            headers=self.DEFAULT_HEADERS,
            timeout=self.timeout
        ) as client:
            for css_url in css_urls[:5]:
                try:
                    response = await client.get(css_url)
                    if response.status_code == 200:
                        self.css_content += response.text + "\n"
                except Exception as e:
                    self.errors.append(f"CSS fetch error ({css_url}): {str(e)}")
        
        # Also extract inline styles
        for style in soup.find_all('style'):
            if style.string:
                self.css_content += style.string + "\n"
    
    def _extract_brand_name(self, soup: BeautifulSoup) -> str:
        """Extract brand name from various sources"""
        # Try og:site_name
        og_site = soup.find('meta', property='og:site_name')
        if og_site and og_site.get('content'):
            return og_site['content'].strip()
        
        # Try title tag (clean up common suffixes)
        title = soup.find('title')
        if title and title.string:
            name = title.string.strip()
            # Remove common suffixes
            for sep in [' | ', ' - ', ' – ', ' — ', ' :: ']:
                if sep in name:
                    name = name.split(sep)[0].strip()
                    break
            return name
        
        # Try og:title
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            return og_title['content'].strip()
        
        # Fall back to domain name
        parsed = urlparse(self.url)
        domain = parsed.netloc.replace('www.', '')
        return domain.split('.')[0].title()
    
    def _extract_tagline(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract tagline/description"""
        # Try meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            return meta_desc['content'].strip()[:200]
        
        # Try og:description
        og_desc = soup.find('meta', property='og:description')
        if og_desc and og_desc.get('content'):
            return og_desc['content'].strip()[:200]
        
        return None
    
    def _extract_social_links(self, soup: BeautifulSoup) -> list:
        """Extract social media links"""
        from .models import SocialLink
        
        social_patterns = {
            'instagram': ['instagram.com'],
            'facebook': ['facebook.com', 'fb.com'],
            'twitter': ['twitter.com', 'x.com'],
            'tiktok': ['tiktok.com'],
            'youtube': ['youtube.com', 'youtu.be'],
            'pinterest': ['pinterest.com'],
            'linkedin': ['linkedin.com'],
        }
        
        links = []
        seen_platforms = set()
        
        for a in soup.find_all('a', href=True):
            href = a['href'].lower()
            for platform, patterns in social_patterns.items():
                if platform not in seen_platforms:
                    if any(pattern in href for pattern in patterns):
                        links.append(SocialLink(platform=platform, url=a['href']))
                        seen_platforms.add(platform)
                        break
        
        return links


def scrape_brand(url: str) -> BrandData:
    """
    Synchronous wrapper for brand scraping.
    
    Usage:
        from lib.scraper import scrape_brand
        brand = scrape_brand("https://example.com")
        print(brand.primary_color)
    """
    scraper = BrandScraper(url)
    return asyncio.run(scraper.scrape())


async def scrape_brand_async(url: str) -> BrandData:
    """
    Async brand scraping function.
    
    Usage:
        brand = await scrape_brand_async("https://example.com")
    """
    scraper = BrandScraper(url)
    return await scraper.scrape()


# CLI usage
if __name__ == "__main__":
    import sys
    import json
    
    if len(sys.argv) < 2:
        print("Usage: python scraper.py <url>")
        sys.exit(1)
    
    url = sys.argv[1]
    print(f"Scraping brand from: {url}")
    
    brand = scrape_brand(url)
    
    # Output as JSON
    print("\n--- Results ---")
    print(json.dumps(brand.model_dump(), indent=2, default=str))
    
    # Summary
    print("\n--- Summary ---")
    print(f"Brand Name: {brand.name}")
    print(f"Primary Color: {brand.primary_color}")
    print(f"Secondary Color: {brand.secondary_color}")
    print(f"Primary Font: {brand.font_primary}")
    print(f"Logo URL: {brand.logo_url}")
    print(f"Extraction Success: {brand.extraction_success}")
    if brand.extraction_errors:
        print(f"Errors: {brand.extraction_errors}")
