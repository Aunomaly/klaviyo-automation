"""
Image and logo extraction from websites
"""
import re
import sys
import os
from typing import List, Optional, Set
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

# Handle both module and direct execution
try:
    from ..models import ExtractedImage
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from models import ExtractedImage


class ImageExtractor:
    """Extract logo and brand images from HTML"""
    
    # Keywords that indicate a logo
    LOGO_KEYWORDS = ['logo', 'brand', 'header-logo', 'site-logo', 'company']
    
    # Keywords that indicate hero/banner images
    HERO_KEYWORDS = ['hero', 'banner', 'slider', 'carousel', 'jumbotron', 'masthead', 'featured']
    
    # Keywords that indicate product images
    PRODUCT_KEYWORDS = ['product', 'item', 'collection', 'shop', 'catalog']
    
    # Keywords that indicate lifestyle/marketing images
    LIFESTYLE_KEYWORDS = ['lifestyle', 'campaign', 'lookbook', 'editorial', 'promo', 'marketing']
    
    # Minimum dimensions for quality images (pixels)
    MIN_WIDTH = 200
    MIN_HEIGHT = 200
    
    # Skip images with these patterns (usually tracking pixels, icons, etc.)
    SKIP_PATTERNS = [
        'pixel', 'tracker', 'spacer', '1x1', 'blank', 'transparent',
        'icon', 'sprite', 'arrow', 'chevron', 'close', 'menu',
        'facebook', 'twitter', 'instagram', 'pinterest', 'youtube',
        'payment', 'visa', 'mastercard', 'paypal', 'amex',
        'badge', 'seal', 'trust', 'secure', 'ssl',
        'loading', 'spinner', 'placeholder'
    ]
    
    def __init__(self, html: str, base_url: str):
        self.html = html
        self.soup = BeautifulSoup(html, 'lxml')
        self.base_url = base_url
        self.images: List[ExtractedImage] = []
        self._seen_urls: Set[str] = set()
        
    def extract_all(self) -> List[ExtractedImage]:
        """Extract all brand-relevant images"""
        self._extract_favicon()
        self._extract_og_image()
        self._extract_logo()
        self._extract_apple_touch_icon()
        self._extract_hero_images()
        self._extract_product_images()
        self._extract_content_images()
        return self.images
    
    def _add_image(self, url: str, img_type: str, width: Optional[int] = None, 
                   height: Optional[int] = None, alt: Optional[str] = None,
                   context: Optional[str] = None) -> bool:
        """Add image if not already seen and passes quality checks"""
        # Skip data URIs for non-logo images (they're often tiny)
        if url.startswith('data:') and img_type not in ['logo', 'favicon']:
            return False
            
        # Normalize URL
        if not url.startswith(('http://', 'https://', 'data:')):
            url = self._make_absolute(url)
        
        # Skip if already seen
        if url in self._seen_urls:
            return False
            
        # Skip if matches skip patterns
        url_lower = url.lower()
        alt_lower = (alt or '').lower()
        if any(pattern in url_lower or pattern in alt_lower for pattern in self.SKIP_PATTERNS):
            return False
        
        self._seen_urls.add(url)
        self.images.append(ExtractedImage(
            url=url,
            type=img_type,
            width=width,
            height=height,
            alt=alt,
            context=context
        ))
        return True
    
    def _extract_favicon(self):
        """Extract favicon"""
        # Standard favicon link
        favicon = self.soup.find('link', rel=lambda x: x and 'icon' in x.lower() if x else False)
        if favicon and favicon.get('href'):
            url = self._make_absolute(favicon['href'])
            self._add_image(url, "favicon")
            return
        
        # Default favicon location
        default_favicon = urljoin(self.base_url, '/favicon.ico')
        self._add_image(default_favicon, "favicon")
    
    def _extract_og_image(self):
        """Extract Open Graph image"""
        og_image = self.soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            url = self._make_absolute(og_image['content'])
            self._add_image(url, "og_image", context="Open Graph meta tag")
        
        # Twitter card image
        twitter_image = self.soup.find('meta', attrs={'name': 'twitter:image'})
        if twitter_image and twitter_image.get('content'):
            url = self._make_absolute(twitter_image['content'])
            self._add_image(url, "twitter_image", context="Twitter card meta tag")
    
    def _extract_apple_touch_icon(self):
        """Extract Apple touch icon (often high-quality logo)"""
        apple_icon = self.soup.find('link', rel=lambda x: x and 'apple-touch-icon' in x.lower() if x else False)
        if apple_icon and apple_icon.get('href'):
            url = self._make_absolute(apple_icon['href'])
            self._add_image(url, "apple_touch_icon")
    
    def _extract_logo(self):
        """Extract logo image from page content"""
        logo_img = None
        
        # Method 1: Look for img with logo in class, id, or alt
        for img in self.soup.find_all('img'):
            img_class = ' '.join(img.get('class', [])).lower()
            img_id = (img.get('id') or '').lower()
            img_alt = (img.get('alt') or '').lower()
            img_src = (img.get('src') or '').lower()
            
            combined = f"{img_class} {img_id} {img_alt} {img_src}"
            
            if any(keyword in combined for keyword in self.LOGO_KEYWORDS):
                logo_img = img
                break
        
        # Method 2: Look in header for first meaningful image
        if not logo_img:
            header = self.soup.find('header') or self.soup.find(class_=re.compile(r'header', re.I))
            if header:
                logo_img = header.find('img')
        
        # Method 3: Look for SVG logo
        if not logo_img:
            for svg in self.soup.find_all('svg'):
                svg_class = ' '.join(svg.get('class', [])).lower()
                svg_id = (svg.get('id') or '').lower()
                if any(keyword in f"{svg_class} {svg_id}" for keyword in self.LOGO_KEYWORDS):
                    # SVG found but we can't easily extract it as URL
                    # Could potentially serialize it but skip for now
                    pass
        
        # Add logo if found
        if logo_img and logo_img.get('src'):
            url = self._make_absolute(logo_img['src'])
            width = logo_img.get('width')
            height = logo_img.get('height')
            
            self._add_image(
                url=url,
                img_type="logo",
                width=int(width) if width and width.isdigit() else None,
                height=int(height) if height and height.isdigit() else None,
                alt=logo_img.get('alt')
            )
    
    def _extract_hero_images(self):
        """Extract hero/banner images from the page"""
        # Look for hero sections
        hero_selectors = [
            self.soup.find(class_=re.compile(r'hero|banner|slider|carousel|jumbotron', re.I)),
            self.soup.find(id=re.compile(r'hero|banner|slider|carousel', re.I)),
            self.soup.find('section', class_=re.compile(r'hero|banner|featured', re.I)),
        ]
        
        for hero_section in hero_selectors:
            if hero_section:
                # Find images in hero section
                for img in hero_section.find_all('img', limit=5):
                    self._extract_img_tag(img, "hero", "Hero/banner section")
                
                # Also check for background images in style attributes
                self._extract_background_images(hero_section, "hero")
        
        # Check main element for large images
        main = self.soup.find('main') or self.soup.find(role='main')
        if main:
            # Get first few large images from main content
            for img in main.find_all('img', limit=10):
                width = self._parse_dimension(img.get('width'))
                height = self._parse_dimension(img.get('height'))
                
                # Only include if dimensions suggest it's a hero/feature image
                if width and height and width >= 600 and height >= 300:
                    self._extract_img_tag(img, "hero", "Main content large image")
    
    def _extract_product_images(self):
        """Extract product/collection images"""
        # Look for product grids/sections
        product_selectors = [
            self.soup.find_all(class_=re.compile(r'product|collection|shop|catalog', re.I), limit=5),
            self.soup.find_all('article', class_=re.compile(r'product', re.I), limit=10),
        ]
        
        for selector_results in product_selectors:
            for section in selector_results:
                for img in section.find_all('img', limit=3):
                    self._extract_img_tag(img, "product", "Product section")
        
        # Look for images with product-related attributes
        for img in self.soup.find_all('img'):
            img_class = ' '.join(img.get('class', [])).lower()
            img_id = (img.get('id') or '').lower()
            img_alt = (img.get('alt') or '').lower()
            
            combined = f"{img_class} {img_id}"
            
            if any(keyword in combined for keyword in self.PRODUCT_KEYWORDS):
                self._extract_img_tag(img, "product", "Product image (by class/id)")
                
                # Limit product images
                product_count = sum(1 for i in self.images if i.type == "product")
                if product_count >= 12:
                    break
    
    def _extract_content_images(self):
        """Extract general content/lifestyle images that might be useful for marketing"""
        # Skip if we already have enough images
        if len(self.images) >= 20:
            return
        
        # Look in main content areas
        content_areas = [
            self.soup.find('main'),
            self.soup.find(role='main'),
            self.soup.find(class_=re.compile(r'content|container', re.I)),
            self.soup.find('article'),
        ]
        
        for area in content_areas:
            if not area:
                continue
                
            for img in area.find_all('img', limit=15):
                # Skip small images
                width = self._parse_dimension(img.get('width'))
                height = self._parse_dimension(img.get('height'))
                
                # If dimensions are specified and too small, skip
                if width and width < self.MIN_WIDTH:
                    continue
                if height and height < self.MIN_HEIGHT:
                    continue
                
                # Determine image type based on context
                img_class = ' '.join(img.get('class', [])).lower()
                img_alt = (img.get('alt') or '').lower()
                combined = f"{img_class} {img_alt}"
                
                if any(keyword in combined for keyword in self.LIFESTYLE_KEYWORDS):
                    img_type = "lifestyle"
                else:
                    img_type = "content"
                
                self._extract_img_tag(img, img_type, "Content area")
                
                # Limit total images
                if len(self.images) >= 25:
                    return
    
    def _extract_img_tag(self, img, img_type: str, context: str):
        """Extract image from img tag"""
        src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
        if not src:
            return
        
        # Handle srcset - get the largest image
        srcset = img.get('srcset')
        if srcset:
            largest_src = self._get_largest_from_srcset(srcset)
            if largest_src:
                src = largest_src
        
        url = self._make_absolute(src)
        width = self._parse_dimension(img.get('width'))
        height = self._parse_dimension(img.get('height'))
        
        self._add_image(
            url=url,
            img_type=img_type,
            width=width,
            height=height,
            alt=img.get('alt'),
            context=context
        )
    
    def _extract_background_images(self, element, img_type: str):
        """Extract background images from inline styles"""
        # Check element and children for background-image styles
        elements_with_style = [element] + element.find_all(style=True)
        
        for el in elements_with_style[:10]:  # Limit to prevent slowdown
            style = el.get('style', '')
            if 'background' in style.lower():
                # Extract URL from background-image: url(...)
                match = re.search(r'url\([\'"]?([^\'")\s]+)[\'"]?\)', style)
                if match:
                    url = self._make_absolute(match.group(1))
                    self._add_image(url, img_type, context="Background image")
    
    def _get_largest_from_srcset(self, srcset: str) -> Optional[str]:
        """Parse srcset and return the largest image URL"""
        try:
            candidates = []
            for part in srcset.split(','):
                part = part.strip()
                if not part:
                    continue
                pieces = part.split()
                if len(pieces) >= 1:
                    url = pieces[0]
                    width = 0
                    if len(pieces) >= 2:
                        descriptor = pieces[1]
                        if descriptor.endswith('w'):
                            width = int(descriptor[:-1])
                        elif descriptor.endswith('x'):
                            width = int(float(descriptor[:-1]) * 100)  # Approximate
                    candidates.append((url, width))
            
            if candidates:
                # Return URL with largest width
                return max(candidates, key=lambda x: x[1])[0]
        except (ValueError, IndexError):
            pass
        return None
    
    def _parse_dimension(self, value) -> Optional[int]:
        """Parse width/height attribute to integer"""
        if not value:
            return None
        if isinstance(value, int):
            return value
        # Remove 'px' suffix if present
        value = str(value).replace('px', '').strip()
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None
    
    def _make_absolute(self, url: str) -> str:
        """Convert relative URL to absolute"""
        if url.startswith('data:'):
            return url
        return urljoin(self.base_url, url)
    
    def get_logo_url(self) -> Optional[str]:
        """Get the best logo URL"""
        # Prefer explicit logo
        for img in self.images:
            if img.type == "logo":
                return img.url
        
        # Fall back to apple touch icon (usually square, high quality)
        for img in self.images:
            if img.type == "apple_touch_icon":
                return img.url
        
        # Fall back to og:image
        for img in self.images:
            if img.type == "og_image":
                return img.url
        
        return None
    
    def get_favicon_url(self) -> Optional[str]:
        """Get favicon URL"""
        for img in self.images:
            if img.type == "favicon":
                return img.url
        return None
    
    def get_hero_images(self) -> List[ExtractedImage]:
        """Get all hero/banner images"""
        return [img for img in self.images if img.type == "hero"]
    
    def get_product_images(self) -> List[ExtractedImage]:
        """Get all product images"""
        return [img for img in self.images if img.type == "product"]
    
    def get_all_selectable_images(self) -> List[ExtractedImage]:
        """Get all images suitable for user selection (excludes favicon)"""
        selectable_types = ["logo", "og_image", "twitter_image", "apple_touch_icon", 
                           "hero", "product", "lifestyle", "content"]
        return [img for img in self.images if img.type in selectable_types]
