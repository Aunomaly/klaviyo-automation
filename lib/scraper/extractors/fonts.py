"""
Font extraction from websites
"""
import re
import sys
import os
from typing import List, Optional, Set
from bs4 import BeautifulSoup
from collections import Counter

# Handle both module and direct execution
try:
    from ..models import ExtractedFont
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from models import ExtractedFont


class FontExtractor:
    """Extract font families from HTML and CSS"""
    
    # Common system fonts to deprioritize
    SYSTEM_FONTS = {
        'arial', 'helvetica', 'verdana', 'georgia', 'times new roman',
        'courier new', 'trebuchet ms', 'palatino', 'garamond',
        'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
        'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui',
        'roboto', 'oxygen', 'ubuntu', 'cantarell', 'fira sans',
        'droid sans', 'helvetica neue'
    }
    
    # Regex for font-family declarations
    FONT_FAMILY_PATTERN = re.compile(
        r'font-family\s*:\s*([^;}"\']+)',
        re.IGNORECASE
    )
    
    # Google Fonts pattern
    GOOGLE_FONTS_PATTERN = re.compile(
        r'fonts\.googleapis\.com/css2?\?family=([^&"\']+)',
        re.IGNORECASE
    )
    
    # Adobe Fonts pattern
    ADOBE_FONTS_PATTERN = re.compile(
        r'use\.typekit\.net/([^"\'\.]+)',
        re.IGNORECASE
    )
    
    def __init__(self, html: str, css_content: Optional[str] = None):
        self.html = html
        self.soup = BeautifulSoup(html, 'lxml')
        self.css_content = css_content or ""
        self.fonts: List[ExtractedFont] = []
        self.css_variables = self._extract_css_variables()
        
    def _extract_css_variables(self) -> dict:
        """Extract CSS variables (custom properties) from CSS content"""
        variables = {}
        
        # Pattern to match CSS variable definitions
        # e.g., --font-heading: "Instrument Serif";
        var_pattern = re.compile(r'--([a-zA-Z0-9-]+)\s*:\s*([^;}"\']+)', re.IGNORECASE)
        
        # Check style tags
        for style in self.soup.find_all('style'):
            if style.string:
                for match in var_pattern.finditer(style.string):
                    var_name = match.group(1)
                    var_value = match.group(2).strip().strip('"\'')
                    variables[var_name] = var_value
        
        # Check CSS content
        if self.css_content:
            for match in var_pattern.finditer(self.css_content):
                var_name = match.group(1)
                var_value = match.group(2).strip().strip('"\'')
                variables[var_name] = var_value
        
        return variables
    
    def _resolve_css_variable(self, value: str) -> str:
        """Resolve CSS variable to its actual value"""
        # Match var(--variable-name) or var(--variable-name, fallback)
        var_match = re.match(r'var\(\s*--([a-zA-Z0-9-]+)\s*(?:,\s*(.+))?\)', value.strip())
        if var_match:
            var_name = var_match.group(1)
            fallback = var_match.group(2)
            
            # Try to resolve from extracted variables
            if var_name in self.css_variables:
                return self.css_variables[var_name]
            elif fallback:
                return fallback.strip().strip('"\'')
        
        return value
    
    def extract_all(self) -> List[ExtractedFont]:
        """Extract all fonts from the page"""
        self._extract_from_google_fonts()
        self._extract_from_adobe_fonts()
        self._extract_from_css()
        self._extract_from_inline_styles()
        self._deduplicate_and_rank()
        return self.fonts
    
    def _extract_from_google_fonts(self):
        """Extract fonts from Google Fonts links"""
        # Check link tags
        for link in self.soup.find_all('link', href=True):
            href = link.get('href', '')
            match = self.GOOGLE_FONTS_PATTERN.search(href)
            if match:
                fonts_str = match.group(1)
                fonts = self._parse_google_fonts_string(fonts_str)
                for font in fonts:
                    self.fonts.append(ExtractedFont(
                        family=font,
                        source="google_fonts"
                    ))
        
        # Check @import in style tags
        for style in self.soup.find_all('style'):
            if style.string:
                match = self.GOOGLE_FONTS_PATTERN.search(style.string)
                if match:
                    fonts_str = match.group(1)
                    fonts = self._parse_google_fonts_string(fonts_str)
                    for font in fonts:
                        self.fonts.append(ExtractedFont(
                            family=font,
                            source="google_fonts"
                        ))
    
    def _parse_google_fonts_string(self, fonts_str: str) -> List[str]:
        """Parse Google Fonts URL parameter"""
        fonts = []
        # URL decode
        fonts_str = fonts_str.replace('+', ' ').replace('%20', ' ')
        
        # Split by | for multiple families
        for family_str in fonts_str.split('|'):
            # Extract family name (before : or @)
            family = family_str.split(':')[0].split('@')[0]
            family = family.strip()
            if family:
                fonts.append(family)
        
        return fonts
    
    def _extract_from_adobe_fonts(self):
        """Extract fonts from Adobe Fonts (Typekit)"""
        for script in self.soup.find_all('script', src=True):
            src = script.get('src', '')
            match = self.ADOBE_FONTS_PATTERN.search(src)
            if match:
                kit_id = match.group(1)
                self.fonts.append(ExtractedFont(
                    family=f"Adobe Typekit ({kit_id})",
                    source="adobe_fonts"
                ))
    
    def _extract_from_css(self):
        """Extract font-family declarations from CSS"""
        if not self.css_content:
            return
            
        font_counter = Counter()
        
        for match in self.FONT_FAMILY_PATTERN.finditer(self.css_content):
            families = self._parse_font_family(match.group(1))
            for family in families:
                font_counter[family] += 1
        
        for family, count in font_counter.most_common(10):
            # Skip if already added from Google/Adobe
            existing = next((f for f in self.fonts if f.family.lower() == family.lower()), None)
            if not existing:
                self.fonts.append(ExtractedFont(
                    family=family,
                    source="css"
                ))
    
    def _extract_from_inline_styles(self):
        """Extract fonts from inline style attributes"""
        font_counter = Counter()
        heading_fonts = set()
        body_fonts = set()
        
        for element in self.soup.find_all(style=True):
            style = element.get('style', '')
            match = self.FONT_FAMILY_PATTERN.search(style)
            if match:
                families = self._parse_font_family(match.group(1))
                for family in families:
                    font_counter[family] += 1
                    
                    # Track heading vs body usage
                    tag_name = element.name.lower() if element.name else ''
                    if tag_name in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
                        heading_fonts.add(family.lower())
                    elif tag_name in ('p', 'span', 'div', 'li', 'td'):
                        body_fonts.add(family.lower())
        
        for family, count in font_counter.most_common(10):
            existing = next((f for f in self.fonts if f.family.lower() == family.lower()), None)
            if existing:
                existing.is_heading = family.lower() in heading_fonts
                existing.is_body = family.lower() in body_fonts
            else:
                self.fonts.append(ExtractedFont(
                    family=family,
                    source="inline_style",
                    is_heading=family.lower() in heading_fonts,
                    is_body=family.lower() in body_fonts
                ))
    
    def _parse_font_family(self, value: str) -> List[str]:
        """Parse font-family value into individual families"""
        fonts = []
        
        # Resolve CSS variables first
        if value.strip().startswith('var('):
            value = self._resolve_css_variable(value)
            # If still a variable, skip it
            if value.strip().startswith('var('):
                return fonts
        
        # Split by comma
        parts = value.split(',')
        for part in parts:
            # Clean up the font name
            font = part.strip().strip('"\'')
            # Skip CSS variables, inherit, initial, unset
            if font and font.lower() not in ('inherit', 'initial', 'unset') and not font.startswith('var('):
                fonts.append(font)
        
        return fonts
    
    def _deduplicate_and_rank(self):
        """Deduplicate fonts and rank by importance"""
        seen = set()
        ranked = []
        
        for font in self.fonts:
            key = font.family.lower()
            if key not in seen:
                seen.add(key)
                ranked.append(font)
        
        # Sort: custom fonts first, then by heading/body usage
        def sort_key(f: ExtractedFont) -> tuple:
            is_custom = f.family.lower() not in self.SYSTEM_FONTS
            is_web_service = f.source in ('google_fonts', 'adobe_fonts')
            return (is_web_service, is_custom, f.is_heading, f.is_body)
        
        self.fonts = sorted(ranked, key=sort_key, reverse=True)
    
    def get_primary_font(self) -> str:
        """Get the primary (heading) font"""
        for font in self.fonts:
            if font.is_heading or font.source in ('google_fonts', 'adobe_fonts'):
                return font.family
        
        # Return first custom font or default
        for font in self.fonts:
            if font.family.lower() not in self.SYSTEM_FONTS:
                return font.family
        
        return "Helvetica, Arial, sans-serif"
    
    def get_secondary_font(self) -> str:
        """Get the secondary (body) font"""
        for font in self.fonts:
            if font.is_body:
                return font.family
        
        # Return second font if available
        if len(self.fonts) > 1:
            return self.fonts[1].family
        
        return "Georgia, serif"
