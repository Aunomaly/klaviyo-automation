"""
Color extraction from websites
"""
import re
import sys
import os
from typing import List, Optional, Tuple
from collections import Counter
from bs4 import BeautifulSoup
import cssutils
import logging

# Handle both module and direct execution
try:
    from ..models import ExtractedColor, ColorType
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from models import ExtractedColor, ColorType

# Suppress cssutils warnings
cssutils.log.setLevel(logging.CRITICAL)


class ColorExtractor:
    """Extract colors from HTML and CSS"""
    
    # Regex patterns for color extraction
    HEX_PATTERN = re.compile(r'#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b')
    RGB_PATTERN = re.compile(r'rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)')
    RGBA_PATTERN = re.compile(r'rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*[\d.]+\s*\)')
    
    # Common colors to ignore
    IGNORE_COLORS = {
        '#ffffff', '#fff', '#000000', '#000', 
        '#f5f5f5', '#eeeeee', '#333333', '#666666',
        '#cccccc', '#999999', '#e5e5e5', '#f0f0f0',
        'transparent', 'inherit', 'initial'
    }
    
    def __init__(self, html: str, css_content: Optional[str] = None):
        self.html = html
        self.soup = BeautifulSoup(html, 'lxml')
        self.css_content = css_content or ""
        self.colors: List[ExtractedColor] = []
        
    def extract_all(self) -> List[ExtractedColor]:
        """Extract all colors from the page"""
        self._extract_from_meta_tags()
        self._extract_from_inline_styles()
        self._extract_from_css()
        self._deduplicate_and_rank()
        return self.colors
    
    def _extract_from_meta_tags(self):
        """Extract theme colors from meta tags"""
        # Theme color
        theme_color = self.soup.find('meta', attrs={'name': 'theme-color'})
        if theme_color and theme_color.get('content'):
            color = self._parse_color(theme_color['content'])
            if color:
                self.colors.append(ExtractedColor(
                    hex=color[0],
                    rgb=color[1],
                    source="meta_theme_color",
                    type=ColorType.PRIMARY
                ))
        
        # MS tile color
        ms_color = self.soup.find('meta', attrs={'name': 'msapplication-TileColor'})
        if ms_color and ms_color.get('content'):
            color = self._parse_color(ms_color['content'])
            if color:
                self.colors.append(ExtractedColor(
                    hex=color[0],
                    rgb=color[1],
                    source="meta_ms_tile",
                    type=ColorType.PRIMARY
                ))
    
    def _extract_from_inline_styles(self):
        """Extract colors from inline style attributes"""
        color_counter = Counter()
        
        for element in self.soup.find_all(style=True):
            style = element.get('style', '')
            colors = self._find_colors_in_text(style)
            for color in colors:
                color_counter[color] += 1
        
        for hex_color, count in color_counter.most_common(20):
            if hex_color.lower() not in self.IGNORE_COLORS:
                rgb = self._hex_to_rgb(hex_color)
                if rgb:
                    self.colors.append(ExtractedColor(
                        hex=hex_color,
                        rgb=rgb,
                        source="inline_style",
                        frequency=count
                    ))
    
    def _extract_from_css(self):
        """Extract colors from CSS content"""
        if not self.css_content:
            return
            
        color_counter = Counter()
        colors = self._find_colors_in_text(self.css_content)
        
        for color in colors:
            color_counter[color] += 1
        
        for hex_color, count in color_counter.most_common(20):
            if hex_color.lower() not in self.IGNORE_COLORS:
                rgb = self._hex_to_rgb(hex_color)
                if rgb:
                    # Check if already exists
                    existing = next((c for c in self.colors if c.hex.lower() == hex_color.lower()), None)
                    if existing:
                        existing.frequency += count
                    else:
                        self.colors.append(ExtractedColor(
                            hex=hex_color,
                            rgb=rgb,
                            source="css",
                            frequency=count
                        ))
    
    def _find_colors_in_text(self, text: str) -> List[str]:
        """Find all color values in text"""
        colors = []
        
        # Find hex colors
        for match in self.HEX_PATTERN.finditer(text):
            hex_val = match.group(0)
            colors.append(self._normalize_hex(hex_val))
        
        # Find rgb colors
        for match in self.RGB_PATTERN.finditer(text):
            r, g, b = int(match.group(1)), int(match.group(2)), int(match.group(3))
            colors.append(self._rgb_to_hex(r, g, b))
        
        # Find rgba colors
        for match in self.RGBA_PATTERN.finditer(text):
            r, g, b = int(match.group(1)), int(match.group(2)), int(match.group(3))
            colors.append(self._rgb_to_hex(r, g, b))
        
        return colors
    
    def _deduplicate_and_rank(self):
        """Deduplicate colors and assign types based on frequency"""
        # Group by hex value
        color_map = {}
        for color in self.colors:
            key = color.hex.lower()
            if key in color_map:
                color_map[key].frequency += color.frequency
                # Prefer meta tag source
                if color.source.startswith('meta'):
                    color_map[key].source = color.source
                    color_map[key].type = color.type
            else:
                color_map[key] = color
        
        # Sort by frequency and type priority
        sorted_colors = sorted(
            color_map.values(),
            key=lambda c: (c.type == ColorType.PRIMARY, c.frequency),
            reverse=True
        )
        
        # Assign types to top colors if not already set
        for i, color in enumerate(sorted_colors[:3]):
            if not color.type:
                if i == 0:
                    color.type = ColorType.PRIMARY
                elif i == 1:
                    color.type = ColorType.SECONDARY
                elif i == 2:
                    color.type = ColorType.ACCENT
        
        self.colors = sorted_colors
    
    def get_primary_color(self) -> Optional[str]:
        """Get the primary brand color"""
        for color in self.colors:
            if color.type == ColorType.PRIMARY:
                return color.hex
        return self.colors[0].hex if self.colors else None
    
    def get_secondary_color(self) -> Optional[str]:
        """Get the secondary brand color"""
        for color in self.colors:
            if color.type == ColorType.SECONDARY:
                return color.hex
        return self.colors[1].hex if len(self.colors) > 1 else None
    
    def get_accent_color(self) -> Optional[str]:
        """Get the accent brand color"""
        for color in self.colors:
            if color.type == ColorType.ACCENT:
                return color.hex
        return self.colors[2].hex if len(self.colors) > 2 else None
    
    @staticmethod
    def _parse_color(value: str) -> Optional[Tuple[str, Tuple[int, int, int]]]:
        """Parse a color value and return (hex, rgb)"""
        value = value.strip().lower()
        
        # Hex color
        if value.startswith('#'):
            hex_val = ColorExtractor._normalize_hex(value)
            rgb = ColorExtractor._hex_to_rgb(hex_val)
            if rgb:
                return (hex_val, rgb)
        
        return None
    
    @staticmethod
    def _normalize_hex(hex_color: str) -> str:
        """Normalize hex color to 6-digit format"""
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 3:
            hex_color = ''.join(c * 2 for c in hex_color)
        return f"#{hex_color.upper()}"
    
    @staticmethod
    def _hex_to_rgb(hex_color: str) -> Optional[Tuple[int, int, int]]:
        """Convert hex to RGB tuple"""
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 3:
            hex_color = ''.join(c * 2 for c in hex_color)
        try:
            return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        except ValueError:
            return None
    
    @staticmethod
    def _rgb_to_hex(r: int, g: int, b: int) -> str:
        """Convert RGB to hex"""
        return f"#{r:02X}{g:02X}{b:02X}"
